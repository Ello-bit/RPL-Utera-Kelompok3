'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DEMO_TRANSACTIONS } from '@/lib/demo-seed'
import { Tables } from '@/lib/database.types'
import { calculateSkorPRD, SkorResult } from '@/lib/skor'
import { formatRupiah } from '@/lib/kas'

type TransaksiKas = Tables<'transaksi_kas'>

export default function SkorKelayakanPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<TransaksiKas[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isGuest, setIsGuest] = useState(false)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setIsGuest(true)
        setTransactions(DEMO_TRANSACTIONS)
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('transaksi_kas')
        .select('*')
        .order('tanggal', { ascending: false })

      if (error) {
        console.error('Error fetching transactions:', error)
      } else if (data) {
        setTransactions(data as TransaksiKas[])
      }
      setLoading(false)
    }

    loadData()
  }, [])

  const skorData: SkorResult = calculateSkorPRD(transactions, isGuest)

  const handleSaveSnapshot = async () => {
    if (isGuest) {
      setMessage({ type: 'success', text: 'Mode Demo: Snapshot tersimpan di memori.' })
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('skor_kelayakan').insert({
        skor: skorData.total,
        kategori: skorData.category,
        omzet_bulanan: skorData.totals.pemasukan,
        laba_bersih: skorData.totals.laba,
        margin_profit: Math.round(skorData.totals.margin * 100),
        konsistensi_bulan: skorData.k1.score,
        catatan: `Evaluasi otomatis: ${skorData.badgeLabel}`,
      })

      if (error) throw error
      setMessage({ type: 'success', text: 'Riwayat skor kelayakan berhasil disimpan ke database!' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan snapshot.'
      setMessage({ type: 'error', text: msg })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
            Skor Kelayakan Bank (PRD)
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Indikator kesiapan kredit mikro dan kelayakan pengajuan KUR berdasarkan data arus kas harian Anda.
          </p>
        </div>
        <button
          onClick={handleSaveSnapshot}
          disabled={saving || loading}
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
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
            {saving ? 'hourglass_top' : 'bookmark'}
          </span>
          <span>{saving ? 'Menyimpan...' : 'Simpan Riwayat Skor'}</span>
        </button>
      </div>

      {/* Notice Message */}
      {message && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '8px',
            background: message.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            color: message.type === 'success' ? '#065F46' : '#991B1B',
            border: `1px solid ${message.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          <span className="material-symbols-rounded">
            {message.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Score Card */}
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          padding: '32px',
          marginBottom: '28px',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '32px',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            border: `8px solid ${skorData.badgeColor}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-main)', lineHeight: 1 }}>
            {skorData.total}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>/ 100</span>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: '12px',
                background: skorData.badgeBg,
                color: skorData.badgeColor,
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              {skorData.badgeLabel}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Kategori: <strong>{skorData.category}</strong>
            </span>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
            {skorData.total >= 70
              ? 'Arus Kas Warung Sangat Baik & Siap Diajukan ke Bank'
              : skorData.total >= 40
              ? 'Pencatatan Cukup Baik, Tingkatkan Konsistensi Transaksi'
              : 'Pencatatan Perlu Dilengkapi Sebelum Pengajuan Kredit'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.5 }}>
            Skor UTERA dihitung menggunakan algoritma resmi PRD: pembobotan konsistensi pembukuan (30%), tren pertumbuhan omzet (25%), rasio margin profitabilitas (25%), dan stabilitas arus kas positif (20%).
          </p>
        </div>
      </div>

      {/* 4 PRD Criteria Breakdown */}
      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '16px' }}>
        Rincian 4 Parameter Kelayakan
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '18px', marginBottom: '28px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              K1: Konsistensi Catat
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>
              {skorData.k1.score} / {skorData.k1.max}
            </span>
          </div>
          <div style={{ height: '6px', background: '#F1F5F3', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px' }}>
            <div style={{ width: `${(skorData.k1.score / skorData.k1.max) * 100}%`, height: '100%', background: 'var(--primary)' }} />
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{skorData.k1.detail}</p>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              K2: Tren Pemasukan
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>
              {skorData.k2.score} / {skorData.k2.max}
            </span>
          </div>
          <div style={{ height: '6px', background: '#F1F5F3', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px' }}>
            <div style={{ width: `${(skorData.k2.score / skorData.k2.max) * 100}%`, height: '100%', background: 'var(--primary)' }} />
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{skorData.k2.detail}</p>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              K3: Profit Margin
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>
              {skorData.k3.score} / {skorData.k3.max}
            </span>
          </div>
          <div style={{ height: '6px', background: '#F1F5F3', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px' }}>
            <div style={{ width: `${(skorData.k3.score / skorData.k3.max) * 100}%`, height: '100%', background: 'var(--primary)' }} />
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{skorData.k3.detail}</p>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              K4: Stabilitas Arus Kas
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>
              {skorData.k4.score} / {skorData.k4.max}
            </span>
          </div>
          <div style={{ height: '6px', background: '#F1F5F3', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px' }}>
            <div style={{ width: `${(skorData.k4.score / skorData.k4.max) * 100}%`, height: '100%', background: 'var(--primary)' }} />
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{skorData.k4.detail}</p>
        </div>
      </div>

      {/* 6 Months Historical Evaluation Table */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Rekap Finansial 6 Bulan Terakhir
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Evaluasi berkala yang dilihat oleh petugas analis bank mitra
          </p>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#F8FAF9', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '12px 24px' }}>Periode Bulan</th>
              <th style={{ padding: '12px 24px', textAlign: 'right' }}>Pemasukan (Omzet)</th>
              <th style={{ padding: '12px 24px', textAlign: 'right' }}>Pengeluaran (Biaya)</th>
              <th style={{ padding: '12px 24px', textAlign: 'right' }}>Laba Bersih</th>
              <th style={{ padding: '12px 24px', textAlign: 'center' }}>Status Arus Kas</th>
            </tr>
          </thead>
          <tbody>
            {skorData.monthlyData.map((m, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '14px 24px', fontWeight: 600 }}>{m.bulan}</td>
                <td style={{ padding: '14px 24px', textAlign: 'right', color: '#10B981', fontWeight: 600 }}>
                  {formatRupiah(m.pemasukan)}
                </td>
                <td style={{ padding: '14px 24px', textAlign: 'right', color: '#B5532F' }}>
                  {formatRupiah(m.pengeluaran)}
                </td>
                <td
                  style={{
                    padding: '14px 24px',
                    textAlign: 'right',
                    fontWeight: 700,
                    color: m.laba >= 0 ? 'var(--primary)' : '#DC2626',
                  }}
                >
                  {formatRupiah(m.laba)}
                </td>
                <td style={{ padding: '14px 24px', textAlign: 'center' }}>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: m.laba > 0 ? '#ECFDF5' : '#FEF2F2',
                      color: m.laba > 0 ? '#065F46' : '#991B1B',
                    }}
                  >
                    {m.laba > 0 ? 'Positif (Sehat)' : m.pemasukan === 0 ? 'Belum Ada Transaksi' : 'Defisit Kas'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
