'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { DEMO_TRANSACTIONS, DEMO_PROFILES } from '@/lib/demo-seed'
import { Tables } from '@/lib/database.types'
import {
  calculateKasSummary,
  formatRupiah,
  KAS_CATEGORIES,
} from '@/lib/kas'

type TransaksiKas = Tables<'transaksi_kas'>
type ProfilUsaha = Tables<'profil_usaha'>

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]

export default function DashboardPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<TransaksiKas[]>([])
  const [profile, setProfile] = useState<ProfilUsaha | null>(null)
  const [isGuest, setIsGuest] = useState(false)
  const [loading, setLoading] = useState(true)

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false)
  const [allProfiles, setAllProfiles] = useState<ProfilUsaha[]>([])
  const [allRawTransactions, setAllRawTransactions] = useState<TransaksiKas[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>('all')
  const [adminViewTab, setAdminViewTab] = useState<'ringkasan' | 'direktori' | 'audit-kas'>('ringkasan')
  const [adminSearch, setAdminSearch] = useState('')
  const [adminSector, setAdminSector] = useState('ALL')

  // Chart state
  const [chartMode, setChartMode] = useState<'omzet' | 'laba'>('omzet')

  // Filter state for recent tx table
  const [filterTxType, setFilterTxType] = useState<'all' | 'income' | 'expense'>('all')

  // Modal State for New Tx
  const [modalOpen, setModalOpen] = useState(false)
  const [txType, setTxType] = useState<'pemasukan' | 'pengeluaran'>('pemasukan')
  const [txAmount, setTxAmount] = useState('')
  const [txCategory, setTxCategory] = useState('Penjualan')
  const [txDesc, setTxDesc] = useState('')
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10))
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setIsGuest(true)
        setProfile(DEMO_PROFILES[0])
        setTransactions(DEMO_TRANSACTIONS)
        setLoading(false)
        return
      }

      const isUserAdmin =
        user.email?.toLowerCase().includes('admin') ||
        user.user_metadata?.role === 'admin'
      setIsAdmin(isUserAdmin)

      if (isUserAdmin) {
        // Fetch all profiles across platform
        const { data: allProfs } = await supabase.from('profil_usaha').select('*')
        if (allProfs && allProfs.length > 0) {
          setAllProfiles(allProfs as ProfilUsaha[])
        }

        // Fetch all transactions across platform
        const { data: allTxs } = await supabase
          .from('transaksi_kas')
          .select('*')
          .order('tanggal', { ascending: false })

        if (allTxs && allTxs.length > 0) {
          setAllRawTransactions(allTxs as TransaksiKas[])
          setTransactions(allTxs as TransaksiKas[])
        } else {
          setAllRawTransactions(DEMO_TRANSACTIONS)
          setTransactions(DEMO_TRANSACTIONS)
        }

        setProfile({
          id: 'admin-platform',
          user_id: user.id,
          nama_usaha: 'Seluruh Ekosistem UMKM',
          nama_pemilik: 'Administrator UTERA',
          jenis_usaha: 'Agregat Platform Finansial',
          nomor_telepon: '1500-UTERA',
          alamat_usaha: 'Pusat Komando UTERA Finansial',
          tanggal_mulai_usaha: '2026-01-01',
          deskripsi_usaha: 'Monitoring terpadu arus kas seluruh mitra UMKM binaan',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        setLoading(false)
        return
      }

      // Fetch Profile for regular user
      const { data: profs } = await supabase
        .from('profil_usaha')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)

      if (profs && profs.length > 0) {
        setProfile(profs[0] as ProfilUsaha)
      } else {
        const fullName = (user.user_metadata?.full_name as string) || ''
        let initialNamaUsaha = 'Usaha Mandiri'
        let initialNamaPemilik = 'Pemilik Usaha'
        if (fullName.includes('-')) {
          const parts = fullName.split('-').map((s) => s.trim())
          initialNamaPemilik = parts[0] || 'Pemilik Usaha'
          initialNamaUsaha = parts[1] || 'Usaha Mandiri'
        } else if (fullName) {
          initialNamaPemilik = fullName
          initialNamaUsaha = `Usaha ${fullName}`
        }

        const { data: createdProf, error: createErr } = await supabase
          .from('profil_usaha')
          .insert({
            nama_usaha: initialNamaUsaha,
            nama_pemilik: initialNamaPemilik,
            jenis_usaha: 'Kuliner & F&B',
          })
          .select()
          .single()

        if (!createErr && createdProf) {
          setProfile(createdProf as ProfilUsaha)
        } else {
          setProfile({
            id: 'user-default',
            nama_usaha: initialNamaUsaha,
            nama_pemilik: initialNamaPemilik,
            jenis_usaha: 'Kuliner & F&B',
            nomor_telepon: null,
            alamat_usaha: null,
            tanggal_mulai_usaha: null,
            deskripsi_usaha: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            user_id: user.id,
          })
        }
      }

      // Fetch Transactions
      const { data: txList, error } = await supabase
        .from('transaksi_kas')
        .select('*')
        .order('tanggal', { ascending: false })

      if (!error && txList) {
        setTransactions(txList as TransaksiKas[])
      }
      setLoading(false)
    }

    loadData()
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    if (selectedProfileId === 'all') {
      setTransactions(allRawTransactions)
      setProfile({
        id: 'admin-platform',
        user_id: 'admin',
        nama_usaha: 'Seluruh Ekosistem UMKM',
        nama_pemilik: 'Administrator UTERA',
        jenis_usaha: 'Agregat Platform Finansial',
        nomor_telepon: '1500-UTERA',
        alamat_usaha: 'Pusat Komando UTERA Finansial',
        tanggal_mulai_usaha: '2026-01-01',
        deskripsi_usaha: 'Monitoring terpadu arus kas seluruh mitra UMKM binaan',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    } else if (selectedProfileId === 'demo-kopi') {
      setTransactions(DEMO_TRANSACTIONS)
      setProfile(DEMO_PROFILES[0])
    } else {
      const found = allProfiles.find((p) => p.id === selectedProfileId)
      if (found) {
        setProfile(found)
        const filtered = allRawTransactions.filter((t) => t.profil_id === found.id || t.user_id === found.user_id)
        setTransactions(filtered.length > 0 ? filtered : DEMO_TRANSACTIONS)
      }
    }
  }, [selectedProfileId, isAdmin, allProfiles, allRawTransactions])

  // 1. Calculate Kas Summary
  const kasSummary = useMemo(() => calculateKasSummary(transactions), [transactions])

  // 2. Calculate Dynamic PRD Score Formula (Pillar 2: Consistency + Cashflow Health)
  const scorePRD = useMemo(() => {
    if (kasSummary.totalIncome > 0) {
      const marginRatio = kasSummary.netProfit / kasSummary.totalIncome
      return Math.min(96, Math.max(40, Math.round(50 + marginRatio * 45)))
    } else if (transactions.length > 0) {
      return 50
    }
    return 0 // New account with 0 transactions
  }, [kasSummary, transactions])

  // 3. Guardrail 30% calculation
  const maxInstallment30Pct = Math.round(Math.max(0, kasSummary.netProfit) * 0.30)
  const simulatedBriInstallment = 2216000
  const simulatedKopInstallment = 2291000

  // 4. Monthly Breakdown Timeline (4 consecutive months ending at latest month + 1 target)
  const timelineData = useMemo(() => {
    let refYear = 2026
    let refMonth = 10 // default October 2026

    transactions.forEach((tx) => {
      if (tx.tanggal) {
        const parts = tx.tanggal.split('-')
        const y = parseInt(parts[0], 10)
        const m = parseInt(parts[1], 10)
        if (!isNaN(y) && !isNaN(m)) {
          if (y > refYear || (y === refYear && m > refMonth)) {
            refYear = y
            refMonth = m
          }
        }
      }
    })

    const displayKeys: string[] = []
    for (let offset = 3; offset >= 0; offset--) {
      let dMonth = refMonth - offset
      let dYear = refYear
      while (dMonth <= 0) {
        dMonth += 12
        dYear -= 1
      }
      const key = `${dYear}-${String(dMonth).padStart(2, '0')}`
      displayKeys.push(key)
    }

    const monthsMap: Record<string, { key: string; income: number; expense: number }> = {}
    displayKeys.forEach((k) => {
      monthsMap[k] = { key: k, income: 0, expense: 0 }
    })

    transactions.forEach((tx) => {
      const key = tx.tanggal ? tx.tanggal.slice(0, 7) : `${refYear}-${String(refMonth).padStart(2, '0')}`
      if (!monthsMap[key]) monthsMap[key] = { key, income: 0, expense: 0 }
      const nom = Number(tx.nominal) || 0
      if (tx.tipe === 'pemasukan') monthsMap[key].income += nom
      else monthsMap[key].expense += nom
    })

    let maxVal = 100000
    displayKeys.forEach((k) => {
      const m = monthsMap[k]
      maxVal = Math.max(maxVal, m.income, m.expense, Math.abs(m.income - m.expense))
    })

    const columns = displayKeys.map((k, idx) => {
      const m = monthsMap[k]
      const isLatest = idx === displayKeys.length - 1
      const parts = k.split('-')
      const mIdx = parseInt(parts[1], 10) - 1
      const mName = MONTH_NAMES[mIdx] || k
      const label = isLatest ? `${mName} (Kini)` : mName

      const net = m.income - m.expense
      const displayVal = chartMode === 'omzet' ? m.income : net

      const incBarValue = chartMode === 'omzet' ? m.income : Math.max(0, net)
      const incHeight = incBarValue > 0 ? Math.max(8, Math.min(94, Math.round((incBarValue / maxVal) * 94))) : 6
      const expHeight = m.expense > 0 ? Math.max(8, Math.min(94, Math.round((m.expense / maxVal) * 94))) : 6

      return {
        key: k,
        mName,
        label,
        isLatest,
        income: m.income,
        expense: m.expense,
        net,
        displayVal,
        incHeight,
        expHeight,
      }
    })

    // Trend calculation
    const latestMonth = monthsMap[displayKeys[displayKeys.length - 1]]
    const prevMonth = monthsMap[displayKeys[displayKeys.length - 2]]
    const curVal = chartMode === 'omzet' ? latestMonth.income : (latestMonth.income - latestMonth.expense)
    const prevVal = prevMonth ? (chartMode === 'omzet' ? prevMonth.income : (prevMonth.income - prevMonth.expense)) : 0
    const prevName = prevMonth ? (MONTH_NAMES[parseInt(prevMonth.key.split('-')[1], 10) - 1] || 'bulan lalu') : 'bulan lalu'

    let trendText = '0% Belum ada data'
    let trendIsUp = true
    if (prevVal > 0) {
      const pct = Math.round(((curVal - prevVal) / prevVal) * 100)
      trendIsUp = pct >= 0
      trendText = `${trendIsUp ? '+' : ''}${pct}% dibanding ${prevName}`
    } else if (curVal > 0) {
      trendIsUp = true
      trendText = 'Omzet bulan aktif tercatat'
    }

    return {
      columns,
      highlightVal: curVal,
      trendText,
      trendIsUp,
    }
  }, [transactions, chartMode])

  // Filtered recent transactions for table
  const filteredRecentTx = useMemo(() => {
    let list = [...transactions]
    if (filterTxType === 'income') list = list.filter((t) => t.tipe === 'pemasukan')
    else if (filterTxType === 'expense') list = list.filter((t) => t.tipe === 'pengeluaran')
    return list.slice(0, 6)
  }, [transactions, filterTxType])

  // Category distribution
  const categoryDist = useMemo(() => {
    const map = new Map<string, number>()
    transactions
      .filter((t) => t.tipe === 'pemasukan')
      .forEach((t) => {
        const cat = t.kategori || 'Lain-lain'
        map.set(cat, (map.get(cat) || 0) + Number(t.nominal))
      })
    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
    const total = entries.reduce((acc, curr) => acc + curr[1], 0)
    return entries.slice(0, 4).map(([name, amount]) => ({
      name,
      amount,
      pct: total > 0 ? Math.round((amount / total) * 100) : 0,
    }))
  }, [transactions])

  // Admin UMKM Directory list
  const umkmList = useMemo(() => {
    const list: Array<{
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
    }> = []

    if (allProfiles.length > 0) {
      allProfiles.forEach((p) => {
        const txs = allRawTransactions.filter((t) => t.profil_id === p.id || t.user_id === p.user_id)
        let inc = 0
        let exp = 0
        txs.forEach((t) => {
          if (t.tipe === 'pemasukan') inc += Number(t.nominal)
          else exp += Number(t.nominal)
        })
        const saldo = inc - exp
        const margin = inc > 0 ? saldo / inc : 0
        const skor = txs.length > 0 ? Math.min(96, Math.max(40, Math.round(50 + margin * 45))) : 50

        list.push({
          id: p.id,
          namaUsaha: p.nama_usaha,
          namaPemilik: p.nama_pemilik || 'Pemilik Usaha',
          sektor: p.jenis_usaha || 'Kuliner & F&B',
          telepon: p.nomor_telepon || '0812-xxxx-xxxx',
          totalTx: txs.length,
          pemasukan: inc,
          pengeluaran: exp,
          saldoKas: saldo,
          skor,
          statusKur: skor >= 70 ? 'Siap KUR Mikro (s.d. Rp 50 Jt)' : 'Rekomendasi KUR Super Mikro',
          hasNib: true,
        })
      })
    }

    const defaultSeed = [
      { id: 'seed-dewo', namaUsaha: 'Kopi Galer', namaPemilik: 'Dewo', sektor: 'Kuliner & F&B', telepon: '0812-3456-7890', totalTx: 18, pemasukan: 32500000, pengeluaran: 14200000, saldoKas: 18300000, skor: 84, statusKur: 'Siap KUR Mikro (s.d. Rp 50 Jt)', hasNib: true },
      { id: 'seed-berkah', namaUsaha: 'Warung Berkah Jaya', namaPemilik: 'Ibu Siti Aminah', sektor: 'Perdagangan & Retail', telepon: '0857-9876-5432', totalTx: 42, pemasukan: 48600000, pengeluaran: 27100000, saldoKas: 21500000, skor: 88, statusKur: 'Siap KUR Mikro (s.d. Rp 100 Jt)', hasNib: true },
      { id: 'seed-nusantara', namaUsaha: 'Kedai Kopi Nusantara', namaPemilik: 'Budi Santoso', sektor: 'Kuliner & F&B', telepon: '0813-8821-4401', totalTx: 24, pemasukan: 28400000, pengeluaran: 12800000, saldoKas: 15600000, skor: 82, statusKur: 'Siap KUR Mikro (s.d. Rp 50 Jt)', hasNib: true },
      { id: 'seed-konveksi', namaUsaha: 'Konveksi Berkah Makmur', namaPemilik: 'Haji Ahmad', sektor: 'Konveksi & Fashion', telepon: '0821-4455-6677', totalTx: 15, pemasukan: 55000000, pengeluaran: 38000000, saldoKas: 17000000, skor: 74, statusKur: 'Siap KUR Mikro (s.d. Rp 50 Jt)', hasNib: true },
      { id: 'seed-bengkel', namaUsaha: 'Bengkel Motor Sejahtera', namaPemilik: 'Eko Wahyudi', sektor: 'Jasa & Layanan', telepon: '0878-1122-3344', totalTx: 9, pemasukan: 16500000, pengeluaran: 10200000, saldoKas: 6300000, skor: 62, statusKur: 'Rekomendasi KUR Super Mikro', hasNib: false },
    ]

    defaultSeed.forEach((seed) => {
      if (!list.some((item) => item.namaUsaha.toLowerCase() === seed.namaUsaha.toLowerCase())) {
        list.push(seed)
      }
    })

    return list
  }, [allProfiles, allRawTransactions])

  const filteredUmkm = useMemo(() => {
    return umkmList.filter((item) => {
      const matchSearch =
        item.namaUsaha.toLowerCase().includes(adminSearch.toLowerCase()) ||
        item.namaPemilik.toLowerCase().includes(adminSearch.toLowerCase())
      const matchSector = adminSector === 'ALL' || item.sektor === adminSector
      return matchSearch && matchSector
    })
  }, [umkmList, adminSearch, adminSector])

  // Handle Save New Transaction
  const handleSaveTx = async (e: React.FormEvent) => {
    e.preventDefault()
    const nominal = Number(txAmount)
    if (!txDesc.trim() || isNaN(nominal) || nominal <= 0) return

    setSubmitting(true)
    const newTx: TransaksiKas = {
      id: `tx-${Date.now()}`,
      user_id: profile?.user_id || 'demo-user',
      profil_id: profile?.id || null,
      tanggal: txDate,
      keterangan: txDesc.trim(),
      nominal,
      tipe: txType,
      kategori: txCategory,
      metode_pembayaran: 'Tunai',
      created_at: new Date().toISOString(),
    }

    if (isGuest) {
      setTransactions((prev) => [newTx, ...prev])
      setModalOpen(false)
      setTxDesc('')
      setTxAmount('')
      setSubmitting(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('transaksi_kas')
        .insert({
          tipe: txType,
          nominal,
          kategori: txCategory,
          tanggal: txDate,
          keterangan: txDesc.trim(),
          metode_pembayaran: 'Tunai',
          profil_id: profile?.id && profile.id !== 'user-default' ? profile.id : null,
        })
        .select()
        .single()

      if (error) throw error
      if (data) {
        setTransactions((prev) => [data as TransaksiKas, ...prev])
      }
      setModalOpen(false)
      setTxDesc('')
      setTxAmount('')
    } catch (err) {
      console.error('Error inserting transaction:', err)
      alert('Gagal menyimpan transaksi kas.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="dashboard-scroll-wrap">
      {/* Header Row: Title + Period Selector & Export */}
      <div className="dash-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 className="dash-heading">Dashboard Finansial</h1>
            {isAdmin && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', padding: '3px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700 }}>
                <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>shield</span>
                Mode Administrator
              </span>
            )}
          </div>
          <p className="dash-subheading">
            {isAdmin
              ? `Memantau kesehatan kas dan rasio kelayakan kredit: ${profile?.nama_usaha || 'Ekosistem UMKM'}`
              : 'Pantau arus kas riil warung harian, indikator kelayakan KUR, dan guardrail beban cicilan.'}
          </p>
        </div>

        <div className="dash-header-actions">
          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.775rem', fontWeight: 700, color: 'var(--text-muted)' }}>Pilih Usaha:</span>
              <select
                className="select-period"
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                style={{ fontWeight: 700, color: 'var(--primary)' }}
                aria-label="Pilih Usaha Mitra untuk Ditinjau"
              >
                <option value="all">🌐 Seluruh Ekosistem UMKM</option>
                {allProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    🏪 {p.nama_usaha} ({p.nama_pemilik || 'Pemilik'})
                  </option>
                ))}
                <option value="demo-kopi">☕ Dewo - Kopi Galer</option>
              </select>
            </div>
          )}

          <div className="date-range-badge">
            <span className="material-symbols-rounded date-icon">calendar_today</span>
            <span>Okt 2026 • Real-time</span>
          </div>

          <select className="select-period" id="select-period" aria-label="Pilih Periode Waktu">
            <option value="bulanan">Bulan Ini</option>
            <option value="mingguan">7 Hari Terakhir</option>
            <option value="triwulan">Triwulan (Q4)</option>
          </select>

          <Link href="/laporan-siap-bank" className="btn btn-outline btn-sm" id="btn-export-laporan">
            <span className="material-symbols-rounded btn-icon">download</span>
            <span>Ekspor PDF</span>
          </Link>
        </div>
      </div>

      {/* UMKM Financial Insight & Notification Banner */}
      {!isAdmin && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#F0FDF4',
          border: '1px solid #BBF7D0',
          borderRadius: '12px',
          padding: '12px 18px',
          marginBottom: '20px',
          fontSize: '0.85rem',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="material-symbols-rounded" style={{ color: '#059669', fontSize: '20px' }}>
              verified
            </span>
            <span>
              <strong>Kabar Baik:</strong> Skor Kelayakan Bank Anda naik ke <strong>79/100</strong>. Kapasitas cicilan aman Guardrail 30% mencapai <strong>Rp 16.905.000/bln</strong>.
            </span>
          </div>
          <Link href="/skor-kelayakan" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span>Lihat Analisis Skor</span>
            <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>arrow_forward</span>
          </Link>
        </div>
      )}

      {/* ====================================================================
           1. KPI STATS METRIC ROW (Material Symbols Icons)
           ==================================================================== */}
      <section className="metrics-grid" aria-label="Metrik Finansial Utama">
        {/* Card 1: Saldo Kas Bersih */}
        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Total Saldo Kas Operasional</span>
            <div className="metric-icon-wrap" aria-hidden="true">
              <span className="material-symbols-rounded">account_balance_wallet</span>
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value" id="val-saldo">{formatRupiah(kasSummary.saldoKas)}</span>
            <span className="trend-pill trend-up">
              <span className="material-symbols-rounded trend-icon">trending_up</span>
              <span>{transactions.length > 0 ? `${kasSummary.marginPct}%` : '0%'}</span>
            </span>
          </div>
          <p className="metric-caption">Saldo riil di kasir &amp; rekening kas warung saat ini.</p>
        </div>

        {/* Card 2: Pemasukan Bulan Ini */}
        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Total Pemasukan (Omzet)</span>
            <div className="metric-icon-wrap bg-emerald" aria-hidden="true">
              <span className="material-symbols-rounded text-emerald">arrow_downward</span>
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value text-emerald" id="val-pemasukan">{formatRupiah(kasSummary.totalIncome)}</span>
            <span className="trend-pill trend-up">
              <span className="material-symbols-rounded trend-icon">trending_up</span>
              <span>Aktif</span>
            </span>
          </div>
          <p className="metric-caption">Total omzet dari transaksi kas yang dicatat.</p>
        </div>

        {/* Card 3: Pengeluaran Kas */}
        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Pengeluaran Biaya &amp; Kulakan</span>
            <div className="metric-icon-wrap bg-terracotta" aria-hidden="true">
              <span className="material-symbols-rounded text-terracotta">arrow_upward</span>
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value text-terracotta" id="val-pengeluaran">{formatRupiah(kasSummary.totalExpense)}</span>
            <span className="trend-pill trend-down">
              <span className="material-symbols-rounded trend-icon">trending_down</span>
              <span>Operasional</span>
            </span>
          </div>
          <p className="metric-caption">Belanja bahan baku, sewa, listrik &amp; operasional.</p>
        </div>

        {/* Card 4: Skor Kelayakan Kredit PRD UTERA */}
        <Link
          href="/skor-kelayakan"
          className="metric-card metric-card-highlight"
          style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
          title="Buka Detail Analisis Skor Kelayakan"
        >
          <div className="metric-top">
            <span className="metric-label">Skor Kelayakan Bank (PRD)</span>
            <div className="metric-icon-wrap bg-gold" aria-hidden="true">
              <span className="material-symbols-rounded text-gold">hotel_class</span>
            </div>
          </div>
          <div className="metric-value-row">
            <div className="score-display">
              <span className="metric-value text-primary" id="val-skor">{scorePRD}</span>
              <span className="score-denom">/100</span>
            </div>
            {transactions.length === 0 ? (
              <span className="badge-status-good" style={{ background: '#F1F5F9', color: '#64748B' }}>
                Belum Ada Transaksi
              </span>
            ) : scorePRD >= 70 ? (
              <span className="badge-status-good">Layak KUR Mikro</span>
            ) : (
              <span className="badge-status-good" style={{ background: '#FEF3CD', color: '#92400E' }}>
                Perbaikan Kas
              </span>
            )}
          </div>
          <div className="metric-footer-link" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '6px' }}>
            <p className="metric-caption" style={{ margin: 0 }}>Berdasarkan konsistensi pencatatan kas aktif &amp; tren profit.</p>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap', marginLeft: '8px' }}>
              Buka <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>arrow_forward</span>
            </span>
          </div>
        </Link>
      </section>

      {/* ====================================================================
           2. MAIN CHART ROW: Sales & Cashflow Overview + Guardrail 30% Gauge
           ==================================================================== */}
      <div className="charts-split-grid">
        {/* Large Chart: Arus Kas & Margin Usaha */}
        <div className="dash-panel panel-chart-main">
          <div className="panel-header">
            <div className="panel-header-info">
              <h2 className="panel-title">Grafik Arus Kas Bulanan</h2>
              <p className="panel-subtitle">Perbandingan pemasukan, pengeluaran, dan akumulasi laba bersih</p>
            </div>
            <div className="panel-actions">
              <div className="segmented-control" role="tablist">
                <button
                  type="button"
                  className={`seg-btn ${chartMode === 'omzet' ? 'active' : ''}`}
                  onClick={() => setChartMode('omzet')}
                >
                  Omzet
                </button>
                <button
                  type="button"
                  className={`seg-btn ${chartMode === 'laba' ? 'active' : ''}`}
                  onClick={() => setChartMode('laba')}
                >
                  Laba Bersih
                </button>
              </div>
            </div>
          </div>

          {/* Chart Headline & Summary Numbers */}
          <div className="chart-summary-header">
            <div>
              <span className="chart-big-number" id="chart-highlight-number">
                {formatRupiah(timelineData.highlightVal)}
              </span>
              <span className={`trend-pill ${timelineData.trendIsUp ? 'trend-up' : 'trend-down'}`}>
                <span className="material-symbols-rounded trend-icon">
                  {timelineData.trendIsUp ? 'trending_up' : 'trending_down'}
                </span>
                <span>{timelineData.trendText}</span>
              </span>
            </div>
            {/* Chart Legend */}
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-dot dot-income"></span> Pemasukan</span>
              <span className="legend-item"><span className="legend-dot dot-expense"></span> Pengeluaran</span>
              <span className="legend-item"><span className="legend-dot dot-net"></span> Laba Bersih</span>
            </div>
          </div>

          {/* CSS Bar Visualization */}
          <div className="bar-chart-container" id="bar-chart-container">
            <div className="chart-columns" id="dashboard-chart-columns">
              {timelineData.columns.map((c) => (
                <div key={c.key} className={`chart-col ${c.isLatest ? 'active-month' : ''}`}>
                  <div className="col-bars">
                    <div
                      className={`bar bar-income ${c.isLatest ? 'highlight' : ''}`}
                      style={{ height: `${c.incHeight}%` }}
                      title={`${chartMode === 'omzet' ? 'Pemasukan' : 'Laba Bersih'} ${c.mName}: ${formatRupiah(c.displayVal)}`}
                    >
                      {c.isLatest && <span className="bar-tooltip">{formatRupiah(c.displayVal)}</span>}
                    </div>
                    <div
                      className="bar bar-expense"
                      style={{ height: `${c.expHeight}%` }}
                      title={`Pengeluaran ${c.mName}: ${formatRupiah(c.expense)}`}
                    ></div>
                  </div>
                  <span className={`col-label ${c.isLatest ? 'font-bold' : ''}`}>{c.label}</span>
                </div>
              ))}

              <div className="chart-col projected">
                <div className="col-bars">
                  <div className="bar bar-income dashed" style={{ height: '52%' }} title="Proyeksi Pertumbuhan Target"></div>
                  <div className="bar bar-expense dashed" style={{ height: '32%' }}></div>
                </div>
                <span className="col-label">Target (Est.)</span>
              </div>
            </div>
          </div>

          {/* Cashflow Health Banner */}
          <div className="chart-footer-banner">
            <div className="health-indicator">
              <span
                className="status-circle"
                style={{ background: transactions.length > 0 ? '#10B981' : '#94A3B8' }}
              ></span>
              {transactions.length > 0 ? (
                <span>
                  <strong>Arus Kas Sehat:</strong> Pembukuan aktif mencatatkan rasio margin laba {kasSummary.marginPct}%. Siap untuk pengajuan KUR.
                </span>
              ) : (
                <span>
                  <strong>Mulai Pembukuan:</strong> Catat transaksi kas harian pertama Anda untuk mengaktifkan grafik arus kas dan analisis kelayakan KUR.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Side Panel: Guardrail Rasio Cicilan 30% (PRD Pillar 3) */}
        <div className="dash-panel panel-guardrail" id="section-guardrail">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Guardrail Cicilan 30%</h2>
              <p className="panel-subtitle">Batas aman angsuran kredit kas UMKM</p>
            </div>
            <span className={maxInstallment30Pct >= simulatedBriInstallment ? 'badge-status-safe' : 'badge-status-warning'}>
              {maxInstallment30Pct >= simulatedBriInstallment ? 'Kondisi Aman' : 'Kapasitas Terbatas'}
            </span>
          </div>

          {/* Big Capacity Indicator */}
          <div className="guardrail-capacity-box">
            <div className="capacity-stat">
              <span className="capacity-label">Kapasitas Cicilan Maksimal</span>
              <span className="capacity-val" id="val-max-cicilan">
                {formatRupiah(maxInstallment30Pct)} / bln
              </span>
              <span className="capacity-formula">
                30% x Rata-rata Laba Bersih ({formatRupiah(kasSummary.netProfit)})
              </span>
            </div>

            {/* Meter Progress Bar */}
            <div className="guardrail-meter">
              <div className="meter-bar-track">
                <div
                  className={`meter-bar-fill ${maxInstallment30Pct >= simulatedBriInstallment ? 'safe' : 'danger'}`}
                  style={{
                    width: maxInstallment30Pct > 0
                      ? `${Math.min(100, Math.round((simulatedBriInstallment / Math.max(maxInstallment30Pct, simulatedBriInstallment)) * 100))}%`
                      : '0%',
                  }}
                ></div>
                {/* 30% Threshold Line Indicator */}
                <div className="meter-threshold-line" style={{ left: '70%' }} title="Batas Maksimal 30%">
                  <span className="threshold-label">Batas 30%</span>
                </div>
              </div>
              <div className="meter-labels">
                <span>Rp 0</span>
                <span className="text-safe font-medium">
                  {transactions.length > 0 ? `Simulasi Teruji: ${formatRupiah(simulatedBriInstallment)}` : 'Cicilan Aktif: Rp 0'}
                </span>
                <span>Maks {formatRupiah(maxInstallment30Pct)}</span>
              </div>
            </div>
          </div>

          {/* Simulasi Cepat Pilihan Pembiayaan */}
          <div className="guardrail-actions-list">
            <div className="loan-option-card">
              <div className="loan-icon-wrap" aria-hidden="true">
                <span className="material-symbols-rounded">account_balance</span>
              </div>
              <div className="loan-info">
                <strong>Simulasi KUR BRI 6%</strong>
                <span>Plafon Rp 50 Juta • Tenor 24 Bln</span>
              </div>
              <div className="loan-result">
                <span className="loan-installment">Rp 2.216.000/bln</span>
                {transactions.length === 0 || kasSummary.netProfit <= 0 ? (
                  <span className="loan-status" style={{ color: '#94A3B8' }}>○ Belum Ada Saldo Kas</span>
                ) : maxInstallment30Pct >= simulatedBriInstallment ? (
                  <span className="loan-status text-emerald" style={{ color: '#10B981', fontWeight: 600 }}>✓ Masuk Batas Kas</span>
                ) : (
                  <span className="loan-status text-terracotta" style={{ color: '#B5532F', fontWeight: 600 }}>⚠️ Melebihi Batas 30%</span>
                )}
              </div>
            </div>

            <div className="loan-option-card">
              <div className="loan-icon-wrap" aria-hidden="true">
                <span className="material-symbols-rounded">handshake</span>
              </div>
              <div className="loan-info">
                <strong>Pinjaman Koperasi Usaha</strong>
                <span>Plafon Rp 25 Juta • Tenor 12 Bln</span>
              </div>
              <div className="loan-result">
                <span className="loan-installment">Rp 2.291.000/bln</span>
                {transactions.length === 0 || kasSummary.netProfit <= 0 ? (
                  <span className="loan-status" style={{ color: '#94A3B8' }}>○ Belum Ada Saldo Kas</span>
                ) : maxInstallment30Pct >= simulatedKopInstallment ? (
                  <span className="loan-status text-emerald" style={{ color: '#10B981', fontWeight: 600 }}>✓ Masuk Batas Kas</span>
                ) : (
                  <span className="loan-status text-terracotta" style={{ color: '#B5532F', fontWeight: 600 }}>⚠️ Melebihi Batas 30%</span>
                )}
              </div>
            </div>
          </div>

          <div className="guardrail-cta">
            <Link href="/guardrail" className="btn btn-secondary btn-block btn-sm" id="btn-quick-simulasi">
              <span className="material-symbols-rounded btn-icon" style={{ fontSize: '16px' }}>shield</span>
              <span>Buka Simulator Guardrail Lengkap</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ====================================================================
           3. LOWER SECTION: Recent Transactions Table + Quick Category Breakdown
           ==================================================================== */}
      <div className="dash-bottom-grid">
        {/* Left/Main: Recent Transactions Table */}
        <div className="dash-panel panel-transactions" id="section-buku-kas">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Buku Kas: Transaksi Terakhir</h2>
              <p className="panel-subtitle">Catatan kasir dan pengeluaran harian yang terhubung langsung ke laporan keuangan</p>
            </div>

            <div className="table-filter-group">
              <select
                className="select-filter-tx"
                id="filter-tx-type"
                value={filterTxType}
                onChange={(e) => setFilterTxType(e.target.value as any)}
              >
                <option value="all">Semua Tipe</option>
                <option value="income">Pemasukan (Kas Masuk)</option>
                <option value="expense">Pengeluaran (Kas Keluar)</option>
              </select>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                id="btn-add-tx-row"
                onClick={() => setModalOpen(true)}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>add</span>
                <span>Catat Baru</span>
              </button>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="table-responsive">
            <table className="data-table" id="table-transactions">
              <thead>
                <tr>
                  <th>Waktu / Tanggal</th>
                  <th>Kategori</th>
                  <th>Keterangan Transaksi</th>
                  <th>Tipe Arus Kas</th>
                  <th className="text-right">Nominal</th>
                  <th className="text-center">Aksi</th>
                </tr>
              </thead>
              <tbody id="tx-table-body">
                {filteredRecentTx.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      Belum ada transaksi kas yang dicatat. Klik tombol <strong>Catat Baru</strong> di atas untuk memulai.
                    </td>
                  </tr>
                ) : (
                  filteredRecentTx.map((t) => (
                    <tr key={t.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{t.tanggal}</td>
                      <td>
                        <span className="badge-kategori" style={{ background: '#F1F5F9', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {t.kategori || 'Umum'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{t.keterangan}</td>
                      <td>
                        <span className={`pill-tipe ${t.tipe === 'pemasukan' ? 'text-emerald' : 'text-terracotta'}`} style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                          {t.tipe === 'pemasukan' ? '+ Kas Masuk' : '- Kas Keluar'}
                        </span>
                      </td>
                      <td className="text-right tabular-nums" style={{ fontWeight: 700, color: t.tipe === 'pemasukan' ? 'var(--primary)' : 'var(--secondary)' }}>
                        {t.tipe === 'pemasukan' ? '+' : '-'} {formatRupiah(Number(t.nominal))}
                      </td>
                      <td className="text-center">
                        <Link href="/buku-kas" className="btn-link-action" style={{ fontSize: '0.75rem' }}>
                          Detail
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer Pagination / Status */}
          <div className="table-footer-status">
            <span className="text-muted text-sm" id="tx-count-display">
              Menampilkan {filteredRecentTx.length} dari {transactions.length} transaksi aktif
            </span>
            <Link href="/buku-kas" className="btn-link-action" id="btn-view-all-tx">
              Buka Buku Kas Warung →
            </Link>
          </div>
        </div>

        {/* Right/Secondary: Distribusi Kategori Penjualan UMKM */}
        <div className="dash-panel panel-distribution">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Distribusi Penjualan</h2>
              <p className="panel-subtitle">Sumber omzet per kategori produk</p>
            </div>
            <span className="period-chip">Bulan Ini</span>
          </div>

          {/* Visual Category Distribution */}
          <div className="distribution-bars-wrap" id="distribution-bars-wrap" style={{ padding: '16px 0' }}>
            {categoryDist.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Belum ada data penjualan tercatat.</p>
            ) : (
              categoryDist.map((c) => (
                <div key={c.name} style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                    <strong>{c.name}</strong>
                    <span className="tabular-nums">{formatRupiah(c.amount)} ({c.pct}%)</span>
                  </div>
                  <div style={{ height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${c.pct}%`, height: '100%', background: 'var(--primary)', borderRadius: '3px' }}></div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Kelayakan Dokumen Legalitas (Pilar 4 UTERA) */}
          <div className="legalitas-status-card" id="legalitas-status-card" style={{ marginTop: '16px', padding: '16px', background: '#EEF7F2', borderRadius: '12px', border: '1px solid #D1E7DC' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="material-symbols-rounded" style={{ color: 'var(--primary)' }}>description</span>
              <strong style={{ color: 'var(--primary-dark)', fontSize: '0.9rem' }}>Status Legalitas NIB OSS</strong>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-body)', margin: 0, lineHeight: 1.5 }}>
              Lengkapi berkas NIB dan sertifikasi halal untuk membuka akses pengajuan KUR Mikro hingga Rp 50 Juta.
            </p>
            <Link href="/legalitas" style={{ display: 'inline-block', marginTop: '10px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
              Kelola Dokumen Legalitas →
            </Link>
          </div>
        </div>
      </div>

      {/* ========================================================================
           ADMIN PANEL: DAFTAR AKUN & DIREKTORI MITRA UMKM
           ======================================================================== */}
      {isAdmin && (
        <div className="dash-panel" style={{ marginTop: '24px', padding: '24px' }}>
          <div className="panel-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-rounded" style={{ color: 'var(--primary)' }}>groups</span>
                <h2 className="panel-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                  Direktori Akun &amp; Mitra UMKM Terdaftar ({umkmList.length} Usaha)
                </h2>
              </div>
              <p className="panel-subtitle" style={{ margin: '4px 0 0', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                Daftar seluruh akun UMKM, kepatuhan kas harian, skor kesiapan bank, dan kelengkapan NIB.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Cari nama usaha atau pemilik..."
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.825rem',
                  outline: 'none',
                }}
              />
              <select
                value={adminSector}
                onChange={(e) => setAdminSector(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.825rem',
                  background: '#fff',
                  outline: 'none',
                }}
              >
                <option value="ALL">Semua Sektor</option>
                <option value="Kuliner & F&B">Kuliner &amp; F&amp;B</option>
                <option value="Perdagangan & Retail">Perdagangan &amp; Retail</option>
                <option value="Konveksi & Fashion">Konveksi &amp; Fashion</option>
                <option value="Jasa & Layanan">Jasa &amp; Layanan</option>
              </select>
            </div>
          </div>

          <div className="table-responsive" style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#F8FAF9', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Nama Usaha &amp; Pemilik</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Sektor</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Saldo Kas</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Skor PRD</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Status KUR</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Legalitas NIB</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredUmkm.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #F1F5F3' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <strong style={{ color: 'var(--text-main)', display: 'block' }}>{u.namaUsaha}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Pemilik: {u.namaPemilik} • {u.telepon}
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
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{u.totalTx} Transaksi</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '9999px',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          background: u.skor >= 70 ? '#ECFDF5' : '#FEF3C7',
                          color: u.skor >= 70 ? '#059669' : '#D97706',
                          border: `1px solid ${u.skor >= 70 ? '#A7F3D0' : '#FCD34D'}`,
                        }}
                      >
                        ★ {u.skor} Poin
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 600, color: u.skor >= 70 ? '#065F46' : '#92400E' }}>
                      {u.statusKur}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {u.hasNib ? (
                        <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '6px', background: '#EFF6FF', color: '#1E40AF', fontSize: '0.75rem', fontWeight: 700, border: '1px solid #BFDBFE' }}>
                          ✓ NIB Terbit
                        </span>
                      ) : (
                        <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '6px', background: '#F3F4F6', color: '#9CA3AF', fontSize: '0.75rem', fontWeight: 600 }}>
                          Belum Ada
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProfileId(u.id)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--primary)',
                          background: selectedProfileId === u.id ? 'var(--primary)' : '#fff',
                          color: selectedProfileId === u.id ? '#fff' : 'var(--primary)',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        {selectedProfileId === u.id ? 'Sedang Ditinjau' : 'Lihat Kas Usaha'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================
           MODAL: CATAT TRANSAKSI KAS BARU
           ======================================================================== */}
      {modalOpen && (
        <div className="modal-backdrop" id="modal-tx-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-dialog" role="dialog" aria-modal="true" style={{ background: '#fff', borderRadius: '16px', width: '92%', maxWidth: '480px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="modal-title" style={{ fontSize: '1.25rem', fontWeight: 800 }}>Catat Transaksi Kas Warung</h3>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveTx} className="modal-form">
              {/* Tipe Transaksi */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  Tipe Arus Kas
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setTxType('pemasukan')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: `2px solid ${txType === 'pemasukan' ? 'var(--primary)' : '#E2E8F0'}`,
                      background: txType === 'pemasukan' ? 'var(--primary-soft)' : '#fff',
                      color: txType === 'pemasukan' ? 'var(--primary-dark)' : 'var(--text-body)',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    + Pemasukan (Omzet)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxType('pengeluaran')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: `2px solid ${txType === 'pengeluaran' ? 'var(--secondary)' : '#E2E8F0'}`,
                      background: txType === 'pengeluaran' ? 'var(--secondary-soft, #FDF1ED)' : '#fff',
                      color: txType === 'pengeluaran' ? 'var(--secondary)' : 'var(--text-body)',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    - Pengeluaran (Biaya)
                  </button>
                </div>
              </div>

              {/* Nominal Rupiah */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  Nominal Transaksi (Rp)
                </label>
                <input
                  type="number"
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '1rem', fontWeight: 700 }}
                  placeholder="contoh: 250000"
                  min="1000"
                  step="1000"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  required
                />
              </div>

              {/* Kategori */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  Kategori
                </label>
                <select
                  className="form-select"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem' }}
                  value={txCategory}
                  onChange={(e) => setTxCategory(e.target.value)}
                >
                  {KAS_CATEGORIES[txType].map((cat: string) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Keterangan */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  Keterangan Transaksi
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem' }}
                  placeholder="contoh: Penjualan 50 porsi sarapan pagi"
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  required
                />
              </div>

              {/* Tanggal */}
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  Tanggal Transaksi
                </label>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem' }}
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setModalOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={submitting}
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Transaksi Kas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
