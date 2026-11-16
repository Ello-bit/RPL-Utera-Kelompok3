'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/database.types'
import { formatRupiah } from '@/lib/kas'
import { calculateSkorPRD } from '@/lib/skor'
import {
  SORT_OPTIONS,
  countByStatus,
  filterByStatus,
  formatWaktuPengajuan,
  sortUmkm,
  type UmkmSortKey,
  type UmkmStatusFilter,
} from '@/lib/admin-sort'
import {
  fetchAllVerifications,
  reviewVerification,
  VerificationRequest,
  VerificationStatus,
} from '@/lib/verification'

type ProfilUsaha = Tables<'profil_usaha'>
type TransaksiKas = Tables<'transaksi_kas'>
type SimulasiKur = Tables<'simulasi_kur'>
type LegalitasDokumen = Tables<'legalitas_dokumen'>

interface UmkmRecord {
  id: string
  namaUsaha: string
  namaPemilik: string
  sektor: string
  telepon: string
  totalTx: number
  pemasukan: number
  pengeluaran: number
  saldoKas: number
  skor: number
  statusKur: string
  hasNib: boolean
  isVerified: boolean
  verificationStatus: VerificationStatus
  verificationNotes?: string
  verificationType?: string
  verificationSubmittedAt?: string
  submittedAtIso?: string
  adminNote?: string
  certificateNumber?: string
  registeredAt: string
  /** Komponen skor asli (K1-K4) dari transaksi usaha ini */
  komponen?: { k1: number; k2: number; k3: number; k4: number }
}

function statusKurDariSkor(skor: number): string {
  if (skor >= 70) return 'Baik: layak diajukan'
  if (skor >= 40) return 'Cukup: layak diajukan'
  return 'Rendah: perlu perbaikan keuangan'
}

export default function AdminPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Tab aktif dibaca langsung dari URL (?tab=...), sehingga tombol tab di halaman ini
  // dan menu sidebar selalu sinkron menyorot halaman yang sama.
  type AdminTab = 'direktori' | 'skor' | 'kas' | 'kur' | 'sistem'
  const TABS: AdminTab[] = ['direktori', 'skor', 'kas', 'kur', 'sistem']
  const tabParam = searchParams.get('tab')
  const activeTab: AdminTab = TABS.includes(tabParam as AdminTab) ? (tabParam as AdminTab) : 'direktori'
  const setActiveTab = (tab: AdminTab) => router.replace(`/admin?tab=${tab}`, { scroll: false })

  const supabase = createClient()

  // Gabungkan status pengajuan dari tabel verifikasi_usaha ke daftar UMKM.
  // Pengajuan yang profilnya tidak terbaca tetap ditampilkan dari data pengajuannya sendiri.
  const applyVerifications = (records: UmkmRecord[], verifs: VerificationRequest[]): UmkmRecord[] => {
    const result: UmkmRecord[] = records.map((r) => {
      const match = verifs.find((v) => v.businessId === r.id)
      if (match) {
        return {
          ...r,
          verificationStatus: match.status,
          isVerified: match.status === 'verified',
          verificationNotes: match.notes,
          verificationType: match.applicationType,
          verificationSubmittedAt: match.submittedAt,
          submittedAtIso: match.submittedAtIso,
          adminNote: match.adminNote,
          certificateNumber: match.certificateNumber,
        }
      }
      return { ...r, verificationStatus: r.isVerified ? 'verified' : 'unverified' }
    })
    verifs.forEach((v) => {
      if (result.some((r) => r.id === v.businessId)) return
      result.unshift({
        id: v.businessId,
        namaUsaha: v.businessName,
        namaPemilik: v.ownerName,
        sektor: v.businessSector,
        telepon: v.phoneNumber,
        totalTx: v.totalTransactions,
        pemasukan: 0,
        pengeluaran: 0,
        saldoKas: 0,
        skor: v.skorPRD,
        statusKur: statusKurDariSkor(v.skorPRD),
        hasNib: v.hasNib,
        isVerified: v.status === 'verified',
        verificationStatus: v.status,
        verificationNotes: v.notes,
        verificationType: v.applicationType,
        verificationSubmittedAt: v.submittedAt,
        submittedAtIso: v.submittedAtIso,
        adminNote: v.adminNote,
        certificateNumber: v.certificateNumber,
        registeredAt: v.submittedAt,
      })
    })
    return result
  }

  const [umkmData, setUmkmData] = useState<UmkmRecord[]>([])
  const [allTxs, setAllTxs] = useState<TransaksiKas[]>([])
  const [allSims, setAllSims] = useState<SimulasiKur[]>([])
  const [liveLoading, setLiveLoading] = useState(true)
  const [adminEmail, setAdminEmail] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sectorFilter, setSectorFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState<UmkmStatusFilter>('ALL')
  const [sortKey, setSortKey] = useState<UmkmSortKey>('terbaru')
  const [auditModal, setAuditModal] = useState<UmkmRecord | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const showToastMsg = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  // Ambil profil, transaksi, legalitas, dan pengajuan verifikasi dari Supabase.
  // Admin bisa membaca semua pengguna lewat policy "admin baca" (supabase/verifikasi.sql).
  useEffect(() => {
    async function fetchLive() {
      // Email admin yang sedang login (sebelumnya tertulis tetap "admin123@utera.id")
      supabase.auth.getUser().then(({ data }) => setAdminEmail(data.user?.email ?? ''))
      const [{ data: profs }, { data: txs }, { data: docs }, { data: sims }, verifRes] = await Promise.all([
        supabase.from('profil_usaha').select('*'),
        supabase.from('transaksi_kas').select('*').order('tanggal', { ascending: false }),
        supabase.from('legalitas_dokumen').select('*'),
        supabase.from('simulasi_kur').select('*').order('created_at', { ascending: false }),
        fetchAllVerifications(supabase),
      ])
      setAllTxs((txs ?? []) as TransaksiKas[])
      setAllSims((sims ?? []) as SimulasiKur[])
      if (verifRes.error) showToastMsg('Gagal memuat pengajuan verifikasi: ' + verifRes.error)

      const liveRecords: UmkmRecord[] = (profs ?? []).map((p) => {
        const usahaTxs = (txs ?? []).filter((t) => t.profil_id === p.id)
        let inc = 0
        let exp = 0
        usahaTxs.forEach((t) => {
          if (t.tipe === 'pemasukan') inc += Number(t.nominal)
          else exp += Number(t.nominal)
        })
        const skorDetail = calculateSkorPRD(usahaTxs)
        const skor = skorDetail.total
        const hasNib = (docs ?? []).some(
          (d) => d.profil_id === p.id && d.kategori?.toUpperCase() === 'NIB' && Boolean(d.nomor_dokumen || d.file_url)
        )

        return {
          id: p.id,
          namaUsaha: p.nama_usaha,
          namaPemilik: p.nama_pemilik || 'Pemilik Usaha',
          sektor: p.jenis_usaha || '-',
          telepon: p.nomor_telepon || '-',
          totalTx: usahaTxs.length,
          pemasukan: inc,
          pengeluaran: exp,
          saldoKas: inc - exp,
          skor,
          statusKur: statusKurDariSkor(skor),
          komponen: { k1: skorDetail.k1.score, k2: skorDetail.k2.score, k3: skorDetail.k3.score, k4: skorDetail.k4.score },
          hasNib,
          isVerified: false,
          verificationStatus: 'unverified',
          registeredAt: p.created_at ? p.created_at.slice(0, 10) : '-',
        }
      })

      // Hanya data asli; tidak ada lagi usaha contoh/fiktif.
      setUmkmData(applyVerifications(liveRecords, verifRes.data))
      setLiveLoading(false)
    }

    fetchLive()
  }, [])

  const statusCounts = useMemo(() => countByStatus(umkmData), [umkmData])

  const filteredList = useMemo(() => {
    const matched = umkmData.filter((item) => {
      const matchSearch =
        item.namaUsaha.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.namaPemilik.toLowerCase().includes(searchQuery.toLowerCase())
      const matchSector = sectorFilter === 'ALL' || item.sektor === sectorFilter
      return matchSearch && matchSector
    })
    return sortUmkm(filterByStatus(matched, statusFilter), sortKey)
  }, [umkmData, searchQuery, sectorFilter, statusFilter, sortKey])

  const setItemStatus = (id: string, patch: Partial<UmkmRecord>) => {
    setUmkmData((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  // Peninjauan pengajuan: hanya dua keputusan, sahkan atau tolak, masing-masing boleh disertai catatan.
  const [reviewTarget, setReviewTarget] = useState<{ item: UmkmRecord; decision: 'verified' | 'rejected' } | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewing, setReviewing] = useState(false)

  const closeReview = () => {
    setReviewTarget(null)
    setReviewNote('')
  }

  const submitReview = async () => {
    if (!reviewTarget) return
    const { item, decision } = reviewTarget
    const note = reviewNote.trim()
    const certNo =
      decision === 'verified'
        ? `UTERA-VERIF-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
        : undefined

    setReviewing(true)
    const { error } = await reviewVerification(supabase, item.id, decision, { note, certificateNumber: certNo })
    setReviewing(false)
    if (error) {
      showToastMsg((decision === 'verified' ? 'Gagal mengesahkan: ' : 'Gagal menolak: ') + error)
      return
    }

    setItemStatus(item.id, {
      isVerified: decision === 'verified',
      verificationStatus: decision,
      certificateNumber: certNo,
      adminNote: note || undefined,
    })
    showToastMsg(
      decision === 'verified'
        ? `Status kredibilitas ${item.namaUsaha} telah disahkan sebagai Mitra Kredibel UTERA! (No. ${certNo})`
        : `Pengajuan verifikasi ${item.namaUsaha} ditolak. Pemilik dapat mengajukan kembali.`
    )
    closeReview()
  }

  // Aggregate stats
  const totalOmzet = umkmData.reduce((acc, curr) => acc + curr.pemasukan, 0)
  const avgSkor = Math.round(umkmData.reduce((acc, curr) => acc + curr.skor, 0) / (umkmData.length || 1))
  const verifiedCount = umkmData.filter((u) => u.isVerified).length
  const namaUsahaById = useMemo(() => new Map(umkmData.map((u) => [u.id, u.namaUsaha])), [umkmData])
  const denganKomponen = umkmData.filter((u) => u.komponen && u.totalTx > 0)
  const rataKomponen = (k: 'k1' | 'k2' | 'k3' | 'k4') =>
    denganKomponen.length === 0
      ? 0
      : Math.round((denganKomponen.reduce((a, u) => a + (u.komponen?.[k] ?? 0), 0) / denganKomponen.length) * 10) / 10

  return (
    <div className="dashboard-scroll-wrap" style={{ fontFamily: 'var(--font-family)' }}>
      {/* 1. HEADER PENGAWAS EKOSISTEM */}
      <div className="dash-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 className="dash-heading">Pusat Pengawasan &amp; Kredibilitas UMKM</h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#12402F', color: '#FCD34D', padding: '3px 12px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 800 }}>
              <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>verified_user</span>
              Otoritas Pengawas Platform
            </span>
          </div>
          <p className="dash-subheading">
            Audit integritas kas digital, pantau kredibilitas pembukuan, dan validasi kelayakan kredit bank mitra UMKM.
          </p>
        </div>

        <div className="dash-header-actions">
          <div className="date-range-badge">
            <span className="material-symbols-rounded date-icon">shield</span>
            <span>Auditor: {adminEmail || '…'}</span>
          </div>
          {/* Tombol "Laporan Audit A4" dihapus: tombol itu membuka Laporan Siap Bank milik pemilik
              usaha, dan untuk admin halaman itu menampilkan laporan usaha orang lain secara acak. */}
        </div>
      </div>

      {toastMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px', borderRadius: '10px', background: '#EEF7F2', color: '#12402F', border: '1px solid #D1E7DC', marginBottom: '20px', fontWeight: 700, fontSize: '0.875rem' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#1F6B4F' }}>check_circle</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 2. TOP METRICS ROW (Gaya Asli UTERA) */}
      <section className="metrics-grid" aria-label="Metrik Pengawasan">
        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Mitra UMKM Binaan</span>
            <div className="metric-icon-wrap" aria-hidden="true">
              <span className="material-symbols-rounded">storefront</span>
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value">{umkmData.length} Usaha</span>
            <span className="trend-pill trend-up">
              <span className="material-symbols-rounded trend-icon">check_circle</span>
              <span>{umkmData.filter((u) => u.totalTx > 0).length} mencatat kas</span>
            </span>
          </div>
          <p className="metric-subtext">Terdaftar dalam pengawasan platform</p>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Perputaran Kas Ekosistem</span>
            <div className="metric-icon-wrap icon-income" aria-hidden="true">
              <span className="material-symbols-rounded">trending_up</span>
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value" style={{ color: 'var(--primary)' }}>{formatRupiah(totalOmzet)}</span>
            <span className="trend-pill trend-up">
              <span className="material-symbols-rounded trend-icon">lock</span>
              <span>Transparan</span>
            </span>
          </div>
          <p className="metric-subtext">Total omzet pembukuan tercatat</p>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Rata-rata Skor Bank</span>
            <div className="metric-icon-wrap icon-score" aria-hidden="true">
              <span className="material-symbols-rounded">verified</span>
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value">{avgSkor} / 100</span>
            {/* Kategori dari rata-rata skor: Baik >= 70, Cukup 40-69, Rendah < 40 */}
            <span
              className="badge-kur-ready"
              style={avgSkor < 40 ? { background: '#FEF3C7', color: '#92400E' } : undefined}
            >
              {avgSkor >= 70 ? 'Baik' : avgSkor >= 40 ? 'Cukup' : 'Rendah'}
            </span>
          </div>
          <p className="metric-subtext">Rata-rata skor kelayakan (4 komponen)</p>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Kredibilitas Terverifikasi</span>
            <div className="metric-icon-wrap" aria-hidden="true" style={{ background: '#EFF6FF', color: '#1E40AF' }}>
              <span className="material-symbols-rounded">gavel</span>
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value" style={{ color: '#1E40AF' }}>{verifiedCount} / {umkmData.length}</span>
            <span className="trend-pill trend-up">
              <span>{Math.round((verifiedCount / (umkmData.length || 1)) * 100)}% Lolos</span>
            </span>
          </div>
          <p className="metric-subtext">Lolos audit kepatuhan &amp; legalitas</p>
        </div>
      </section>

      {/* 3. TABS PENGAWAS (Direktori, Skor, Kas, KUR, Sistem) */}
      <div style={{ display: 'flex', gap: '8px', margin: '24px 0 16px', borderBottom: '2px solid var(--border-subtle)', paddingBottom: '4px', overflowX: 'auto' }}>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'direktori' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('direktori')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, whiteSpace: 'nowrap' }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>groups</span>
          <span>Direktori &amp; Verifikasi UMKM ({umkmData.length})</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'skor' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('skor')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, whiteSpace: 'nowrap' }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>verified</span>
          <span>Audit Kredibilitas &amp; Skor Bank</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'kas' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('kas')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, whiteSpace: 'nowrap' }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>receipt_long</span>
          <span>Audit Mutasi Kas Global</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'kur' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('kur')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, whiteSpace: 'nowrap' }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>account_balance</span>
          <span>Pengawasan KUR &amp; Batas Cicilan</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'sistem' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('sistem')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, whiteSpace: 'nowrap' }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>security</span>
          <span>Status Sistem &amp; Log</span>
        </button>
      </div>

      {/* 4. TAB CONTENT 1: DIREKTORI & VERIFIKASI UMKM */}
      {activeTab === 'direktori' && (
        <div className="dash-panel" style={{ padding: '24px' }}>
          <div className="panel-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 className="panel-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                Pengawasan Kredibilitas &amp; Verifikasi Mitra UMKM
              </h2>
              <p className="panel-subtitle" style={{ margin: '4px 0 0', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                Tinjau pembukuan usaha, pastikan integritas catatan transaksi, dan sahkan status verifikasi bank.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span className="material-symbols-rounded" style={{ position: 'absolute', left: '10px', fontSize: '18px', color: 'var(--text-muted)' }}>
                  search
                </span>
                <input
                  type="text"
                  placeholder="Cari nama usaha atau pemilik..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: '8px 14px 8px 34px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                    outline: 'none',
                    minWidth: '240px',
                  }}
                />
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <select
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                    background: '#fff',
                    outline: 'none',
                  }}
                >
                  <option value="ALL">Semua Sektor Usaha</option>
                  <option value="Kuliner & F&B">Kuliner &amp; F&amp;B</option>
                  <option value="Perdagangan & Retail">Perdagangan &amp; Retail</option>
                  <option value="Konveksi & Fashion">Konveksi &amp; Fashion</option>
                  <option value="Jasa & Layanan">Jasa &amp; Layanan</option>
                </select>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label htmlFor="sort-umkm" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Urutkan
                </label>
                <select
                  id="sort-umkm"
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as UmkmSortKey)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                    background: '#fff',
                    outline: 'none',
                  }}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div role="group" aria-label="Filter status verifikasi" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {(
              [
                ['ALL', 'Semua'],
                ['pending', 'Menunggu Audit'],
                ['verified', 'Terverifikasi'],
                ['rejected', 'Perlu Revisi'],
                ['unverified', 'Belum Mengajukan'],
              ] as [UmkmStatusFilter, string][]
            ).map(([value, label]) => {
              const active = statusFilter === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  aria-pressed={active}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '9999px',
                    border: `1px solid ${active ? 'var(--primary)' : 'var(--border-subtle)'}`,
                    background: active ? 'var(--primary)' : '#fff',
                    color: active ? '#fff' : 'var(--text-main)',
                    fontFamily: 'inherit',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <span>{label}</span>
                  <span
                    style={{
                      minWidth: '20px',
                      padding: '0 6px',
                      borderRadius: '9999px',
                      background: active ? 'rgba(255,255,255,0.25)' : value === 'pending' && statusCounts.pending > 0 ? '#FEF3C7' : '#F1F5F3',
                      color: active ? '#fff' : value === 'pending' && statusCounts.pending > 0 ? '#92400E' : 'var(--text-muted)',
                      fontSize: '0.72rem',
                      textAlign: 'center',
                    }}
                  >
                    {statusCounts[value]}
                  </span>
                </button>
              )
            })}
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', fontFamily: 'inherit', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAF9', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Mitra UMKM &amp; Pemilik</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Sektor</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Saldo Kas</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Skor Kelayakan</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Legalitas NIB</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Status Kredibilitas</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Aksi Pengawas</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #F1F5F3' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <strong style={{ color: 'var(--text-main)', display: 'block', fontSize: '0.925rem' }}>{u.namaUsaha}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Pemilik: <strong>{u.namaPemilik}</strong> • {u.telepon}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '6px', background: '#F1F5F3', fontSize: '0.75rem', fontWeight: 600 }}>
                        {u.sektor}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <strong style={{ color: u.saldoKas >= 0 ? '#1F6B4F' : '#DC2626' }}>
                        {formatRupiah(u.saldoKas)}
                      </strong>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{u.totalTx} Transaksi Kas</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          background: u.skor >= 70 ? '#EEF7F2' : '#FEF3C7',
                          color: u.skor >= 70 ? '#1F6B4F' : '#D97706',
                          border: `1px solid ${u.skor >= 70 ? '#D1E7DC' : '#FCD34D'}`,
                        }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '14px', color: u.skor >= 70 ? '#1F6B4F' : '#D97706' }}>
                          star
                        </span>
                        <span>{u.skor} Poin</span>
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {u.hasNib ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', background: '#EFF6FF', color: '#1E40AF', fontSize: '0.75rem', fontWeight: 700, border: '1px solid #BFDBFE' }}>
                          <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>verified</span>
                          <span>NIB OSS</span>
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', background: '#F3F4F6', color: '#9CA3AF', fontSize: '0.75rem', fontWeight: 600 }}>
                          <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>remove</span>
                          <span>Belum Ada</span>
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {u.verificationStatus === 'verified' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '9999px', background: '#EEF7F2', color: '#12402F', border: '1px solid #D1E7DC', fontSize: '0.75rem', fontWeight: 700 }}>
                          <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>verified</span>
                          <span>Terverifikasi Kredibel</span>
                        </span>
                      ) : u.verificationStatus === 'pending' ? (
                        <>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '9999px', background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D', fontSize: '0.75rem', fontWeight: 700 }}>
                          <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>hourglass_top</span>
                          <span>Menunggu Audit</span>
                          <span style={{ background: '#DC2626', color: '#fff', fontSize: '9px', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>BARU</span>
                        </span>
                        {u.submittedAtIso && (
                          <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Diajukan {formatWaktuPengajuan(u.submittedAtIso)}
                          </div>
                        )}
                        </>
                      ) : u.verificationStatus === 'rejected' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '9999px', background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', fontSize: '0.75rem', fontWeight: 700 }}>
                          <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>cancel</span>
                          <span>Perlu Revisi</span>
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '9999px', background: '#F3F4F6', color: '#6B7280', fontSize: '0.75rem', fontWeight: 600 }}>
                          <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>remove</span>
                          <span>Belum Mengajukan</span>
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => setAuditModal(u)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #D1D5DB',
                            background: '#F8FAF9',
                            fontSize: '0.75rem',
                            fontFamily: 'inherit',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>visibility</span>
                          <span>Audit Detail</span>
                        </button>

                        {u.verificationStatus === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setReviewTarget({ item: u, decision: 'verified' })}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                background: '#12402F',
                                color: '#fff',
                                fontSize: '0.75rem',
                                fontFamily: 'inherit',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                              title="Sahkan status kredibilitas (bisa disertai catatan)"
                            >
                              <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>check</span>
                              <span>Sahkan</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setReviewTarget({ item: u, decision: 'rejected' })}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #FCA5A5',
                                background: '#FEF2F2',
                                color: '#DC2626',
                                fontSize: '0.75rem',
                                fontFamily: 'inherit',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                              title="Tolak pengajuan (bisa disertai catatan)"
                            >
                              <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>close</span>
                              <span>Tolak</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. TAB CONTENT 2: AUDIT SKOR & KELAYAKAN PRD */}
      {activeTab === 'skor' && (
        <div className="dash-panel" style={{ padding: '24px' }}>
          <div className="panel-header" style={{ marginBottom: '20px' }}>
            <div>
              <h2 className="panel-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                Audit Kredibilitas Finansial &amp; Skor Kelayakan
              </h2>
              <p className="panel-subtitle" style={{ margin: '4px 0 0', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                Rata-rata 4 komponen skor dari {denganKomponen.length} usaha yang sudah mencatat transaksi: konsistensi pencatatan (30), tren pemasukan (25), margin laba (25), dan stabilitas kas (20).
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {([
              { k: 'k1', label: 'K1 • KONSISTENSI PENCATATAN', max: 30, icon: 'history_edu', desc: 'Jumlah bulan bertransaksi dari 6 bulan terakhir.' },
              { k: 'k2', label: 'K2 • TREN PEMASUKAN', max: 25, icon: 'trending_up', desc: 'Pemasukan 3 bulan terakhir dibanding 3 bulan sebelumnya.' },
              { k: 'k3', label: 'K3 • MARGIN LABA', max: 25, icon: 'account_balance_wallet', desc: 'Laba bersih dibanding pemasukan; penuh pada margin 20%.' },
              { k: 'k4', label: 'K4 • STABILITAS KAS', max: 20, icon: 'savings', desc: 'Jumlah bulan dengan laba positif dari 6 bulan terakhir.' },
            ] as const).map((c) => (
              <div key={c.k} style={{ padding: '18px', borderRadius: '12px', background: '#F8FAF9', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>{c.label}</span>
                  <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--primary)' }}>{c.icon}</span>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', margin: '4px 0' }}>
                  {liveLoading ? '…' : `${rataKomponen(c.k)} / ${c.max} poin`}
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>{c.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAF9', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 16px' }}>Usaha</th>
                  <th style={{ padding: '12px 16px' }}>K1 (30)</th>
                  <th style={{ padding: '12px 16px' }}>K2 (25)</th>
                  <th style={{ padding: '12px 16px' }}>K3 (25)</th>
                  <th style={{ padding: '12px 16px' }}>K4 (20)</th>
                  <th style={{ padding: '12px 16px' }}>Total Skor</th>
                  <th style={{ padding: '12px 16px' }}>Kategori</th>
                </tr>
              </thead>
              <tbody>
                {liveLoading ? (
                  <tr><td colSpan={7} style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat data usaha…</td></tr>
                ) : umkmData.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada usaha terdaftar.</td></tr>
                ) : (
                  [...umkmData].sort((a, b) => b.skor - a.skor).map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #F1F5F3' }}>
                      <td style={{ padding: '14px 16px' }}><strong>{u.namaUsaha}</strong></td>
                      <td style={{ padding: '14px 16px' }}>{u.komponen ? `${u.komponen.k1} poin` : '-'}</td>
                      <td style={{ padding: '14px 16px' }}>{u.komponen ? `${u.komponen.k2} poin` : '-'}</td>
                      <td style={{ padding: '14px 16px' }}>{u.komponen ? `${u.komponen.k3} poin` : '-'}</td>
                      <td style={{ padding: '14px 16px' }}>{u.komponen ? `${u.komponen.k4} poin` : '-'}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 800, color: u.skor >= 40 ? '#1F6B4F' : '#D97706' }}>
                          <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>verified</span>
                          <span>{u.skor} / 100</span>
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: u.skor >= 40 ? '#12402F' : '#92400E' }}>
                          {u.totalTx === 0 ? 'Belum ada transaksi' : u.statusKur}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TAB CONTENT 3: AUDIT MUTASI KAS (data asli semua usaha) */}
      {activeTab === 'kas' && (
        <div className="dash-panel" style={{ padding: '24px' }}>
          <div className="panel-header" style={{ marginBottom: '16px' }}>
            <h2 className="panel-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              Audit Mutasi Kas Semua Usaha
            </h2>
            <p className="panel-subtitle" style={{ margin: '4px 0 0', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              {allTxs.length > 50
                ? `50 transaksi terbaru dari ${allTxs.length} transaksi yang tercatat di semua usaha.`
                : `${allTxs.length} transaksi yang tercatat di semua usaha, terbaru di atas.`}
            </p>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAF9', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 16px' }}>Tanggal</th>
                  <th style={{ padding: '12px 16px' }}>Usaha</th>
                  <th style={{ padding: '12px 16px' }}>Kategori</th>
                  <th style={{ padding: '12px 16px' }}>Keterangan Transaksi</th>
                  <th style={{ padding: '12px 16px' }}>Metode</th>
                  <th style={{ padding: '12px 16px' }}>Jenis</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Nominal</th>
                </tr>
              </thead>
              <tbody>
                {liveLoading ? (
                  <tr><td colSpan={7} style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat transaksi…</td></tr>
                ) : allTxs.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada transaksi tercatat.</td></tr>
                ) : (
                  allTxs.slice(0, 50).map((tx) => {
                    const masuk = tx.tipe === 'pemasukan'
                    return (
                      <tr key={tx.id} style={{ borderBottom: '1px solid #F1F5F3' }}>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{tx.tanggal}</td>
                        <td style={{ padding: '12px 16px' }}>{(tx.profil_id && namaUsahaById.get(tx.profil_id)) || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#F1F5F3', fontSize: '0.75rem', fontWeight: 600 }}>
                            {tx.kategori || '-'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>{tx.keterangan || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>{tx.metode_pembayaran || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.725rem',
                              fontWeight: 700,
                              background: masuk ? '#EEF7F2' : '#FEE2E2',
                              color: masuk ? '#12402F' : '#B5532F',
                            }}
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: '13px' }}>
                              {masuk ? 'arrow_downward' : 'arrow_upward'}
                            </span>
                            <span>{masuk ? 'Pemasukan' : 'Pengeluaran'}</span>
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', color: masuk ? '#1F6B4F' : '#B5532F' }}>
                          {masuk ? '+' : '-'} {formatRupiah(Number(tx.nominal))}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. TAB CONTENT 4: PENGAWASAN KUR & BATAS AMAN CICILAN (simulasi yang disimpan pengguna) */}
      {activeTab === 'kur' && (
        <div className="dash-panel" style={{ padding: '24px' }}>
          <div className="panel-header" style={{ marginBottom: '16px' }}>
            <h2 className="panel-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              Pengawasan Simulasi KUR &amp; Batas Aman Cicilan 30%
            </h2>
            <p className="panel-subtitle" style={{ margin: '4px 0 0', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Simulasi pinjaman yang disimpan pengguna. Cicilan tidak boleh melebihi 30% dari rata-rata laba bersih bulanan.
            </p>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAF9', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 16px' }}>Tanggal</th>
                  <th style={{ padding: '12px 16px' }}>Usaha</th>
                  <th style={{ padding: '12px 16px' }}>Program Pembiayaan</th>
                  <th style={{ padding: '12px 16px' }}>Plafon</th>
                  <th style={{ padding: '12px 16px' }}>Bunga</th>
                  <th style={{ padding: '12px 16px' }}>Tenor</th>
                  <th style={{ padding: '12px 16px' }}>Cicilan</th>
                  <th style={{ padding: '12px 16px' }}>Batas Cicilan 30%</th>
                </tr>
              </thead>
              <tbody>
                {liveLoading ? (
                  <tr><td colSpan={8} style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat simulasi…</td></tr>
                ) : allSims.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada simulasi KUR atau pinjaman yang disimpan pengguna.</td></tr>
                ) : (
                  allSims.map((k) => {
                    // Status dihitung dari rasio cicilan/laba (data lama bisa menyimpan status yang tidak sesuai rasionya)
                    const rasio = k.rasio_kas
                    const status = rasio == null ? k.status_guardrail || 'aman' : rasio <= 25 ? 'aman' : rasio <= 30 ? 'waspada' : 'melebihi'
                    // Data lama menyimpan bunga sebagai pecahan (0,06); data baru dalam persen (6)
                    const bungaPersen = Number(k.bunga_tahunan) < 1 ? Number(k.bunga_tahunan) * 100 : Number(k.bunga_tahunan)
                    const aman = status === 'aman'
                    const waspada = status === 'waspada'
                    const label = aman ? 'Kondisi Aman' : waspada ? 'Batas Waspada' : 'Melebihi Batas'
                    return (
                      <tr key={k.id} style={{ borderBottom: '1px solid #F1F5F3' }}>
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>{k.created_at?.slice(0, 10)}</td>
                        <td style={{ padding: '14px 16px' }}><strong>{(k.profil_id && namaUsahaById.get(k.profil_id)) || 'Tanpa profil usaha'}</strong></td>
                        <td style={{ padding: '14px 16px' }}>{k.program}</td>
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>{formatRupiah(Number(k.plafon))}</td>
                        <td style={{ padding: '14px 16px' }}>{Math.round(bungaPersen * 10) / 10}% / tahun</td>
                        <td style={{ padding: '14px 16px' }}>{k.tenor_bulan} bulan</td>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{formatRupiah(Number(k.angsuran_bulanan))} / bln</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: aman ? '#EEF7F2' : waspada ? '#FEF3C7' : '#FEE2E2',
                              color: aman ? '#12402F' : waspada ? '#92400E' : '#B5532F',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>
                              {aman ? 'check_circle' : 'warning'}
                            </span>
                            <span>{label}{k.rasio_kas != null ? ` (${k.rasio_kas}% dari laba)` : ''}</span>
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. TAB CONTENT 5: SISTEM & LOG PENGAWAS */}
      {activeTab === 'sistem' && (
        <div className="dash-panel" style={{ padding: '24px' }}>
          <div className="panel-header" style={{ marginBottom: '20px' }}>
            <h2 className="panel-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              Status Sistem &amp; Kredibilitas Platform
            </h2>
            <p className="panel-subtitle" style={{ margin: '4px 0 0', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Infrastruktur otentikasi, enkripsi database, dan rekam jejak pengawasan.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: '#FAFDFB' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-rounded" style={{ color: '#2563EB' }}>database</span>
                Database &amp; Standar SAK EMKM
              </h3>
              <table style={{ width: '100%', fontSize: '0.85rem' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Penyedia Cloud:</td>
                    <td><strong>Supabase PostgreSQL (AWS Cloud)</strong></td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Isolasi Data:</td>
                    <td><strong>Row Level Security (RLS) Multi-Tenant</strong></td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Engine Skor:</td>
                    <td><strong>Skor Kelayakan UTERA (4 komponen, 100 poin)</strong></td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Ambang Bank:</td>
                    <td><strong>Minimal 70 Poin untuk Lolos KUR Mikro</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 9. MODAL AUDIT KREDIBILITAS UMKM */}
      {auditModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setAuditModal(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '560px',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #E5E7EB', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-rounded" style={{ color: 'var(--primary)' }}>verified</span>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Audit Kredibilitas: {auditModal.namaUsaha}</h3>
              </div>
              <button
                type="button"
                onClick={() => setAuditModal(null)}
                style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}
                aria-label="Tutup modal"
              >
                <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', lineHeight: '1.6', marginBottom: '20px' }}>
              <div style={{ background: '#F8FAF9', padding: '12px', borderRadius: '8px', marginBottom: '14px' }}>
                <div>Pemilik: <strong>{auditModal.namaPemilik}</strong> ({auditModal.telepon})</div>
                <div>Sektor: <strong>{auditModal.sektor}</strong> • Terdaftar: <strong>{auditModal.registeredAt}</strong></div>
              </div>

              {/* Verification Application Note from User */}
              {auditModal.verificationNotes && (
                <div
                  style={{
                    background: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '14px',
                    fontSize: '0.825rem',
                  }}
                >
                  <strong style={{ color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>assignment</span>
                    Permohonan Verifikasi dari Mitra:
                  </strong>
                  <div style={{ color: '#1E3A8A', marginBottom: '4px' }}>
                    Jenis: <strong>{auditModal.verificationType || 'Verifikasi Kredibilitas'}</strong> ({auditModal.verificationSubmittedAt || 'Baru saja'})
                  </div>
                  <div style={{ background: '#fff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #DBEAFE', fontStyle: 'italic', color: '#1E293B' }}>
                    &ldquo;{auditModal.verificationNotes}&rdquo;
                  </div>
                </div>
              )}

              {auditModal.certificateNumber && (
                <div style={{ background: '#EEF7F2', border: '1px solid #D1E7DC', padding: '8px 12px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.8rem', color: '#17543E' }}>
                  No. Sertifikat Kredibilitas: <strong>{auditModal.certificateNumber}</strong>
                </div>
              )}
              {auditModal.verificationNotes && (
                <div style={{ background: '#F8FAF9', border: '1px solid #E5E7EB', padding: '8px 12px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.8rem' }}>
                  <strong>Catatan pemilik usaha:</strong> {auditModal.verificationNotes}
                </div>
              )}
              {auditModal.adminNote && (
                <div style={{ background: auditModal.verificationStatus === 'rejected' ? '#FEF2F2' : '#EEF7F2', border: `1px solid ${auditModal.verificationStatus === 'rejected' ? '#FECACA' : '#D1E7DC'}`, padding: '8px 12px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.8rem' }}>
                  <strong>Catatan admin:</strong> {auditModal.adminNote}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div style={{ padding: '10px', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SKOR KREDIBILITAS BANK</div>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#D97706' }}>star</span>
                    <span>{auditModal.skor} / 100 Poin</span>
                  </strong>
                </div>
                <div style={{ padding: '10px', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SALDO KAS OPERASIONAL</div>
                  <strong style={{ fontSize: '1.1rem', color: '#1F6B4F', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>account_balance_wallet</span>
                    <span>{formatRupiah(auditModal.saldoKas)}</span>
                  </strong>
                </div>
              </div>

              <div>
                <strong style={{ display: 'block', marginBottom: '6px' }}>Status Kepatuhan Audit:</strong>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '18px', color: auditModal.hasNib ? '#1F6B4F' : '#D97706', marginTop: '2px' }}>
                      {auditModal.hasNib ? 'verified' : 'warning'}
                    </span>
                    <span>
                      <strong>Legalitas Izin Usaha:</strong> {auditModal.hasNib ? 'Nomor Induk Berusaha (NIB) Resmi Terbit OSS' : 'Belum mengunggah NIB'}
                    </span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#1F6B4F', marginTop: '2px' }}>
                      receipt_long
                    </span>
                    <span>
                      <strong>Integritas Pembukuan:</strong> {auditModal.totalTx} mutasi kas tercatat aktif tanpa rekayasa saldo.
                    </span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#2563EB', marginTop: '2px' }}>
                      account_balance
                    </span>
                    <span>
                      <strong>Kapasitas Kredit:</strong> {auditModal.statusKur}
                    </span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '18px', color: auditModal.isVerified ? '#1F6B4F' : '#D97706', marginTop: '2px' }}>
                      {auditModal.isVerified ? 'verified_user' : 'hourglass_empty'}
                    </span>
                    <span>
                      <strong>Status Pengawasan:</strong> {auditModal.isVerified ? 'Sudah Disahkan sebagai Mitra Kredibel UTERA' : 'Belum diverifikasi resmi'}
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAuditModal(null)}
              >
                Tutup
              </button>

              {auditModal.verificationStatus === 'pending' && (
                <>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5' }}
                    onClick={() => {
                      setReviewTarget({ item: auditModal, decision: 'rejected' })
                      setAuditModal(null)
                    }}
                  >
                    Tolak
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setReviewTarget({ item: auditModal, decision: 'verified' })
                      setAuditModal(null)
                    }}
                  >
                    Sahkan
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {reviewTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-title"
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={() => !reviewing && closeReview()}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '480px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            <div>
              <h3 id="review-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                {reviewTarget.decision === 'verified' ? 'Sahkan verifikasi' : 'Tolak pengajuan'}
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {reviewTarget.item.namaUsaha} · {reviewTarget.item.namaPemilik}
              </p>
            </div>

            <div>
              <label htmlFor="review-note" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                Catatan untuk pemilik usaha (opsional)
              </label>
              <textarea
                id="review-note"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder={
                  reviewTarget.decision === 'verified'
                    ? 'Contoh: Pembukuan rapi, pertahankan pencatatan harian.'
                    : 'Contoh: NIB belum terunggah dan catatan kas baru 3 hari. Lengkapi lalu ajukan kembali.'
                }
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontFamily: 'inherit', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box' }}
              />
              <div style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{reviewNote.length}/500</div>
            </div>

            {reviewTarget.decision === 'rejected' && (
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#92400E', background: '#FEF3C7', padding: '8px 10px', borderRadius: '8px' }}>
                Setelah ditolak, pemilik usaha dapat mengajukan verifikasi kembali.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={closeReview} disabled={reviewing}>
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={submitReview}
                disabled={reviewing}
                style={reviewTarget.decision === 'rejected' ? { background: '#DC2626', borderColor: '#DC2626' } : undefined}
              >
                {reviewing ? 'Menyimpan...' : reviewTarget.decision === 'verified' ? 'Sahkan' : 'Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
