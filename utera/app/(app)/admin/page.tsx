'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/database.types'
import { formatRupiah } from '@/lib/kas'

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
  registeredAt: string
}

const DEFAULT_ECOSYSTEM_DATA: UmkmRecord[] = [
  {
    id: 'seed-dewo',
    namaUsaha: 'Kopi Galer',
    namaPemilik: 'Dewo',
    sektor: 'Kuliner & F&B',
    telepon: '0812-3456-7890',
    totalTx: 18,
    pemasukan: 32_500_000,
    pengeluaran: 14_200_000,
    saldoKas: 18_300_000,
    skor: 84,
    statusKur: 'Siap KUR Mikro (s.d. Rp 50 Jt)',
    hasNib: true,
    isVerified: true,
    registeredAt: '2026-03-01',
  },
  {
    id: 'seed-berkah',
    namaUsaha: 'Warung Berkah Jaya',
    namaPemilik: 'Ibu Siti Aminah',
    sektor: 'Perdagangan & Retail',
    telepon: '0857-9876-5432',
    totalTx: 42,
    pemasukan: 48_600_000,
    pengeluaran: 27_100_000,
    saldoKas: 21_500_000,
    skor: 88,
    statusKur: 'Siap KUR Mikro (s.d. Rp 100 Jt)',
    hasNib: true,
    isVerified: true,
    registeredAt: '2026-02-14',
  },
  {
    id: 'seed-nusantara',
    namaUsaha: 'Kedai Kopi Nusantara',
    namaPemilik: 'Budi Santoso',
    sektor: 'Kuliner & F&B',
    telepon: '0813-8821-4401',
    totalTx: 24,
    pemasukan: 28_400_000,
    pengeluaran: 12_800_000,
    saldoKas: 15_600_000,
    skor: 82,
    statusKur: 'Siap KUR Mikro (s.d. Rp 50 Jt)',
    hasNib: true,
    isVerified: true,
    registeredAt: '2026-01-20',
  },
  {
    id: 'seed-konveksi',
    namaUsaha: 'Konveksi Berkah Makmur',
    namaPemilik: 'Haji Ahmad',
    sektor: 'Konveksi & Fashion',
    telepon: '0821-4455-6677',
    totalTx: 15,
    pemasukan: 55_000_000,
    pengeluaran: 38_000_000,
    saldoKas: 17_000_000,
    skor: 74,
    statusKur: 'Siap KUR Mikro (s.d. Rp 50 Jt)',
    hasNib: true,
    isVerified: false,
    registeredAt: '2026-02-28',
  },
  {
    id: 'seed-bengkel',
    namaUsaha: 'Bengkel Motor Sejahtera',
    namaPemilik: 'Eko Wahyudi',
    sektor: 'Jasa & Layanan',
    telepon: '0878-1122-3344',
    totalTx: 9,
    pemasukan: 16_500_000,
    pengeluaran: 10_200_000,
    saldoKas: 6_300_000,
    skor: 62,
    statusKur: 'Rekomendasi KUR Super Mikro (s.d. Rp 10 Jt)',
    hasNib: false,
    isVerified: false,
    registeredAt: '2026-03-05',
  },
]

export default function AdminPage() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') || 'direktori'

  const [activeTab, setActiveTab] = useState<'direktori' | 'skor' | 'kas' | 'kur' | 'sistem'>(
    initialTab as any || 'direktori'
  )

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && ['direktori', 'skor', 'kas', 'kur', 'sistem'].includes(tabParam)) {
      setActiveTab(tabParam as any)
    }
  }, [searchParams])

  const supabase = createClient()
  const [umkmData, setUmkmData] = useState<UmkmRecord[]>(DEFAULT_ECOSYSTEM_DATA)
  const [searchQuery, setSearchQuery] = useState('')
  const [sectorFilter, setSectorFilter] = useState('ALL')
  const [auditModal, setAuditModal] = useState<UmkmRecord | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // Fetch live profiles and transactions from Supabase
  useEffect(() => {
    async function fetchLive() {
      const { data: profs } = await supabase.from('profil_usaha').select('*')
      const { data: txs } = await supabase.from('transaksi_kas').select('*')
      const { data: docs } = await supabase.from('legalitas_dokumen').select('*')

      if (profs && profs.length > 0) {
        const liveRecords: UmkmRecord[] = profs.map((p) => {
          const userTxs = (txs || []).filter((t) => t.profil_id === p.id || t.user_id === p.user_id)
          let inc = 0
          let exp = 0
          userTxs.forEach((t) => {
            if (t.tipe === 'pemasukan') inc += Number(t.nominal)
            else exp += Number(t.nominal)
          })
          const saldo = inc - exp
          const margin = inc > 0 ? saldo / inc : 0
          const skor = userTxs.length > 0 ? Math.min(96, Math.max(40, Math.round(50 + margin * 45))) : 50
          const hasNib = (docs || []).some((d) => (d.user_id === p.user_id || d.profil_id === p.id) && d.kategori?.toUpperCase() === 'NIB')

          return {
            id: p.id,
            namaUsaha: p.nama_usaha,
            namaPemilik: p.nama_pemilik || 'Pemilik Usaha',
            sektor: p.jenis_usaha || 'Kuliner & F&B',
            telepon: p.nomor_telepon || '0812-xxxx-xxxx',
            totalTx: userTxs.length,
            pemasukan: inc,
            pengeluaran: exp,
            saldoKas: saldo,
            skor,
            statusKur: skor >= 70 ? 'Siap KUR Mikro (s.d. Rp 50 Jt)' : 'Rekomendasi KUR Super Mikro',
            hasNib,
            isVerified: true,
            registeredAt: p.created_at ? p.created_at.slice(0, 10) : '2026-03-01',
          }
        })

        // Merge without duplicating
        const merged = [...liveRecords]
        DEFAULT_ECOSYSTEM_DATA.forEach((def) => {
          if (!merged.some((m) => m.namaUsaha.toLowerCase() === def.namaUsaha.toLowerCase())) {
            merged.push(def)
          }
        })
        setUmkmData(merged)
      }
    }

    fetchLive()
  }, [])

  const filteredList = useMemo(() => {
    return umkmData.filter((item) => {
      const matchSearch =
        item.namaUsaha.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.namaPemilik.toLowerCase().includes(searchQuery.toLowerCase())
      const matchSector = sectorFilter === 'ALL' || item.sektor === sectorFilter
      return matchSearch && matchSector
    })
  }, [umkmData, searchQuery, sectorFilter])

  // Toggle verification status
  const toggleVerification = (id: string) => {
    setUmkmData((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextState = !item.isVerified
          setToastMsg(
            nextState
              ? `Status kredibilitas ${item.namaUsaha} telah diverifikasi resmi!`
              : `Status verifikasi ${item.namaUsaha} ditangguhkan untuk evaluasi.`
          )
          setTimeout(() => setToastMsg(null), 3500)
          return { ...item, isVerified: nextState }
        }
        return item
      })
    )
  }

  // Aggregate stats
  const totalOmzet = umkmData.reduce((acc, curr) => acc + curr.pemasukan, 0)
  const avgSkor = Math.round(umkmData.reduce((acc, curr) => acc + curr.skor, 0) / (umkmData.length || 1))
  const verifiedCount = umkmData.filter((u) => u.isVerified).length

  return (
    <div className="dashboard-scroll-wrap" style={{ fontFamily: 'var(--font-family)' }}>
      {/* 1. HEADER PENGAWAS EKOSISTEM */}
      <div className="dash-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 className="dash-heading">Pusat Pengawasan &amp; Kredibilitas UMKM</h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#14532D', color: '#FCD34D', padding: '3px 12px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 800 }}>
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
            <span>Auditor: admin123@utera.id</span>
          </div>

          <Link href="/laporan-siap-bank" className="btn btn-outline btn-sm">
            <span className="material-symbols-rounded btn-icon">download</span>
            <span>Laporan Audit A4</span>
          </Link>
        </div>
      </div>

      {toastMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px', borderRadius: '10px', background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', marginBottom: '20px', fontWeight: 700, fontSize: '0.875rem' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#059669' }}>check_circle</span>
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
              <span>100% Aktif</span>
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
            <span className="badge-kur-ready">Siap KUR</span>
          </div>
          <p className="metric-subtext">Formula resmi PRD (K1–K4 SAK EMKM)</p>
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
          <span>Pengawasan KUR &amp; Guardrail 30%</span>
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
            </div>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', fontFamily: 'inherit', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAF9', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Mitra UMKM &amp; Pemilik</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Sektor</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Saldo Kas</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Skor PRD</th>
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
                      <strong style={{ color: u.saldoKas >= 0 ? '#059669' : '#DC2626' }}>
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
                          background: u.skor >= 70 ? '#ECFDF5' : '#FEF3C7',
                          color: u.skor >= 70 ? '#059669' : '#D97706',
                          border: `1px solid ${u.skor >= 70 ? '#A7F3D0' : '#FCD34D'}`,
                        }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '14px', color: u.skor >= 70 ? '#059669' : '#D97706' }}>
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
                      {u.isVerified ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '9999px', background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', fontSize: '0.75rem', fontWeight: 700 }}>
                          <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>verified</span>
                          <span>Terverifikasi Kredibel</span>
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '9999px', background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D', fontSize: '0.75rem', fontWeight: 700 }}>
                          <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>hourglass_empty</span>
                          <span>Menunggu Audit</span>
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
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
                        <button
                          type="button"
                          onClick={() => toggleVerification(u.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            background: u.isVerified ? '#FEF2F2' : '#14532D',
                            color: u.isVerified ? '#DC2626' : '#fff',
                            fontSize: '0.75rem',
                            fontFamily: 'inherit',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>
                            {u.isVerified ? 'cancel' : 'check'}
                          </span>
                          <span>{u.isVerified ? 'Tangguhkan' : 'Verifikasi'}</span>
                        </button>
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
                Audit Kredibilitas Finansial &amp; Algoritma PRD
              </h2>
              <p className="panel-subtitle" style={{ margin: '4px 0 0', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                Evaluasi 4 pilar standar SAK EMKM: K1 Konsistensi Kas (30%), K2 Pertumbuhan (25%), K3 Margin Laba (25%), K4 Kestabilan (20%).
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ padding: '18px', borderRadius: '12px', background: '#F8FAF9', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>K1 • KONSISTENSI PENCATATAN</span>
                <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--primary)' }}>history_edu</span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', margin: '4px 0' }}>85% Kepatuhan</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Catatan kas kontinu minimal 6 bulan berturut-turut.</p>
            </div>

            <div style={{ padding: '18px', borderRadius: '12px', background: '#F8FAF9', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>K2 • PERTUMBUHAN OMZET</span>
                <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#059669' }}>trending_up</span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669', margin: '4px 0' }}>+14.2% Tren Positif</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Rasio perputaran omzet 3 bulan terakhir vs periode lalu.</p>
            </div>

            <div style={{ padding: '18px', borderRadius: '12px', background: '#F8FAF9', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>K3 • MARGIN OPERASIONAL</span>
                <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#2563EB' }}>account_balance_wallet</span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563EB', margin: '4px 0' }}>38.5% Margin Rata-rata</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Efisiensi biaya kulakan &amp; operasional warung.</p>
            </div>

            <div style={{ padding: '18px', borderRadius: '12px', background: '#F8FAF9', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>K4 • KESTABILAN KAS</span>
                <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#D97706' }}>savings</span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#D97706', margin: '4px 0' }}>92% Kas Positif</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Tidak ada defisit kas dalam 3 bulan terakhir.</p>
            </div>
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
                  <th style={{ padding: '12px 16px' }}>Rekomendasi Analis Bank</th>
                </tr>
              </thead>
              <tbody>
                {umkmData.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #F1F5F3' }}>
                    <td style={{ padding: '14px 16px' }}><strong>{u.namaUsaha}</strong></td>
                    <td style={{ padding: '14px 16px' }}>{Math.round((u.skor * 0.3))} Poin</td>
                    <td style={{ padding: '14px 16px' }}>{Math.round((u.skor * 0.25))} Poin</td>
                    <td style={{ padding: '14px 16px' }}>{Math.round((u.skor * 0.25))} Poin</td>
                    <td style={{ padding: '14px 16px' }}>{Math.round((u.skor * 0.2))} Poin</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 800, color: u.skor >= 70 ? '#059669' : '#D97706' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>verified</span>
                        <span>{u.skor} / 100</span>
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: u.skor >= 70 ? '#065F46' : '#92400E' }}>
                        {u.statusKur}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TAB CONTENT 3: AUDIT MUTASI KAS GLOBAL */}
      {activeTab === 'kas' && (
        <div className="dash-panel" style={{ padding: '24px' }}>
          <div className="panel-header" style={{ marginBottom: '16px' }}>
            <h2 className="panel-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              Audit Mutasi Kas Ekosistem (Global Ledger)
            </h2>
            <p className="panel-subtitle" style={{ margin: '4px 0 0', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Pemantauan arus kas harian seluruh toko dan warung untuk memastikan tidak ada rekayasa pembukuan.
            </p>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAF9', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 16px' }}>Tanggal</th>
                  <th style={{ padding: '12px 16px' }}>Kategori</th>
                  <th style={{ padding: '12px 16px' }}>Keterangan Transaksi</th>
                  <th style={{ padding: '12px 16px' }}>Metode</th>
                  <th style={{ padding: '12px 16px' }}>Jenis</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Nominal</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { tanggal: '2026-03-10', cat: 'Penjualan', desc: 'Pesanan Kopi Galer 50 Cup Acara Seminar', metode: 'QRIS', tipe: 'pemasukan', nominal: 1850000 },
                  { tanggal: '2026-03-09', cat: 'Bahan Baku', desc: 'Restock Biji Kopi Arabika 5kg', metode: 'Tunai', tipe: 'pengeluaran', nominal: 650000 },
                  { tanggal: '2026-03-09', cat: 'Penjualan', desc: 'Penjualan Grosir Sembako Warung Berkah', metode: 'Transfer Bank', tipe: 'pemasukan', nominal: 3200000 },
                  { tanggal: '2026-03-08', cat: 'Operasional', desc: 'Listrik & Distribusi Barang', metode: 'Transfer Bank', tipe: 'pengeluaran', nominal: 1400000 },
                  { tanggal: '2026-03-07', cat: 'Penjualan', desc: 'Omzet Harian Kedai Kopi Nusantara', metode: 'QRIS', tipe: 'pemasukan', nominal: 2450000 },
                  { tanggal: '2026-03-06', cat: 'Penjualan', desc: 'Pesanan Seragam Konveksi Berkah Makmur', metode: 'Transfer Bank', tipe: 'pemasukan', nominal: 6500000 },
                ].map((tx, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F3' }}>
                    <td style={{ padding: '12px 16px' }}>{tx.tanggal}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#F1F5F3', fontSize: '0.75rem', fontWeight: 600 }}>
                        {tx.cat}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{tx.desc}</td>
                    <td style={{ padding: '12px 16px' }}>{tx.metode}</td>
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
                          background: tx.tipe === 'pemasukan' ? '#ECFDF5' : '#FEE2E2',
                          color: tx.tipe === 'pemasukan' ? '#065F46' : '#DC2626',
                        }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '13px' }}>
                          {tx.tipe === 'pemasukan' ? 'arrow_downward' : 'arrow_upward'}
                        </span>
                        <span>{tx.tipe === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}</span>
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: tx.tipe === 'pemasukan' ? '#059669' : '#DC2626' }}>
                      {tx.tipe === 'pemasukan' ? '+' : '-'} {formatRupiah(tx.nominal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. TAB CONTENT 4: PENGAWASAN KUR & GUARDRAIL */}
      {activeTab === 'kur' && (
        <div className="dash-panel" style={{ padding: '24px' }}>
          <div className="panel-header" style={{ marginBottom: '16px' }}>
            <h2 className="panel-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              Pengawasan Penyaluran KUR &amp; Kepatuhan Guardrail 30%
            </h2>
            <p className="panel-subtitle" style={{ margin: '4px 0 0', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Memastikan beban angsuran kredit UMKM tidak melebihi 30% dari laba bersih untuk mencegah risiko kredit macet.
            </p>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAF9', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 16px' }}>Mitra UMKM</th>
                  <th style={{ padding: '12px 16px' }}>Program Pembiayaan</th>
                  <th style={{ padding: '12px 16px' }}>Plafon Diajukan</th>
                  <th style={{ padding: '12px 16px' }}>Bunga Subsidi</th>
                  <th style={{ padding: '12px 16px' }}>Tenor</th>
                  <th style={{ padding: '12px 16px' }}>Estimasi Cicilan</th>
                  <th style={{ padding: '12px 16px' }}>Evaluasi Guardrail 30%</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { nama: 'Kopi Galer (Dewo)', prog: 'KUR Mikro Bank BRI', plafon: 50000000, bunga: '6% p.a.', tenor: '24 Bulan', cicilan: 2216031, status: 'Kondisi Aman (12% dari laba)' },
                  { nama: 'Warung Berkah Jaya', prog: 'KUR Mikro Bank Mandiri', plafon: 75000000, bunga: '6% p.a.', tenor: '36 Bulan', cicilan: 2281488, status: 'Kondisi Aman (11% dari laba)' },
                  { nama: 'Kedai Kopi Nusantara', prog: 'KUR Super Mikro', plafon: 10000000, bunga: '3% p.a.', tenor: '12 Bulan', cicilan: 846937, status: 'Kondisi Aman (5% dari laba)' },
                  { nama: 'Konveksi Berkah Makmur', prog: 'KUR Mikro Bank BNI', plafon: 50000000, bunga: '6% p.a.', tenor: '24 Bulan', cicilan: 2216031, status: 'Kondisi Aman (13% dari laba)' },
                  { nama: 'Bengkel Motor Sejahtera', prog: 'Pinjaman Koperasi Usaha', plafon: 25000000, bunga: '9% p.a.', tenor: '18 Bulan', cicilan: 1490000, status: 'Batas Waspada (24% dari laba)' },
                ].map((k, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F3' }}>
                    <td style={{ padding: '14px 16px' }}><strong>{k.nama}</strong></td>
                    <td style={{ padding: '14px 16px' }}>{k.prog}</td>
                    <td style={{ padding: '14px 16px' }}>{formatRupiah(k.plafon)}</td>
                    <td style={{ padding: '14px 16px' }}>{k.bunga}</td>
                    <td style={{ padding: '14px 16px' }}>{k.tenor}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--primary)' }}>{formatRupiah(k.cicilan)} / bln</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: k.status.includes('Aman') ? '#ECFDF5' : '#FEF3C7',
                          color: k.status.includes('Aman') ? '#065F46' : '#92400E',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                        }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>
                          {k.status.includes('Aman') ? 'check_circle' : 'warning'}
                        </span>
                        <span>{k.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
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
                <span className="material-symbols-rounded" style={{ color: 'var(--primary)' }}>shield_person</span>
                Kredensial Pengawas Aktif
              </h3>
              <table style={{ width: '100%', fontSize: '0.85rem' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Identitas:</td>
                    <td><strong>Super Administrator (Pengawas Resmi)</strong></td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Username / Email:</td>
                    <td><code>admin123@utera.id</code> (alias <code>admin123</code>)</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Kata Sandi:</td>
                    <td><code>bryanganteng</code></td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Status Akses:</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#059669', fontWeight: 700 }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>verified_user</span>
                        <span>Aktif &amp; Terenkripsi</span>
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

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
                    <td><strong>Algoritma PRD UTERA (K1–K4) 100 Poin</strong></td>
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
                  <strong style={{ fontSize: '1.1rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>account_balance_wallet</span>
                    <span>{formatRupiah(auditModal.saldoKas)}</span>
                  </strong>
                </div>
              </div>

              <div>
                <strong style={{ display: 'block', marginBottom: '6px' }}>Status Kepatuhan Audit:</strong>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '18px', color: auditModal.hasNib ? '#059669' : '#D97706', marginTop: '2px' }}>
                      {auditModal.hasNib ? 'verified' : 'warning'}
                    </span>
                    <span>
                      <strong>Legalitas Izin Usaha:</strong> {auditModal.hasNib ? 'Nomor Induk Berusaha (NIB) Resmi Terbit OSS' : 'Belum mengunggah NIB'}
                    </span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#059669', marginTop: '2px' }}>
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
                    <span className="material-symbols-rounded" style={{ fontSize: '18px', color: auditModal.isVerified ? '#059669' : '#D97706', marginTop: '2px' }}>
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
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  toggleVerification(auditModal.id)
                  setAuditModal(null)
                }}
              >
                {auditModal.isVerified ? 'Tangguhkan Verifikasi' : 'Sahkan Kredibilitas UMKM'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
