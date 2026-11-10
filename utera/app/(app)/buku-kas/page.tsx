'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DEMO_TRANSACTIONS, DEMO_PROFILES } from '@/lib/demo-seed'
import { Tables } from '@/lib/database.types'
import {
  calculateKasSummary,
  formatRupiah,
  KAS_CATEGORIES,
  PAYMENT_METHODS,
} from '@/lib/kas'

type TransaksiKas = Tables<'transaksi_kas'>
type ProfilUsaha = Tables<'profil_usaha'>

export default function BukuKasPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<TransaksiKas[]>([])
  const [profiles, setProfiles] = useState<ProfilUsaha[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string>('')
  const [isGuest, setIsGuest] = useState(false)
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterType, setFilterType] = useState<'all' | 'pemasukan' | 'pengeluaran'>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<TransaksiKas | null>(null)
  const [formType, setFormType] = useState<'pemasukan' | 'pengeluaran'>('pemasukan')
  const [formNominal, setFormNominal] = useState<string>('')
  const [formKategori, setFormKategori] = useState<string>('Penjualan')
  const [formTanggal, setFormTanggal] = useState<string>(
    new Date().toISOString().slice(0, 10)
  )
  const [formKeterangan, setFormKeterangan] = useState<string>('')
  const [formMetode, setFormMetode] = useState<string>('Tunai')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
        if (DEMO_PROFILES.length > 0) setActiveProfileId(DEMO_PROFILES[0].id)
        setLoading(false)
        return
      }

      // 1. Fetch user's profiles
      const { data: profData } = await supabase
        .from('profil_usaha')
        .select('*')
        .order('created_at', { ascending: false })

      if (profData && profData.length > 0) {
        setProfiles(profData as ProfilUsaha[])
        setActiveProfileId(profData[0].id)
      }

      // 2. Fetch live transactions
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

  // Filtered transactions
  const filteredList = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterType !== 'all' && tx.tipe !== filterType) return false
      if (filterCategory !== 'all' && tx.kategori !== filterCategory) return false
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase()
        const matchNote = tx.keterangan?.toLowerCase().includes(query)
        const matchCat = tx.kategori?.toLowerCase().includes(query)
        if (!matchNote && !matchCat) return false
      }
      return true
    })
  }, [transactions, filterType, filterCategory, searchTerm])

  const summary = useMemo(() => {
    return calculateKasSummary(filteredList)
  }, [filteredList])

  const handleOpenAdd = () => {
    setEditingTx(null)
    setFormType('pemasukan')
    setFormNominal('')
    setFormKategori(KAS_CATEGORIES.pemasukan[0])
    setFormTanggal(new Date().toISOString().slice(0, 10))
    setFormKeterangan('')
    setFormMetode('Tunai')
    setIsModalOpen(true)
    setFeedback(null)
  }

  const handleOpenEdit = (tx: TransaksiKas) => {
    setEditingTx(tx)
    setFormType(tx.tipe as 'pemasukan' | 'pengeluaran')
    setFormNominal(String(tx.nominal))
    setFormKategori(tx.kategori)
    setFormTanggal(tx.tanggal || new Date().toISOString().slice(0, 10))
    setFormKeterangan(tx.keterangan || '')
    setFormMetode(tx.metode_pembayaran || 'Tunai')
    setIsModalOpen(true)
    setFeedback(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) return

    if (isGuest) {
      setTransactions(transactions.filter((t) => t.id !== id))
      return
    }

    try {
      const { error } = await supabase.from('transaksi_kas').delete().eq('id', id)
      if (error) throw error
      setTransactions(transactions.filter((t) => t.id !== id))
      setFeedback({ type: 'success', text: 'Transaksi berhasil dihapus!' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus transaksi.'
      setFeedback({ type: 'error', text: msg })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nominalNum = parseInt(formNominal.replace(/[^0-9]/g, ''), 10)
    if (!nominalNum || nominalNum <= 0) {
      alert('Nominal harus lebih dari 0.')
      return
    }

    if (isGuest) {
      const newTx: TransaksiKas = {
        id: 'tx_guest_' + Date.now(),
        user_id: 'guest',
        profil_id: activeProfileId || null,
        tipe: formType,
        nominal: nominalNum,
        kategori: formKategori,
        tanggal: formTanggal,
        keterangan: formKeterangan,
        metode_pembayaran: formMetode,
        created_at: new Date().toISOString(),
      }
      setTransactions([newTx, ...transactions])
      setIsModalOpen(false)
      return
    }

    setSubmitting(true)
    try {
      if (editingTx) {
        // UPDATE
        const { error } = await supabase
          .from('transaksi_kas')
          .update({
            tipe: formType,
            nominal: nominalNum,
            kategori: formKategori,
            tanggal: formTanggal,
            keterangan: formKeterangan,
            metode_pembayaran: formMetode,
            profil_id: activeProfileId || null,
          })
          .eq('id', editingTx.id)

        if (error) throw error

        setTransactions(
          transactions.map((t) =>
            t.id === editingTx.id
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
        setFeedback({ type: 'success', text: 'Transaksi berhasil diperbarui!' })
      } else {
        // INSERT
        const { data, error } = await supabase
          .from('transaksi_kas')
          .insert({
            tipe: formType,
            nominal: nominalNum,
            kategori: formKategori,
            tanggal: formTanggal,
            keterangan: formKeterangan,
            metode_pembayaran: formMetode,
            profil_id: activeProfileId || null,
          })
          .select()
          .single()

        if (error) throw error
        setTransactions([data as TransaksiKas, ...transactions])
        setFeedback({ type: 'success', text: 'Transaksi baru berhasil dicatat!' })
      }
      setIsModalOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan transaksi.'
      setFeedback({ type: 'error', text: msg })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: '28px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
            Buku Kas Warung
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Catat arus kas harian, pantau saldo riil kasir, dan kelola histori transaksi usaha Anda.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '8px',
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>add</span>
          <span>Catat Kas Baru</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '8px',
            background: feedback.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            color: feedback.type === 'success' ? '#065F46' : '#991B1B',
            border: `1px solid ${feedback.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          <span className="material-symbols-rounded">
            {feedback.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{feedback.text}</span>
        </div>
      )}

      {/* 4 Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '18px',
          marginBottom: '28px',
        }}
      >
        <div style={{ background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Saldo Kas
          </span>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: summary.saldoKas >= 0 ? 'var(--text-main)' : '#DC2626', marginTop: '6px' }}>
            {formatRupiah(summary.saldoKas)}
          </h2>
          <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Akumulasi bersih kas warung
          </small>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Pemasukan (Omzet)
          </span>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10B981', marginTop: '6px' }}>
            {formatRupiah(summary.totalIncome)}
          </h2>
          <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Total arus kas masuk tercatat
          </small>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Pengeluaran (Biaya)
          </span>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#B5532F', marginTop: '6px' }}>
            {formatRupiah(summary.totalExpense)}
          </h2>
          <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Bahan baku & operasional
          </small>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Margin Laba Bersih
          </span>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', marginTop: '6px' }}>
            {summary.marginPct}%
          </h2>
          <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            {summary.count} transaksi terfilter
          </small>
        </div>
      </div>

      {/* Filter Bar & Tabs */}
      <div
        style={{
          background: '#fff',
          borderRadius: '14px',
          border: '1px solid var(--border-subtle)',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Type Tabs */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['all', 'pemasukan', 'pengeluaran'] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setFilterType(t)
                setFilterCategory('all')
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: filterType === t ? 'var(--primary)' : '#F1F5F3',
                color: filterType === t ? '#fff' : 'var(--text-body)',
                fontWeight: 600,
                fontSize: '0.825rem',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {t === 'all' ? 'Semua' : t}
            </button>
          ))}
        </div>

        {/* Search & Category Filter */}
        <div style={{ display: 'flex', gap: '12px', flex: 1, maxWidth: '500px', justifyContent: 'flex-end' }}>
          <input
            type="text"
            placeholder="Cari keterangan / kategori..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.85rem',
              width: '100%',
              maxWidth: '260px',
              outline: 'none',
            }}
          />
          <button
            onClick={() => {
              setSearchTerm('')
              setFilterType('all')
              setFilterCategory('all')
            }}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              background: '#fff',
              fontSize: '0.825rem',
              cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#F8FAF9', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <th style={{ padding: '14px 18px' }}>Tanggal</th>
              <th style={{ padding: '14px 18px' }}>Keterangan</th>
              <th style={{ padding: '14px 18px' }}>Kategori</th>
              <th style={{ padding: '14px 18px' }}>Metode</th>
              <th style={{ padding: '14px 18px', textAlign: 'right' }}>Nominal</th>
              <th style={{ padding: '14px 18px', textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Memuat data kas...
                </td>
              </tr>
            ) : filteredList.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '36px', display: 'block', marginBottom: '8px', color: 'var(--text-light)' }}>
                    receipt_long
                  </span>
                  Belum ada transaksi kas yang dicatat.
                  <br />
                  <button
                    onClick={handleOpenAdd}
                    style={{
                      marginTop: '12px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: 'var(--primary)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.825rem',
                    }}
                  >
                    + Catat Transaksi Pertama
                  </button>
                </td>
              </tr>
            ) : (
              filteredList.map((tx) => (
                <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '14px 18px', fontWeight: 600 }}>{tx.tanggal}</td>
                  <td style={{ padding: '14px 18px' }}>{tx.keterangan || '-'}</td>
                  <td style={{ padding: '14px 18px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: tx.tipe === 'pemasukan' ? '#ECFDF5' : '#FEF2F2',
                        color: tx.tipe === 'pemasukan' ? '#065F46' : '#991B1B',
                      }}
                    >
                      {tx.kategori}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {tx.metode_pembayaran || 'Tunai'}
                  </td>
                  <td
                    style={{
                      padding: '14px 18px',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: tx.tipe === 'pemasukan' ? '#10B981' : '#B5532F',
                    }}
                  >
                    {tx.tipe === 'pemasukan' ? '+ ' : '- '}
                    {formatRupiah(Number(tx.nominal))}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        onClick={() => handleOpenEdit(tx)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
                        title="Edit"
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(tx.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}
                        title="Hapus"
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Catat / Edit Transaksi */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: 'var(--shadow-modal)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {editingTx ? 'Edit Transaksi Kas' : 'Catat Transaksi Kas'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Type Toggle */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setFormType('pemasukan')
                    setFormKategori(KAS_CATEGORIES.pemasukan[0])
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: formType === 'pemasukan' ? '#10B981' : '#F1F5F3',
                    color: formType === 'pemasukan' ? '#fff' : 'var(--text-body)',
                  }}
                >
                  + Pemasukan (Omzet)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormType('pengeluaran')
                    setFormKategori(KAS_CATEGORIES.pengeluaran[0])
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: formType === 'pengeluaran' ? '#B5532F' : '#F1F5F3',
                    color: formType === 'pengeluaran' ? '#fff' : 'var(--text-body)',
                  }}
                >
                  - Pengeluaran (Biaya)
                </button>
              </div>

              {/* Nominal */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '4px' }}>
                  Nominal (Rp) <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="Contoh: 150000"
                  value={formNominal}
                  onChange={(e) => setFormNominal(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.95rem', outline: 'none' }}
                />
              </div>

              {/* Kategori */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '4px' }}>
                  Kategori
                </label>
                <select
                  value={formKategori}
                  onChange={(e) => setFormKategori(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem', outline: 'none', background: '#fff' }}
                >
                  {KAS_CATEGORIES[formType].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tanggal */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '4px' }}>
                  Tanggal
                </label>
                <input
                  type="date"
                  required
                  value={formTanggal}
                  onChange={(e) => setFormTanggal(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              {/* Metode Pembayaran */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '4px' }}>
                  Metode Pembayaran
                </label>
                <select
                  value={formMetode}
                  onChange={(e) => setFormMetode(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem', outline: 'none', background: '#fff' }}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Keterangan */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '4px' }}>
                  Keterangan Transaksi
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Belanja Biji Kopi Robusta"
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  {submitting ? 'Menyimpan...' : editingTx ? 'Perbarui Transaksi' : 'Simpan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
