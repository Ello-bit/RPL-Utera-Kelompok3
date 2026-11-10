'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DEMO_TRANSACTIONS, DEMO_PROFILES } from '@/lib/demo-seed'
import { Tables, TablesInsert } from '@/lib/database.types'
import {
  calculateKasSummary,
  formatRupiah,
  KAS_CATEGORIES,
  PAYMENT_METHODS,
  getMonthlyBreakdown,
} from '@/lib/kas'
import './buku-kas.css'

type TransaksiKas = Tables<'transaksi_kas'>
type ProfilUsaha = Tables<'profil_usaha'>

export default function BukuKasPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<TransaksiKas[]>([])
  const [profiles, setProfiles] = useState<ProfilUsaha[]>([])
  const [activeProfile, setActiveProfile] = useState<ProfilUsaha | null>(null)
  const [isGuest, setIsGuest] = useState(false)
  const [loading, setLoading] = useState(true)

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'all' | 'income' | 'expense' | 'kulakan' | 'operasional'>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRange, setSelectedRange] = useState<'1m' | '3m' | '6m' | 'all'>('6m')

  // Entry Form State
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formType, setFormType] = useState<'pemasukan' | 'pengeluaran'>('pemasukan')
  const [formNominal, setFormNominal] = useState<string>('')
  const [formKategori, setFormKategori] = useState<string>('Penjualan')
  const [formTanggal, setFormTanggal] = useState<string>(
    new Date().toISOString().slice(0, 10)
  )
  const [formKeterangan, setFormKeterangan] = useState<string>('')
  const [formMetode, setFormMetode] = useState<string>('Tunai')
  const [submitting, setSubmitting] = useState(false)
  const [toastText, setToastText] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setIsGuest(true)
        setTransactions(DEMO_TRANSACTIONS)
        setProfiles(DEMO_PROFILES)
        if (DEMO_PROFILES.length > 0) setActiveProfile(DEMO_PROFILES[0])
        setLoading(false)
        return
      }

      // Fetch Profiles
      const { data: profData } = await supabase
        .from('profil_usaha')
        .select('*')
        .order('created_at', { ascending: false })

      if (profData && profData.length > 0) {
        const typedProfs = profData as ProfilUsaha[]
        setProfiles(typedProfs)
        setActiveProfile(typedProfs[0])
      }

      // Fetch Transactions
      const { data: txData, error } = await supabase
        .from('transaksi_kas')
        .select('*')
        .order('tanggal', { ascending: false })

      if (error) {
        console.error('Error fetching transactions:', error)
      } else if (txData) {
        setTransactions(txData as TransaksiKas[])
      }
      setLoading(false)
    }

    loadData()
  }, [])

  const showToast = (text: string) => {
    setToastText(text)
    setTimeout(() => setToastText(null), 3000)
  }

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Tab filter
      if (activeTab === 'income' && tx.tipe !== 'pemasukan') return false
      if (activeTab === 'expense' && tx.tipe !== 'pengeluaran') return false
      if (activeTab === 'kulakan' && !tx.kategori?.toLowerCase().includes('bahan baku')) return false
      if (activeTab === 'operasional' && !tx.kategori?.toLowerCase().includes('operasional')) return false

      // Category filter
      if (filterCategory !== 'all' && tx.kategori !== filterCategory) return false

      // Search term filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const matchNote = tx.keterangan?.toLowerCase().includes(q)
        const matchCat = tx.kategori?.toLowerCase().includes(q)
        if (!matchNote && !matchCat) return false
      }
      return true
    })
  }, [transactions, activeTab, filterCategory, searchTerm])

  const kasSummary = useMemo(() => {
    return calculateKasSummary(filteredTransactions)
  }, [filteredTransactions])

  const guardrailLimit = Math.max(0, Math.round(kasSummary.netProfit * 0.3))

  // Monthly breakdown for SVG Area Chart
  const monthlyData = useMemo(() => {
    const count = selectedRange === '1m' ? 2 : selectedRange === '3m' ? 3 : 6
    return getMonthlyBreakdown(transactions, count)
  }, [transactions, selectedRange])

  // Build SVG Path points for the area chart
  const maxProfit = Math.max(...monthlyData.map((m) => Math.max(0, m.labaBersih)), 100_000)
  const svgWidth = 720
  const svgHeight = 180
  const paddingX = 40
  const usableWidth = svgWidth - paddingX * 2

  const points = monthlyData.map((m, idx) => {
    const x = paddingX + (idx / Math.max(1, monthlyData.length - 1)) * usableWidth
    const ratio = Math.max(0, m.labaBersih) / maxProfit
    const y = svgHeight - 20 - ratio * (svgHeight - 50)
    return { x, y, m }
  })

  let svgLinePath = ''
  let svgAreaPath = ''
  if (points.length > 0) {
    svgLinePath = `M ${points[0].x} ${points[0].y}`
    points.slice(1).forEach((p) => {
      svgLinePath += ` L ${p.x} ${p.y}`
    })
    svgAreaPath = `${svgLinePath} L ${points[points.length - 1].x} ${svgHeight} L ${points[0].x} ${svgHeight} Z`
  }

  // Handle Form Submit (INSERT or UPDATE)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nominalNum = parseInt(formNominal.replace(/[^0-9]/g, ''), 10)
    if (!nominalNum || nominalNum <= 0) {
      alert('Nominal harus lebih dari 0.')
      return
    }

    if (isGuest) {
      if (editingId) {
        setTransactions(
          transactions.map((t) =>
            t.id === editingId
              ? {
                  ...t,
                  tipe: formType,
                  nominal: nominalNum,
                  kategori: formKategori,
                  tanggal: formTanggal,
                  keterangan: formKeterangan,
                  metode_pembayaran: formMetode,
                }
              : t
          )
        )
        showToast('Transaksi berhasil diperbarui (Mode Tamu)')
      } else {
        const newTx: TransaksiKas = {
          id: 'tx_guest_' + Date.now(),
          user_id: 'guest',
          profil_id: activeProfile?.id || null,
          tipe: formType,
          nominal: nominalNum,
          kategori: formKategori,
          tanggal: formTanggal,
          keterangan: formKeterangan,
          metode_pembayaran: formMetode,
          created_at: new Date().toISOString(),
        }
        setTransactions([newTx, ...transactions])
        showToast('Transaksi baru berhasil dicatat (Mode Tamu)')
      }
      resetForm()
      return
    }

    setSubmitting(true)
    try {
      if (editingId) {
        // UPDATE in Supabase
        const { error } = await supabase
          .from('transaksi_kas')
          .update({
            tipe: formType,
            nominal: nominalNum,
            kategori: formKategori,
            tanggal: formTanggal,
            keterangan: formKeterangan,
            metode_pembayaran: formMetode,
            profil_id: activeProfile?.id || null,
          })
          .eq('id', editingId)

        if (error) throw error

        setTransactions(
          transactions.map((t) =>
            t.id === editingId
              ? {
                  ...t,
                  tipe: formType,
                  nominal: nominalNum,
                  kategori: formKategori,
                  tanggal: formTanggal,
                  keterangan: formKeterangan,
                  metode_pembayaran: formMetode,
                }
              : t
          )
        )
        showToast('Transaksi berhasil diperbarui di database!')
      } else {
        // INSERT into Supabase
        const payload: TablesInsert<'transaksi_kas'> = {
          tipe: formType,
          nominal: nominalNum,
          kategori: formKategori,
          tanggal: formTanggal,
          keterangan: formKeterangan,
          metode_pembayaran: formMetode,
          profil_id: activeProfile?.id || null,
        }

        const { data, error } = await supabase
          .from('transaksi_kas')
          .insert(payload)
          .select()
          .single()

        if (error) throw error
        setTransactions([data as TransaksiKas, ...transactions])
        showToast('Transaksi kas baru berhasil disimpan ke database!')
      }
      resetForm()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan transaksi.'
      alert(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (tx: TransaksiKas) => {
    setEditingId(tx.id)
    setFormType(tx.tipe as 'pemasukan' | 'pengeluaran')
    setFormNominal(String(tx.nominal))
    setFormKategori(tx.kategori)
    setFormTanggal(tx.tanggal || new Date().toISOString().slice(0, 10))
    setFormKeterangan(tx.keterangan || '')
    setFormMetode(tx.metode_pembayaran || 'Tunai')
    window.scrollTo({ top: 300, behavior: 'smooth' })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini? Data akan dihapus permanen.')) return

    if (isGuest) {
      setTransactions(transactions.filter((t) => t.id !== id))
      showToast('Transaksi berhasil dihapus.')
      return
    }

    try {
      const { error } = await supabase.from('transaksi_kas').delete().eq('id', id)
      if (error) throw error
      setTransactions(transactions.filter((t) => t.id !== id))
      showToast('Transaksi berhasil dihapus dari database.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus transaksi.'
      alert(msg)
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setFormNominal('')
    setFormKeterangan('')
    setFormTanggal(new Date().toISOString().slice(0, 10))
    setFormType('pemasukan')
    setFormKategori(KAS_CATEGORIES.pemasukan[0])
    setFormMetode('Tunai')
  }

  const exportCSV = () => {
    const headers = ['ID', 'Tanggal', 'Tipe', 'Kategori', 'Keterangan', 'Nominal', 'Metode Pembayaran']
    const rows = filteredTransactions.map((t) => [
      t.id,
      t.tanggal,
      t.tipe,
      t.kategori,
      `"${(t.keterangan || '').replace(/"/g, '""')}"`,
      t.nominal,
      t.metode_pembayaran || '-',
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `utera-buku-kas-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="dashboard-viewport">
      {/* Toast Notification */}
      {toastText && (
        <div className="toast-popup">
          <span className="material-symbols-rounded" style={{ color: '#10B981', fontSize: '18px' }}>
            check_circle
          </span>
          <span>{toastText}</span>
        </div>
      )}

      {/* TOP TITLE ROW */}
      <div className="page-title-row">
        <div>
          <h1 className="page-main-heading">Buku Kas Warung</h1>
          <p className="page-main-subheading">
            Catat arus kas harian, pantau grafik laba bulanan, dan kelola saldo riil warung Anda.
          </p>
        </div>

        <div className="page-title-actions">
          <button type="button" className="btn btn-outline-white" onClick={exportCSV}>
            <span className="material-symbols-rounded">download</span>
            <span>Unduh CSV</span>
          </button>
        </div>
      </div>

      {/* TWO COLUMN MAIN DASHBOARD GRID */}
      <div className="dashboard-grid">
        {/* LEFT COLUMN: Charts & Transactions Ledger */}
        <div className="grid-col-left">
          {/* CARD 1: GRAFIK LABA BERSIH BULANAN */}
          <section className="saas-card card-chart-profit">
            <div className="card-chart-header">
              <div>
                <span className="chart-eyebrow">TOTAL LABA BERSIH (PROFIT KASIR)</span>
                <div className="chart-metric-row">
                  <span className="chart-big-metric">
                    {formatRupiah(kasSummary.netProfit)}
                  </span>
                  <span className="trend-badge-positive">
                    <span className="material-symbols-rounded">trending_up</span>
                    <span>Margin {kasSummary.marginPct}%</span>
                  </span>
                </div>
                <span className="chart-date-caption">
                  Akumulasi dari {filteredTransactions.length} transaksi pembukuan kasir
                </span>
              </div>

              {/* Time Range Filter Pills */}
              <div className="time-filter-group" role="group">
                {(['1m', '3m', '6m', 'all'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`time-btn ${selectedRange === r ? 'is-active' : ''}`}
                    onClick={() => setSelectedRange(r)}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* SVG Interactive Area Chart Container */}
            <div className="chart-svg-wrapper">
              {monthlyData.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: '60px', color: 'var(--slate-400)', fontSize: '13px' }}>
                  Belum ada data bulanan. Catat transaksi untuk menampilkan kurva profit.
                </div>
              ) : (
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none" className="profit-svg">
                  <defs>
                    <linearGradient id="emeraldAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1F6B4F" stopOpacity="0.32" />
                      <stop offset="70%" stopColor="#1F6B4F" stopOpacity="0.06" />
                      <stop offset="100%" stopColor="#1F6B4F" stopOpacity="0.00" />
                    </linearGradient>
                    <linearGradient id="emeraldLineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#17543E" />
                      <stop offset="100%" stopColor="#10B981" />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines */}
                  <line x1={paddingX} y1={svgHeight - 20} x2={svgWidth - paddingX} y2={svgHeight - 20} stroke="#E2E8F0" strokeWidth="1" />
                  <line x1={paddingX} y1={svgHeight / 2} x2={svgWidth - paddingX} y2={svgHeight / 2} stroke="#F1F5F9" strokeWidth="1" strokeDasharray="4 4" />

                  {/* Area and Line */}
                  <path d={svgAreaPath} fill="url(#emeraldAreaGradient)" />
                  <path d={svgLinePath} fill="none" stroke="url(#emeraldLineGradient)" strokeWidth="3" strokeLinecap="round" />

                  {/* Dots & Labels */}
                  {points.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r={5} className="chart-data-dot" />
                      <text x={p.x} y={svgHeight - 4} className="chart-x-label">
                        {p.m.label}
                      </text>
                    </g>
                  ))}
                </svg>
              )}
            </div>
          </section>

          {/* CARD 2: LEMBAR TRANSAKSI KAS WARUNG & FILTER POOLS */}
          <section className="saas-card card-transactions-ledger">
            {/* Pool Tabs */}
            <div className="pool-tabs-header">
              <div className="pool-nav-list">
                <button
                  type="button"
                  className={`pool-tab ${activeTab === 'all' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('all')}
                >
                  SEMUA TRANSAKSI
                </button>
                <button
                  type="button"
                  className={`pool-tab ${activeTab === 'income' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('income')}
                >
                  PEMASUKAN
                </button>
                <button
                  type="button"
                  className={`pool-tab ${activeTab === 'expense' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('expense')}
                >
                  PENGELUARAN
                </button>
                <button
                  type="button"
                  className={`pool-tab ${activeTab === 'kulakan' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('kulakan')}
                >
                  BAHAN BAKU
                </button>
                <button
                  type="button"
                  className={`pool-tab ${activeTab === 'operasional' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('operasional')}
                >
                  OPERASIONAL
                </button>
              </div>

              <div className="pool-header-actions">
                <span className="pagination-info">
                  {filteredTransactions.length} transaksi aktif
                </span>
                <button
                  type="button"
                  className="btn-emerald-sm"
                  onClick={() => {
                    resetForm()
                    window.scrollTo({ top: 300, behavior: 'smooth' })
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>add</span>
                  <span>CATAT KAS</span>
                </button>
              </div>
            </div>

            {/* Search & Category Filter Row */}
            <div className="ledger-filter-row">
              <div className="table-search-box">
                <span className="material-symbols-rounded" style={{ color: 'var(--slate-400)', fontSize: '18px' }}>
                  search
                </span>
                <input
                  type="text"
                  placeholder="Cari transaksi kas, keterangan, atau kategori..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="category-select-wrap">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  aria-label="Filter kategori"
                >
                  <option value="all">Semua Kategori</option>
                  {[...KAS_CATEGORIES.pemasukan, ...KAS_CATEGORIES.pengeluaran].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="btn-secondary-clean"
                onClick={() => {
                  setSearchTerm('')
                  setActiveTab('all')
                  setFilterCategory('all')
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>refresh</span>
                <span>Reset</span>
              </button>
            </div>

            {/* SaaS Table */}
            <div className="table-responsive-clean">
              <table className="saas-table">
                <thead>
                  <tr>
                    <th className="th-date">Tanggal</th>
                    <th className="th-desc">Keterangan Transaksi</th>
                    <th className="th-cat">Kategori</th>
                    <th className="th-num" style={{ textAlign: 'right' }}>Uang Masuk</th>
                    <th className="th-num" style={{ textAlign: 'right' }}>Uang Keluar</th>
                    <th className="th-act" style={{ textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--slate-400)' }}>
                        Memuat data buku kas...
                      </td>
                    </tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--slate-500)' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '36px', display: 'block', marginBottom: '8px', color: 'var(--slate-300)' }}>
                          receipt_long
                        </span>
                        Belum ada transaksi kas yang dicatat.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <tr key={tx.id} className={editingId === tx.id ? 'is-editing' : ''}>
                        <td style={{ fontWeight: 600 }}>{tx.tanggal}</td>
                        <td>{tx.keterangan || '-'}</td>
                        <td>
                          <span className="badge-cat-pill">{tx.kategori}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--emerald)' }}>
                          {tx.tipe === 'pemasukan' ? formatRupiah(Number(tx.nominal)) : '-'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--terracotta)' }}>
                          {tx.tipe === 'pengeluaran' ? formatRupiah(Number(tx.nominal)) : '-'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="table-btn-action btn-edit"
                            title="Edit Transaksi"
                            onClick={() => handleEdit(tx)}
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>edit</span>
                          </button>
                          <button
                            type="button"
                            className="table-btn-action btn-del"
                            title="Hapus Transaksi"
                            onClick={() => handleDelete(tx.id)}
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>delete</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>TOTAL REKAP FILTER</td>
                    <td style={{ textAlign: 'right', color: 'var(--emerald)', fontWeight: 800 }}>
                      {formatRupiah(kasSummary.totalIncome)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--terracotta)', fontWeight: 800 }}>
                      {formatRupiah(kasSummary.totalExpense)}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '11px', color: 'var(--slate-500)' }}>
                      Saldo: {formatRupiah(kasSummary.netProfit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Business Card, 2x2 Rekap & Form Action Card */}
        <div className="grid-col-right">
          {/* Selector Card */}
          <div className="selector-card-group">
            <div className="selector-card">
              <div className="selector-icon-wrap" style={{ background: '#ECFDF5', color: '#10B981' }}>
                <span className="material-symbols-rounded">storefront</span>
              </div>
              <div className="selector-meta">
                <span className="selector-title">
                  {activeProfile?.nama_usaha || 'Kopi Nusantara'}
                </span>
                <span className="selector-desc">
                  {activeProfile?.jenis_usaha || 'Usaha Aktif • UMKM'}
                </span>
              </div>
            </div>
          </div>

          {/* Rekap Kinerja 2x2 */}
          <div className="commission-grid-card">
            <div className="commission-head-label">REKAP KINERJA KAS</div>
            <div className="grid-2x2">
              <div className="comm-cell">
                <span className="comm-val" style={{ color: 'var(--emerald)' }}>
                  {formatRupiah(kasSummary.totalIncome)}
                </span>
                <span className="comm-sub" style={{ color: 'var(--emerald)' }}>
                  Total Omzet
                </span>
              </div>
              <div className="comm-cell">
                <span className="comm-val" style={{ color: 'var(--terracotta)' }}>
                  {formatRupiah(kasSummary.totalExpense)}
                </span>
                <span className="comm-sub" style={{ color: 'var(--slate-500)' }}>
                  Total Biaya
                </span>
              </div>
              <div className="comm-cell">
                <span className="comm-val">
                  {kasSummary.marginPct}%
                </span>
                <span className="comm-sub" style={{ color: kasSummary.marginPct >= 20 ? 'var(--emerald)' : 'var(--terracotta)' }}>
                  {kasSummary.marginPct >= 20 ? 'Arus kas sehat' : 'Margin tipis'}
                </span>
              </div>
              <div className="comm-cell">
                <span className="comm-val" style={{ color: 'var(--primary)' }}>
                  {formatRupiah(guardrailLimit)}
                </span>
                <span className="comm-sub" style={{ color: 'var(--slate-500)' }}>
                  Batas Cicilan 30%
                </span>
              </div>
            </div>
          </div>

          {/* Action Card: Catat Transaksi Kas */}
          <section className="saas-card card-action-entry">
            <div className="entry-card-header">
              <h2 className="entry-title-text">
                {editingId ? 'Edit Transaksi Kas' : 'Catat Transaksi Kas'}
              </h2>
              <span className="entry-badge-live">
                {editingId ? 'Mode Edit' : 'Real-time'}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="entry-saas-form">
              {/* Type Segmented Toggle */}
              <div className="form-group-clean">
                <label className="form-label-clean">Tipe Arus Kas</label>
                <div className="type-segmented-toggle">
                  <label
                    className={`type-pill-label type-pill-in ${formType === 'pemasukan' ? 'is-active' : ''}`}
                    onClick={() => {
                      setFormType('pemasukan')
                      setFormKategori(KAS_CATEGORIES.pemasukan[0])
                    }}
                  >
                    <span>+ Pemasukan (Omzet)</span>
                  </label>
                  <label
                    className={`type-pill-label type-pill-out ${formType === 'pengeluaran' ? 'is-active' : ''}`}
                    onClick={() => {
                      setFormType('pengeluaran')
                      setFormKategori(KAS_CATEGORIES.pengeluaran[0])
                    }}
                  >
                    <span>- Pengeluaran (Biaya)</span>
                  </label>
                </div>
              </div>

              {/* Nominal */}
              <div className="form-group-clean">
                <label className="form-label-clean" htmlFor="nominal-input">
                  Nominal Transaksi (Rp)
                </label>
                <div className="numeric-input-card">
                  <span className="currency-prefix">Rp</span>
                  <input
                    type="number"
                    id="nominal-input"
                    className="numeric-amount-input"
                    placeholder="0"
                    min={1}
                    required
                    value={formNominal}
                    onChange={(e) => setFormNominal(e.target.value)}
                  />
                </div>
              </div>

              {/* Tanggal */}
              <div className="form-group-clean">
                <label className="form-label-clean" htmlFor="date-input">
                  Tanggal Pembukuan
                </label>
                <div className="numeric-input-card">
                  <input
                    type="date"
                    id="date-input"
                    className="date-input-clean"
                    required
                    value={formTanggal}
                    onChange={(e) => setFormTanggal(e.target.value)}
                  />
                </div>
              </div>

              {/* Kategori */}
              <div className="form-group-clean">
                <label className="form-label-clean" htmlFor="category-select">
                  Kategori Transaksi
                </label>
                <select
                  id="category-select"
                  className="select-clean"
                  value={formKategori}
                  onChange={(e) => setFormKategori(e.target.value)}
                >
                  {KAS_CATEGORIES[formType].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Metode Pembayaran */}
              <div className="form-group-clean">
                <label className="form-label-clean" htmlFor="method-select">
                  Metode Pembayaran
                </label>
                <select
                  id="method-select"
                  className="select-clean"
                  value={formMetode}
                  onChange={(e) => setFormMetode(e.target.value)}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Keterangan */}
              <div className="form-group-clean">
                <label className="form-label-clean" htmlFor="note-input">
                  Keterangan / Rincian
                </label>
                <input
                  type="text"
                  id="note-input"
                  className="text-input-clean"
                  placeholder="Contoh: Belanja Biji Kopi Robusta"
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                />
              </div>

              {/* Submit Button */}
              <div className="entry-cta-wrap" style={{ marginTop: '8px' }}>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-emerald-primary"
                  style={{ width: '100%', cursor: submitting ? 'not-allowed' : 'pointer' }}
                >
                  <span className="material-symbols-rounded">
                    {submitting ? 'hourglass_top' : editingId ? 'check_circle' : 'add'}
                  </span>
                  <span>
                    {submitting ? 'MENYIMPAN...' : editingId ? 'PERBARUI TRANSAKSI' : 'SIMPAN TRANSAKSI KAS'}
                  </span>
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="btn btn-secondary-clean"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={resetForm}
                  >
                    Batal Edit
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
