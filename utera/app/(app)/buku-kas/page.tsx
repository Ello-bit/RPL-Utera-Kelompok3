'use client'

import { useRouter } from 'next/navigation'
import { getActiveProfilId, pickActiveProfile } from '@/lib/profil-aktif'
import { todayLocal, csvCell } from '@/lib/input'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/database.types'
import {
  calculateKasSummary,
  formatRupiah,
  KAS_CATEGORIES,
  getMonthlyBreakdown,
} from '@/lib/kas'
import CatatKasForm, { gulirKeCatatKas, ID_KARTU_CATAT_KAS } from '../catat-kas/catat-kas-form'
import KonfirmasiHapus from '../catat-kas/konfirmasi-hapus'
import { hapusTransaksi } from '@/lib/hapus-transaksi'
import './buku-kas.css'

type TransaksiKas = Tables<'transaksi_kas'>
type ProfilUsaha = Tables<'profil_usaha'>

export default function BukuKasPage() {
  const supabase = createClient()
  const router = useRouter()
  const [transactions, setTransactions] = useState<TransaksiKas[]>([])
  const [activeProfile, setActiveProfile] = useState<ProfilUsaha | null>(null)
  const [loading, setLoading] = useState(true)

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'all' | 'income' | 'expense' | 'kulakan' | 'operasional'>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRange, setSelectedRange] = useState<'1m' | '3m' | '6m' | 'all'>('6m')

  // Entry Form State
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toastText, setToastText] = useState<string | null>(null)
  const [toastAksi, setToastAksi] = useState<{ label: string; onClick: () => void } | null>(null)
  // Transaksi yang sedang diminta dihapus (menunggu konfirmasi)
  const [hapusTarget, setHapusTarget] = useState<TransaksiKas | null>(null)
  const [menghapus, setMenghapus] = useState(false)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // Halaman ini hanya untuk pengguna login (dijaga middleware)
      if (!user) {
        setLoading(false)
        return
      }

      // Fetch Profiles
      const { data: profData } = await supabase
        .from('profil_usaha')
        .select('*')
        .order('created_at', { ascending: false })

      let activeId: string | null = null
      if (profData && profData.length > 0) {
        const typedProfs = profData as ProfilUsaha[]
        const picked = pickActiveProfile(typedProfs, getActiveProfilId())!
        setActiveProfile(picked)
        activeId = picked.id
      }

      // Fetch Transactions (hanya milik usaha aktif)
      let txQuery = supabase.from('transaksi_kas').select('*')
      if (activeId) txQuery = txQuery.eq('profil_id', activeId)
      const { data: txData, error } = await txQuery.order('tanggal', { ascending: false })

      if (error) {
        console.error('Error fetching transactions:', error)
        alert('Gagal memuat transaksi: ' + error.message)
      } else if (txData) {
        setTransactions(txData as TransaksiKas[])
      }
      setLoading(false)
    }

    loadData()
  }, [])

  const showToast = (text: string, aksi?: { label: string; onClick: () => void }) => {
    setToastText(text)
    setToastAksi(aksi ?? null)
    // Toast yang punya tombol aksi tampil lebih lama supaya sempat ditekan
    setTimeout(() => {
      setToastText(null)
      setToastAksi(null)
    }, aksi ? 8000 : 3000)
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
    const count = selectedRange === '1m' ? 1 : selectedRange === '3m' ? 3 : selectedRange === '6m' ? 6 : 120
    return getMonthlyBreakdown(transactions, count)
  }, [transactions, selectedRange])

  const barMax = Math.max(...monthlyData.map((m) => Math.max(m.pemasukan, m.pengeluaran)), 1)
  const [pinnedBar, setPinnedBar] = useState<string | null>(null)

  const handleEdit = (tx: TransaksiKas) => {
    setEditingId(tx.id)
    gulirKeCatatKas()
  }

  // Formulir catat kas (komponen bersama) selesai menyimpan: perbarui daftar di halaman ini
  const setelahSimpan = (tx: TransaksiKas, mode: 'baru' | 'ubah') => {
    setTransactions((prev) => (mode === 'ubah' ? prev.map((t) => (t.id === tx.id ? tx : t)) : [tx, ...prev]))
    setEditingId(null)
    if (mode === 'ubah') {
      showToast('Transaksi berhasil diperbarui!')
    } else {
      showToast('Transaksi kas baru berhasil disimpan!', { label: 'Salah catat? Hapus', onClick: () => setHapusTarget(tx) })
    }
  }

  // Hapus transaksi setelah pengguna menekan "Ya, Hapus" di kotak konfirmasi
  const konfirmasiHapus = async () => {
    if (!hapusTarget) return
    setMenghapus(true)
    const err = await hapusTransaksi(supabase, hapusTarget)
    setMenghapus(false)
    if (err) {
      showToast('Gagal menghapus: ' + err)
      return
    }
    setTransactions((prev) => prev.filter((t) => t.id !== hapusTarget.id))
    if (editingId === hapusTarget.id) setEditingId(null)
    setHapusTarget(null)
    showToast('Transaksi berhasil dihapus.')
    router.refresh()
  }

  const resetForm = () => setEditingId(null)

  const exportCSV = () => {
    const headers = ['ID', 'Tanggal', 'Tipe', 'Kategori', 'Keterangan', 'Nominal', 'Metode Pembayaran']
    const rows = filteredTransactions.map((t) =>
      [t.id, t.tanggal, t.tipe, t.kategori, t.keterangan, t.nominal, t.metode_pembayaran || '-'].map(csvCell)
    )
    const csv = [headers.map(csvCell).join(','), ...rows.map((r) => r.join(','))].join('\r\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `utera-buku-kas-${todayLocal()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="dashboard-viewport">
      {/* Toast Notification */}
      {toastText && (
        <div className="toast-popup">
          <span className="material-symbols-rounded" style={{ color: 'var(--primary)', fontSize: '18px' }}>
            check_circle
          </span>
          <span>{toastText}</span>
          {toastAksi && (
            <button type="button" className="toast-aksi" onClick={toastAksi.onClick}>
              {toastAksi.label}
            </button>
          )}
        </div>
      )}

      {hapusTarget && (
        <KonfirmasiHapus
          tx={hapusTarget}
          menghapus={menghapus}
          onBatal={() => setHapusTarget(null)}
          onHapus={konfirmasiHapus}
        />
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
      <div className="dashboard-grid" data-loading={loading ? 'true' : undefined} aria-busy={loading}>
        {/* LEFT COLUMN: Charts & Transactions Ledger */}
        <div className="grid-col-left">
          {/* CARD 1: GRAFIK LABA BERSIH BULANAN */}
          <section className="saas-card card-chart-profit">
            <div className="card-chart-header">
              <div>
                <span className="chart-eyebrow">UNTUNG BERSIH</span>
                <div className="chart-metric-row">
                  <span className="chart-big-metric">
                    {loading ? 'Rp …' : formatRupiah(kasSummary.netProfit)}
                  </span>
                  {!loading && (
                    <span className="trend-badge-positive">
                      <span className="material-symbols-rounded">trending_up</span>
                      <span>Untung {kasSummary.marginPct}% dari penjualan</span>
                    </span>
                  )}
                </div>
                <span className="chart-date-caption">
                  {loading ? 'Memuat catatan transaksi…' : `Dihitung dari ${filteredTransactions.length} catatan transaksi`}
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
              {loading ? (
                <div role="status" style={{ textAlign: 'center', paddingTop: '60px', color: 'var(--slate-400)', fontSize: '13px' }}>
                  Memuat grafik…
                </div>
              ) : monthlyData.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: '60px', color: 'var(--slate-400)', fontSize: '13px' }}>
                  Belum ada data bulanan. Catat transaksi untuk menampilkan grafik.
                </div>
              ) : (
                <div className="kas-bars" role="img" aria-label="Grafik pemasukan, pengeluaran, dan laba per bulan">
                  {monthlyData.map((m) => {
                    const h = (v: number) => (v > 0 ? Math.max(4, Math.round((v / barMax) * 100)) : 2)
                    return (
                      <div key={m.key} className="kas-bar-group">
                        <div className="kas-bar-pair">
                          {([
                            { k: 'in', v: m.pemasukan, name: 'Pemasukan', cls: 'kas-bar-in' },
                            { k: 'out', v: m.pengeluaran, name: 'Pengeluaran', cls: 'kas-bar-out' },
                          ] as const).map((b) => {
                            const id = `${m.key}-${b.k}`
                            return (
                              <button
                                key={b.k}
                                type="button"
                                className={`kas-bar ${b.cls} ${pinnedBar === id ? 'show-tip' : ''}`}
                                style={{ height: `${h(b.v)}%` }}
                                aria-label={`${b.name} ${m.label}: ${formatRupiah(b.v)}`}
                                onClick={() => setPinnedBar((p) => (p === id ? null : id))}
                              >
                                <span className="kas-bar-tip">{b.name}: {formatRupiah(b.v)}</span>
                              </button>
                            )
                          })}
                        </div>
                        <span className="kas-bar-label">{m.label}</span>
                        <span className={`kas-bar-net ${m.labaBersih < 0 ? 'neg' : ''}`}>Laba {formatRupiah(m.labaBersih)}</span>
                      </div>
                    )
                  })}
                </div>
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
                    gulirKeCatatKas()
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
                    <th className="th-desc">Keterangan</th>
                    <th className="th-cat">Kategori</th>
                    <th className="th-num" style={{ textAlign: 'right' }}>Masuk (Rp)</th>
                    <th className="th-num" style={{ textAlign: 'right' }}>Keluar (Rp)</th>
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
                        <td className="num-cell" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--emerald)' }}>
                          {tx.tipe === 'pemasukan' ? Number(tx.nominal).toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="num-cell" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--terracotta)' }}>
                          {tx.tipe === 'pengeluaran' ? Number(tx.nominal).toLocaleString('id-ID') : '-'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="table-btn-action btn-edit"
                            title="Edit Transaksi"
                            aria-label="Edit transaksi"
                            onClick={() => handleEdit(tx)}
                          >
                            <span className="material-symbols-rounded">edit</span>
                          </button>
                          <button
                            type="button"
                            className="table-btn-action btn-del"
                            title="Hapus Transaksi"
                            aria-label="Hapus transaksi"
                            onClick={() => setHapusTarget(tx)}
                          >
                            <span className="material-symbols-rounded">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>TOTAL</td>
                    <td style={{ textAlign: 'right', color: 'var(--emerald)', fontWeight: 800 }}>
                      {formatRupiah(kasSummary.totalIncome)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--terracotta)', fontWeight: 800 }}>
                      {formatRupiah(kasSummary.totalExpense)}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '11px', color: 'var(--slate-500)' }}>
                      Selisih: {formatRupiah(kasSummary.netProfit)}
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
              <div className="selector-icon-wrap" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                <span className="material-symbols-rounded">storefront</span>
              </div>
              <div className="selector-meta">
                <span className="selector-title">
                  {activeProfile?.nama_usaha || 'Usaha Saya'}
                </span>
                <span className="selector-desc">
                  {activeProfile?.jenis_usaha || 'Usaha Aktif • UMKM'}
                </span>
              </div>
            </div>
          </div>

          {/* Rekap Kinerja 2x2 */}
          <div className="commission-grid-card">
            <div className="commission-head-label">RINGKASAN KAS</div>
            <div className="grid-2x2">
              <div className="comm-cell">
                <span className="comm-val" style={{ color: 'var(--emerald)' }}>
                  {formatRupiah(kasSummary.totalIncome)}
                </span>
                <span className="comm-sub" style={{ color: 'var(--emerald)' }}>
                  Total Penjualan
                </span>
              </div>
              <div className="comm-cell">
                <span className="comm-val" style={{ color: 'var(--terracotta)' }}>
                  {formatRupiah(kasSummary.totalExpense)}
                </span>
                <span className="comm-sub" style={{ color: 'var(--slate-500)' }}>
                  Total Pengeluaran
                </span>
              </div>
              <div className="comm-cell">
                <span className="comm-val">
                  {kasSummary.marginPct}%
                </span>
                <span className="comm-sub" style={{ color: kasSummary.marginPct >= 20 ? 'var(--emerald)' : 'var(--terracotta)' }}>
                  {kasSummary.marginPct >= 20 ? 'Keuntungan sehat' : 'Untung tipis'}
                </span>
              </div>
              <div className="comm-cell">
                <span className="comm-val" style={{ color: 'var(--primary)' }}>
                  {formatRupiah(guardrailLimit)}
                </span>
                <span className="comm-sub" style={{ color: 'var(--slate-500)' }}>
                  Batas Cicilan Aman
                </span>
              </div>
            </div>
          </div>

          {/* Action Card: Catat Transaksi Kas */}
          <section className="saas-card card-action-entry" id={ID_KARTU_CATAT_KAS}>
            <CatatKasForm
              key={editingId ?? 'baru'}
              editing={transactions.find((t) => t.id === editingId) ?? null}
              profilId={activeProfile?.id ?? null}
              onSaved={setelahSimpan}
              onCancelEdit={resetForm}
              onDelete={() => {
                const tx = transactions.find((t) => t.id === editingId)
                if (tx) setHapusTarget(tx)
              }}
            />
          </section>
        </div>
      </div>
    </div>
  )
}
