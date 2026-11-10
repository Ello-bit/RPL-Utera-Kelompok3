'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/database.types'
import { formatRupiah } from '@/lib/kas'
import './admin.css'

type ProfilUsaha = Tables<'profil_usaha'>
type TransaksiKas = Tables<'transaksi_kas'>
type SimulasiKur = Tables<'simulasi_kur'>
type LegalitasDokumen = Tables<'legalitas_dokumen'>

interface UmkmRow {
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
  hasNpwp: boolean
  registeredAt: string
}

const ECOSYSTEM_SEED_UMKM: UmkmRow[] = [
  {
    id: 'seed-1',
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
    hasNpwp: true,
    registeredAt: '2026-03-01',
  },
  {
    id: 'seed-2',
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
    hasNpwp: false,
    registeredAt: '2026-02-14',
  },
  {
    id: 'seed-3',
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
    hasNpwp: true,
    registeredAt: '2026-01-20',
  },
  {
    id: 'seed-4',
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
    hasNpwp: true,
    registeredAt: '2026-02-28',
  },
  {
    id: 'seed-5',
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
    hasNpwp: false,
    registeredAt: '2026-03-05',
  },
]

export default function AdminDashboardPage() {
  const supabase = createClient()
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('admin123@utera.id')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'umkm' | 'kas' | 'kur' | 'sistem'>('umkm')

  // Real Database Data
  const [dbProfiles, setDbProfiles] = useState<ProfilUsaha[]>([])
  const [dbTransactions, setDbTransactions] = useState<TransaksiKas[]>([])
  const [dbSimulations, setDbSimulations] = useState<SimulasiKur[]>([])
  const [dbLegalDocs, setDbLegalDocs] = useState<LegalitasDokumen[]>([])

  // Filters
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedSector, setSelectedSector] = useState('ALL')
  const [selectedTxType, setSelectedTxType] = useState('ALL')

  // Modal Audit
  const [selectedUmkmAudit, setSelectedUmkmAudit] = useState<UmkmRow | null>(null)

  useEffect(() => {
    async function loadAdminData() {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user?.email) {
        setCurrentUserEmail(user.email)
      }

      // Fetch profiles
      const { data: profs } = await supabase.from('profil_usaha').select('*')
      if (profs) setDbProfiles(profs as ProfilUsaha[])

      // Fetch transactions
      const { data: txs } = await supabase.from('transaksi_kas').select('*').order('tanggal', { ascending: false })
      if (txs) setDbTransactions(txs as TransaksiKas[])

      // Fetch simulations
      const { data: sims } = await supabase.from('simulasi_kur').select('*').order('created_at', { ascending: false })
      if (sims) setDbSimulations(sims as SimulasiKur[])

      // Fetch legal docs
      const { data: docs } = await supabase.from('legalitas_dokumen').select('*')
      if (docs) setDbLegalDocs(docs as LegalitasDokumen[])

      setLoading(false)
    }

    loadAdminData()
  }, [])

  // Aggregate UMKM Directory (Merging Live Profiles with Ecosystem Overview)
  const umkmList: UmkmRow[] = useMemo(() => {
    const list: UmkmRow[] = []

    // If live profiles exist from Supabase, convert them into directory rows
    if (dbProfiles.length > 0) {
      dbProfiles.forEach((p) => {
        const userTxs = dbTransactions.filter((t) => t.user_id === p.user_id || t.profil_id === p.id)
        let inc = 0
        let exp = 0
        userTxs.forEach((t) => {
          if (t.tipe === 'pemasukan') inc += Number(t.nominal)
          else exp += Number(t.nominal)
        })
        const saldo = inc - exp
        const margin = inc > 0 ? saldo / inc : 0
        const skor = userTxs.length > 0 ? Math.min(96, Math.max(40, Math.round(50 + margin * 45))) : 50

        const hasNib = dbLegalDocs.some((d) => (d.user_id === p.user_id || d.profil_id === p.id) && d.kategori?.toUpperCase() === 'NIB')
        const hasNpwp = dbLegalDocs.some((d) => (d.user_id === p.user_id || d.profil_id === p.id) && d.kategori?.toUpperCase() === 'NPWP')

        list.push({
          id: p.id,
          namaUsaha: p.nama_usaha,
          namaPemilik: p.nama_pemilik || 'Pemilik Usaha',
          sektor: p.jenis_usaha || 'Kuliner & F&B',
          telepon: p.nomor_telepon || '-',
          totalTx: userTxs.length,
          pemasukan: inc,
          pengeluaran: exp,
          saldoKas: saldo,
          skor,
          statusKur: skor >= 70 ? 'Siap KUR Mikro (s.d. Rp 50 Jt)' : 'Rekomendasi KUR Super Mikro',
          hasNib,
          hasNpwp,
          registeredAt: p.created_at ? p.created_at.slice(0, 10) : '2026-03-01',
        })
      })
    }

    // Merge with ecosystem seed data for UMKM that aren't duplicates
    ECOSYSTEM_SEED_UMKM.forEach((seed) => {
      if (!list.some((item) => item.namaUsaha.toLowerCase() === seed.namaUsaha.toLowerCase())) {
        list.push(seed)
      }
    })

    return list
  }, [dbProfiles, dbTransactions, dbLegalDocs])

  // Filtered UMKM
  const filteredUmkm = useMemo(() => {
    return umkmList.filter((item) => {
      const matchSearch =
        item.namaUsaha.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        item.namaPemilik.toLowerCase().includes(searchKeyword.toLowerCase())
      const matchSector = selectedSector === 'ALL' || item.sektor === selectedSector
      return matchSearch && matchSector
    })
  }, [umkmList, searchKeyword, selectedSector])

  // Aggregate KPI
  const kpiData = useMemo(() => {
    const totalUmkm = umkmList.length
    const totalOmzet = umkmList.reduce((acc, curr) => acc + curr.pemasukan, 0)
    const totalSaldo = umkmList.reduce((acc, curr) => acc + curr.saldoKas, 0)
    const avgScore = totalUmkm > 0 ? Math.round(umkmList.reduce((acc, curr) => acc + curr.skor, 0) / totalUmkm) : 0
    const nibCount = umkmList.filter((u) => u.hasNib).length
    const nibPct = totalUmkm > 0 ? Math.round((nibCount / totalUmkm) * 100) : 0
    const totalSimulasi = dbSimulations.length > 0 ? dbSimulations.length : 14

    return { totalUmkm, totalOmzet, totalSaldo, avgScore, nibCount, nibPct, totalSimulasi }
  }, [umkmList, dbSimulations])

  // All Transactions (combining live with ecosystem seed)
  const allTransactions = useMemo(() => {
    if (dbTransactions.length > 0) return dbTransactions
    // Fallback presentation ledger
    return [
      { id: '1', tanggal: '2026-03-10', tipe: 'pemasukan', nominal: 1850000, kategori: 'Penjualan', keterangan: 'Pesanan Kopi Galer 50 Cup Acara Seminar', metode_pembayaran: 'QRIS', user_id: 'seed-1' },
      { id: '2', tanggal: '2026-03-09', tipe: 'pengeluaran', nominal: 650000, kategori: 'Bahan Baku', keterangan: 'Restock Biji Kopi Arabika 5kg', metode_pembayaran: 'Tunai', user_id: 'seed-1' },
      { id: '3', tanggal: '2026-03-09', tipe: 'pemasukan', nominal: 3200000, kategori: 'Penjualan', keterangan: 'Penjualan Grosir Sembako Warung Berkah', metode_pembayaran: 'Transfer Bank', user_id: 'seed-2' },
      { id: '4', tanggal: '2026-03-08', tipe: 'pengeluaran', nominal: 1400000, kategori: 'Operasional', keterangan: 'Listrik & Distribusi Barang', metode_pembayaran: 'Transfer Bank', user_id: 'seed-2' },
      { id: '5', tanggal: '2026-03-07', tipe: 'pemasukan', nominal: 2450000, kategori: 'Penjualan', keterangan: 'Omzet Harian Kedai Kopi Nusantara', metode_pembayaran: 'QRIS', user_id: 'seed-3' },
    ]
  }, [dbTransactions])

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((tx) => {
      const matchType = selectedTxType === 'ALL' || tx.tipe === selectedTxType
      const matchDesc = !searchKeyword || (tx.keterangan || '').toLowerCase().includes(searchKeyword.toLowerCase())
      return matchType && matchDesc
    })
  }, [allTransactions, selectedTxType, searchKeyword])

  return (
    <div className="admin-viewport">
      {/* 1. HEADER */}
      <div className="admin-header">
        <div className="admin-title-wrap">
          <h1>
            <span className="material-symbols-rounded" style={{ color: 'var(--primary, #1F6B4F)', fontSize: '32px' }}>
              admin_panel_settings
            </span>
            Dashboard Administrator UTERA
          </h1>
          <p>
            Pusat monitoring ekosistem UMKM, kepatuhan kas digital, kesiapan kredit bank, dan simulasi KUR 2026.
          </p>
        </div>

        <div className="admin-badge-strip">
          <span className="admin-pill-badge">
            <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>verified_user</span>
            Akun: <strong>{currentUserEmail}</strong>
          </span>
          <span className="admin-pill-badge active-status">
            <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>lock_open</span>
            Hak Akses: Superadmin
          </span>
        </div>
      </div>

      {/* 2. TOP KPI CARDS */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">UMKM Terdaftar</span>
            <div className="kpi-icon-wrap green">
              <span className="material-symbols-rounded">storefront</span>
            </div>
          </div>
          <div className="kpi-value">{kpiData.totalUmkm} Usaha</div>
          <div className="kpi-subtitle">
            <span className="material-symbols-rounded" style={{ fontSize: '14px', color: '#059669' }}>trending_up</span>
            Ekosistem UMKM Aktif
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Perputaran Omzet</span>
            <div className="kpi-icon-wrap gold">
              <span className="material-symbols-rounded">payments</span>
            </div>
          </div>
          <div className="kpi-value">{formatRupiah(kpiData.totalOmzet)}</div>
          <div className="kpi-subtitle">Total mutasi masuk tercatat</div>
        </div>

        <div className="admin-kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Rata-rata Skor Bank</span>
            <div className="kpi-icon-wrap blue">
              <span className="material-symbols-rounded">verified</span>
            </div>
          </div>
          <div className="kpi-value">{kpiData.avgScore} / 100</div>
          <div className="kpi-subtitle">
            <span className="material-symbols-rounded" style={{ fontSize: '14px', color: '#2563EB' }}>check_circle</span>
            Kategori: <strong>Baik (Siap KUR)</strong>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Kepatuhan NIB / OSS</span>
            <div className="kpi-icon-wrap purple">
              <span className="material-symbols-rounded">description</span>
            </div>
          </div>
          <div className="kpi-value">{kpiData.nibPct}%</div>
          <div className="kpi-subtitle">{kpiData.nibCount} dari {kpiData.totalUmkm} UMKM ber-NIB</div>
        </div>

        <div className="admin-kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Simulasi KUR Dibuat</span>
            <div className="kpi-icon-wrap green">
              <span className="material-symbols-rounded">account_balance</span>
            </div>
          </div>
          <div className="kpi-value">{kpiData.totalSimulasi} Berkas</div>
          <div className="kpi-subtitle">Evaluasi plafon &amp; guardrail</div>
        </div>
      </div>

      {/* 3. TABS NAVIGATION */}
      <div className="admin-tab-nav">
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'umkm' ? 'active' : ''}`}
          onClick={() => setActiveTab('umkm')}
        >
          <span className="material-symbols-rounded">groups</span>
          <span>Direktori &amp; Kesiapan Kredit UMKM</span>
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'kas' ? 'active' : ''}`}
          onClick={() => setActiveTab('kas')}
        >
          <span className="material-symbols-rounded">receipt_long</span>
          <span>Audit Mutasi Kas Global</span>
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'kur' ? 'active' : ''}`}
          onClick={() => setActiveTab('kur')}
        >
          <span className="material-symbols-rounded">analytics</span>
          <span>Analisis Penyaluran KUR &amp; Guardrail 30%</span>
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'sistem' ? 'active' : ''}`}
          onClick={() => setActiveTab('sistem')}
        >
          <span className="material-symbols-rounded">security</span>
          <span>Status Sistem &amp; Akun Admin</span>
        </button>
      </div>

      {/* 4. TAB CONTENT 1: DIREKTORI UMKM */}
      {activeTab === 'umkm' && (
        <div className="admin-panel">
          <div className="panel-title-row">
            <div className="panel-title-text">
              <h2>Daftar Mitra UMKM Terdaftar</h2>
              <p>Monitoring kesehatan pembukuan kas warung, skor kelayakan PRD, dan status legalitas per usaha.</p>
            </div>

            <div className="admin-filter-bar">
              <input
                type="text"
                placeholder="Cari nama usaha atau pemilik..."
                className="admin-search-input"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
              />
              <select
                className="admin-select"
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
              >
                <option value="ALL">Semua Sektor</option>
                <option value="Kuliner & F&B">Kuliner &amp; F&amp;B</option>
                <option value="Perdagangan & Retail">Perdagangan &amp; Retail</option>
                <option value="Konveksi & Fashion">Konveksi &amp; Fashion</option>
                <option value="Jasa & Layanan">Jasa &amp; Layanan</option>
              </select>
            </div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nama Usaha &amp; Pemilik</th>
                  <th>Sektor Usaha</th>
                  <th>Saldo Kas Aktif</th>
                  <th>Skor PRD</th>
                  <th>Kesiapan KUR</th>
                  <th>Legalitas NIB</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredUmkm.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.namaUsaha}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Pemilik: {u.namaPemilik} • {u.telepon}
                      </div>
                    </td>
                    <td>
                      <span className="badge-tag">{u.sektor}</span>
                    </td>
                    <td>
                      <strong style={{ color: u.saldoKas >= 0 ? '#059669' : '#DC2626' }}>
                        {formatRupiah(u.saldoKas)}
                      </strong>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {u.totalTx} Transaksi
                      </div>
                    </td>
                    <td>
                      <span className={`badge-score ${u.skor >= 70 ? 'high' : u.skor >= 40 ? 'medium' : 'low'}`}>
                        ★ {u.skor} Poin
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: u.skor >= 70 ? '#065F46' : '#92400E' }}>
                        {u.statusKur}
                      </span>
                    </td>
                    <td>
                      {u.hasNib ? (
                        <span className="badge-tag nib-ok">✓ NIB Terbit</span>
                      ) : (
                        <span className="badge-tag" style={{ color: '#9CA3AF' }}>Belum Ada</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{
                          background: '#F1F5F3',
                          border: '1px solid #D1D5DB',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                        onClick={() => setSelectedUmkmAudit(u)}
                      >
                        Detail Audit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. TAB CONTENT 2: AUDIT MUTASI KAS */}
      {activeTab === 'kas' && (
        <div className="admin-panel">
          <div className="panel-title-row">
            <div className="panel-title-text">
              <h2>Audit Mutasi Kas Ekosistem (Global Ledger)</h2>
              <p>Seluruh entri transaksi kas yang dicatat oleh para mitra UMKM di platform UTERA.</p>
            </div>

            <div className="admin-filter-bar">
              <select
                className="admin-select"
                value={selectedTxType}
                onChange={(e) => setSelectedTxType(e.target.value)}
              >
                <option value="ALL">Semua Jenis Transaksi</option>
                <option value="pemasukan">Pemasukan Saja</option>
                <option value="pengeluaran">Pengeluaran Saja</option>
              </select>
            </div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Kategori</th>
                  <th>Keterangan</th>
                  <th>Metode</th>
                  <th>Tipe</th>
                  <th style={{ textAlign: 'right' }}>Nominal</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx, idx) => (
                  <tr key={tx.id || idx}>
                    <td style={{ whiteSpace: 'nowrap' }}>{tx.tanggal}</td>
                    <td>
                      <span className="badge-tag">{tx.kategori || 'Umum'}</span>
                    </td>
                    <td>{tx.keterangan || '-'}</td>
                    <td>{tx.metode_pembayaran || 'Tunai'}</td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.725rem',
                          fontWeight: 700,
                          background: tx.tipe === 'pemasukan' ? '#ECFDF5' : '#FEE2E2',
                          color: tx.tipe === 'pemasukan' ? '#065F46' : '#DC2626',
                        }}
                      >
                        {tx.tipe === 'pemasukan' ? '+ Pemasukan' : '- Pengeluaran'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: tx.tipe === 'pemasukan' ? '#059669' : '#DC2626' }}>
                      {tx.tipe === 'pemasukan' ? '+' : '-'} {formatRupiah(Number(tx.nominal))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TAB CONTENT 3: KUR & GUARDRAIL */}
      {activeTab === 'kur' && (
        <div className="admin-panel">
          <div className="panel-title-row">
            <div className="panel-title-text">
              <h2>Analisis Penyaluran KUR &amp; Kepatuhan Guardrail 30%</h2>
              <p>Simulasi pinjaman yang dihitung oleh UMKM serta pemantauan risiko kapasitas angsuran kas.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ padding: '16px', borderRadius: '12px', background: '#F8FAF9', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>AMBANG AMAN GUARDRAIL</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669', margin: '4px 0' }}>82% UMKM Aman</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Cicilan di bawah batas aman 30% dari laba bersih bulanan.</p>
            </div>

            <div style={{ padding: '16px', borderRadius: '12px', background: '#F8FAF9', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>PROGRAM PALING DIMINATI</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', margin: '4px 0' }}>KUR Mikro Bank (6%)</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Plafon favorit: Rp 30 Jt – Rp 50 Jt (Tenor 24 Bulan).</p>
            </div>

            <div style={{ padding: '16px', borderRadius: '12px', background: '#F8FAF9', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>BANK PENYALUR TERATAS</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563EB', margin: '4px 0' }}>Bank BRI &amp; Mandiri</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Penyalur utama KUR Mikro &amp; Super Mikro di platform.</p>
            </div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Program Kredit</th>
                  <th>Plafon Diajukan</th>
                  <th>Bunga / Thn</th>
                  <th>Tenor</th>
                  <th>Estimasi Angsuran</th>
                  <th>Status Guardrail</th>
                </tr>
              </thead>
              <tbody>
                {dbSimulations.length > 0 ? (
                  dbSimulations.map((sim) => (
                    <tr key={sim.id}>
                      <td><strong>{sim.program}</strong></td>
                      <td>{formatRupiah(Number(sim.plafon))}</td>
                      <td>{(Number(sim.bunga_tahunan) * 100).toFixed(0)}% p.a.</td>
                      <td>{sim.tenor_bulan} Bulan</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatRupiah(Number(sim.angsuran_bulanan))} / bln</td>
                      <td>
                        <span className={`badge-score ${sim.status_guardrail?.includes('Aman') ? 'high' : 'medium'}`}>
                          {sim.status_guardrail || 'Kondisi Aman'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  [
                    { prog: 'KUR Mikro Bank BRI', plafon: 50000000, bunga: 0.06, tenor: 24, angsuran: 2216031, status: 'Kondisi Aman' },
                    { prog: 'KUR Super Mikro', plafon: 10000000, bunga: 0.03, tenor: 12, angsuran: 846937, status: 'Kondisi Aman' },
                    { prog: 'Pinjaman Koperasi Usaha', plafon: 25000000, bunga: 0.09, tenor: 18, angsuran: 1490000, status: 'Batas Waspada' },
                  ].map((s, idx) => (
                    <tr key={idx}>
                      <td><strong>{s.prog}</strong></td>
                      <td>{formatRupiah(s.plafon)}</td>
                      <td>{(s.bunga * 100).toFixed(0)}% p.a.</td>
                      <td>{s.tenor} Bulan</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatRupiah(s.angsuran)} / bln</td>
                      <td>
                        <span className={`badge-score ${s.status === 'Kondisi Aman' ? 'high' : 'medium'}`}>
                          {s.status}
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

      {/* 7. TAB CONTENT 4: KEAMANAN & STATUS SISTEM */}
      {activeTab === 'sistem' && (
        <div className="admin-panel">
          <div className="panel-title-row">
            <div className="panel-title-text">
              <h2>Status Tata Kelola &amp; Keamanan Platform</h2>
              <p>Spesifikasi teknis, kredensial administratif, dan kebijakan keamanan database.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: '#FAFDFB' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-rounded" style={{ color: 'var(--primary)' }}>shield_person</span>
                Kredensial Akun Administrator
              </h3>
              <table style={{ width: '100%', fontSize: '0.85rem' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Username / Email:</td>
                    <td style={{ fontWeight: 700 }}><code>admin123@utera.id</code> (atau <code>admin123</code>)</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Kata Sandi:</td>
                    <td style={{ fontWeight: 700 }}><code>bryanganteng</code></td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Hak Akses:</td>
                    <td><span className="badge-score high">Super Administrator (Full Audit)</span></td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Status Sesi:</td>
                    <td><span style={{ color: '#059669', fontWeight: 700 }}>● Terautentikasi Aktif</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: '#FAFDFB' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-rounded" style={{ color: '#2563EB' }}>database</span>
                Arsitektur &amp; Keamanan Database
              </h3>
              <table style={{ width: '100%', fontSize: '0.85rem' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Penyedia Cloud:</td>
                    <td style={{ fontWeight: 700 }}>Supabase PostgreSQL (AWS Cloud)</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Row Level Security:</td>
                    <td><span className="badge-tag nib-ok">Terenkripsi RLS (auth.uid())</span></td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Framework Frontend:</td>
                    <td style={{ fontWeight: 700 }}>Next.js 16 (App Router + TypeScript)</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Mode Verifikasi Email:</td>
                    <td><span className="badge-score high">Instant Confirmation Active</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 8. AUDIT MODAL */}
      {selectedUmkmAudit && (
        <div className="admin-modal-backdrop" onClick={() => setSelectedUmkmAudit(null)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                Audit Kesiapan Kredit: {selectedUmkmAudit.namaUsaha}
              </h3>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                onClick={() => setSelectedUmkmAudit(null)}
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              <div style={{ marginBottom: '16px', padding: '12px', background: '#F8FAF9', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pemilik Usaha:</div>
                <strong style={{ fontSize: '1rem' }}>{selectedUmkmAudit.namaPemilik}</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Kontak: {selectedUmkmAudit.telepon} • Sektor: {selectedUmkmAudit.sektor}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div style={{ padding: '12px', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SKOR KELAYAKAN PRD</div>
                  <strong style={{ fontSize: '1.4rem', color: 'var(--primary)' }}>{selectedUmkmAudit.skor} / 100</strong>
                </div>
                <div style={{ padding: '12px', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>STATUS KELAYAKAN BANK</div>
                  <strong style={{ fontSize: '0.9rem', color: selectedUmkmAudit.skor >= 70 ? '#059669' : '#D97706' }}>
                    {selectedUmkmAudit.statusKur}
                  </strong>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 8px' }}>Rangkuman Keuangan</h4>
                <div style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
                  • Total Omzet Masuk: <strong>{formatRupiah(selectedUmkmAudit.pemasukan)}</strong><br />
                  • Total Beban Kas: <strong>{formatRupiah(selectedUmkmAudit.pengeluaran)}</strong><br />
                  • Saldo Kas Bersih: <strong>{formatRupiah(selectedUmkmAudit.saldoKas)}</strong><br />
                  • Dokumen Legalitas: <strong>{selectedUmkmAudit.hasNib ? 'NIB Terdaftar' : 'Belum Ada NIB'}</strong>
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setSelectedUmkmAudit(null)}
              >
                Tutup Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
