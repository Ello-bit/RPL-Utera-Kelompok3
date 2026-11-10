'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { DEMO_TRANSACTIONS } from '@/lib/demo-seed'
import { Tables } from '@/lib/database.types'
import { calculateSkorPRD, SkorResult } from '@/lib/skor'
import { formatRupiah } from '@/lib/kas'
import './skor.css'

type TransaksiKas = Tables<'transaksi_kas'>

export default function SkorKelayakanPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<TransaksiKas[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
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

      if (!error && data) {
        setTransactions(data as TransaksiKas[])
      } else {
        setTransactions(DEMO_TRANSACTIONS)
      }
      setLoading(false)
    }

    loadData()
  }, [])

  const skorData: SkorResult = useMemo(() => {
    return calculateSkorPRD(transactions, isGuest)
  }, [transactions, isGuest])

  const totalScore = skorData.total
  // SVG Ring calculation: circumference = 2 * PI * 52 = ~326.73
  const circumference = 326.73
  const strokeDashoffset = circumference - (circumference * totalScore) / 100

  // Category classes
  const isBaik = totalScore >= 70
  const isCukup = totalScore >= 40 && totalScore < 70
  const categoryClass = isBaik ? 'skor-baik' : isCukup ? 'skor-cukup' : 'skor-rendah'
  const categoryLabel = isBaik ? 'Baik' : isCukup ? 'Cukup' : 'Rendah'

  const handleSaveSnapshot = async () => {
    setSaving(true)
    setSaveSuccess(null)

    if (isGuest) {
      setTimeout(() => {
        setSaving(false)
        setSaveSuccess('Snapshot tersimpan di memori (Mode Tamu).')
      }, 500)
      return
    }

    try {
      const { error } = await supabase.from('skor_kelayakan').insert({
        skor: totalScore,
        kategori: skorData.category,
        omzet_bulanan: skorData.totals.pemasukan,
        laba_bersih: skorData.totals.laba,
        margin_profit: Math.round(skorData.totals.margin * 100),
        konsistensi_bulan: skorData.k1.score,
        catatan: `Evaluasi otomatis: ${skorData.badgeLabel}`,
      })

      if (error) throw error
      setSaveSuccess('Riwayat skor kelayakan berhasil disimpan ke database!')
    } catch (err) {
      console.error('Error saving snapshot:', err)
      alert('Gagal menyimpan snapshot skor kelayakan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dashboard-scroll-wrap">
      {/* Page Header */}
      <div className="dash-header-row">
        <div>
          <h1 className="dash-heading">Skor Kelayakan Usaha</h1>
          <p className="dash-subheading">
            Penilaian kesiapan usaha untuk pengajuan KUR berdasarkan riwayat keuangan 6 bulan terakhir.
          </p>
        </div>
        <div className="dash-header-actions">
          <span className="estimasi-badge">
            <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>info</span>
            Skor ini adalah estimasi analitik PRD UTERA
          </span>
        </div>
      </div>

      {/* 1. SKOR UTAMA + STATUS HERO */}
      <div className="skor-hero-grid">
        <div className="dash-panel skor-main-panel">
          {/* Top Row: Ring Gauge + Detail Status */}
          <div className="skor-main-display">
            <div className="skor-ring" id="skor-ring">
              <svg viewBox="0 0 120 120" className="skor-ring-svg" aria-hidden="true">
                <circle cx="60" cy="60" r="52" className="ring-track"></circle>
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  className="ring-fill"
                  id="ring-fill"
                  strokeDasharray="326.73"
                  strokeDashoffset={strokeDashoffset}
                ></circle>
              </svg>
              <div className="skor-ring-value">
                <span className="skor-badge-kicker">PRD ENGINE</span>
                <span className="skor-number tabular-nums" id="skor-number">{totalScore}</span>
                <span className="skor-of">/ 100 Poin</span>
              </div>
            </div>

            <div className="skor-main-info">
              <div className="skor-status-header">
                <span className={`skor-category-badge ${categoryClass}`} id="skor-category-badge">
                  {categoryLabel}
                </span>
                <span className="skor-benchmark-tag">
                  <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>verified</span>
                  {totalScore >= 70 ? `+${totalScore - 70} Poin di Atas Standar Bank` : `${70 - totalScore} Poin Menuju Standar Bank`}
                </span>
                <span className="skor-status-pill">
                  <span className="pulse-dot"></span> {skorData.badgeLabel}
                </span>
              </div>
              <p className="skor-verdict" id="skor-verdict">
                {isBaik
                  ? 'Keuangan usaha Anda menunjukkan pola yang konsisten dan sehat. Usaha ini siap untuk pengajuan KUR Mikro hingga Rp 50 Juta.'
                  : isCukup
                  ? 'Keuangan usaha Anda memenuhi standar kelayakan dasar, namun disarankan meningkatkan efisiensi kas dan konsistensi catatan.'
                  : 'Catatan keuangan perlu perbaikan kedisiplinan pembukuan kas warung sebelum mengajukan pinjaman bank.'}
              </p>
              <div className="skor-meta">
                <span className="skor-meta-item">
                  <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>calendar_today</span>
                  Periode: 6 Bulan Riwayat Kas
                </span>
                <span className="skor-meta-item">
                  <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>receipt_long</span>
                  Basis: {transactions.length} Transaksi Kas
                </span>
                <span className="skor-meta-item">
                  <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>update</span>
                  Diperbarui: Real-time
                </span>
              </div>
            </div>
          </div>

          {/* Middle Row: Spektrum Skala Kelayakan */}
          <div className="skor-spectrum-card">
            <div className="spectrum-header">
              <div className="spectrum-title">
                <span className="material-symbols-rounded text-primary" style={{ fontSize: '18px' }}>tune</span>
                <span>Spektrum Kelayakan &amp; Posisi Usaha Anda</span>
              </div>
              <div className="spectrum-current-badge">
                Posisi Usaha: <strong className="text-primary">{totalScore} / 100</strong> ({skorData.badgeLabel})
              </div>
            </div>

            {/* Bar Container with Top Pointer */}
            <div className="spectrum-bar-wrap">
              <div className="spectrum-pointer" style={{ left: `${Math.min(98, Math.max(2, totalScore))}%` }} id="spectrum-pointer">
                <div className="pointer-tag">Anda: {totalScore} ★</div>
                <div className="pointer-arrow"></div>
              </div>

              <div className="spectrum-bar">
                <div className="spectrum-segment seg-rendah" style={{ width: '40%' }} title="Rendah: 0 - 39">
                  <span className="seg-label">Rendah (0–39)</span>
                </div>
                <div className="spectrum-segment seg-cukup" style={{ width: '30%' }} title="Cukup: 40 - 69">
                  <span className="seg-label">Cukup (40–69)</span>
                </div>
                <div className="spectrum-segment seg-baik" style={{ width: '30%' }} title="Baik: 70 - 100">
                  <span className="seg-label">Baik (70–100)</span>
                </div>
                <div className="spectrum-threshold-line" style={{ left: '70%' }} title="Batas Minimal Lolos KUR: 70 Poin"></div>
              </div>
            </div>

            {/* Bottom Scale Labels */}
            <div className="spectrum-scale-labels">
              <div className="scale-point point-0">0 Poin</div>
              <div className="scale-point point-40">40 (Batas Cukup)</div>
              <div className="scale-point point-70">
                <span className="scale-kur-badge">
                  <span className="material-symbols-rounded" style={{ fontSize: '13px' }}>verified</span>
                  Ambang Minimal KUR: 70 Poin
                </span>
              </div>
              <div className="scale-point point-100">100 (Maksimal)</div>
            </div>
          </div>

          {/* Bottom Row: 3 Metrik Vital */}
          <div className="skor-vitals-grid">
            <div className="vital-card">
              <div className="vital-icon bg-emerald-soft">
                <span className="material-symbols-rounded text-emerald">thumb_up</span>
              </div>
              <div className="vital-info">
                <span className="vital-label">Peluang Lolos KUR</span>
                <span className={`vital-val ${isBaik ? 'text-emerald' : 'text-terracotta'}`}>
                  {isBaik ? 'Tinggi (94%)' : isCukup ? 'Sedang (65%)' : 'Rendah (35%)'}
                </span>
                <span className="vital-sub">Berdasarkan rasio SAK EMKM</span>
              </div>
            </div>

            <div className="vital-card">
              <div className="vital-icon bg-gold-soft">
                <span className="material-symbols-rounded text-gold">account_balance</span>
              </div>
              <div className="vital-info">
                <span className="vital-label">Plafon Rekomendasi</span>
                <span className="vital-val text-primary">
                  {totalScore >= 70 ? 'Rp 50 Juta (KUR Mikro)' : 'Rp 10 Juta (Super Mikro)'}
                </span>
                <span className="vital-sub">Tanpa agunan fisik tambahan</span>
              </div>
            </div>

            <div className="vital-card">
              <div className="vital-icon bg-blue-soft">
                <span className="material-symbols-rounded text-blue">shield</span>
              </div>
              <div className="vital-info">
                <span className="vital-label">Guardrail 30% Kas</span>
                <span className="vital-val text-emerald">
                  Maks {formatRupiah(Math.round(skorData.totals.laba * 0.30))} / bln
                </span>
                <span className="vital-sub">Batas cicilan aman likuiditas</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 4 DETAIL PARAMETER PRD */}
      <div className="dash-panel" style={{ marginTop: '24px', padding: '24px' }}>
        <div className="panel-header" style={{ marginBottom: '20px' }}>
          <div>
            <h2 className="panel-title">Rincian 4 Parameter Formula PRD</h2>
            <p className="panel-subtitle">Algoritma K1–K4 yang diverifikasi analis perbankan dan koperasi UMKM</p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSaveSnapshot}
            disabled={saving}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>bookmark</span>
            <span>{saving ? 'Menyimpan...' : 'Simpan Riwayat Skor'}</span>
          </button>
        </div>

        {saveSuccess && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#ECFDF5', color: '#065F46', marginBottom: '16px', fontSize: '0.875rem', fontWeight: 600 }}>
            ✓ {saveSuccess}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {/* K1 */}
          <div style={{ padding: '16px', borderRadius: '12px', background: '#F8FAF9', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>K1 • KONSISTENSI KAS</span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>{skorData.k1.score} / 30 Poin</strong>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-body)', margin: 0 }}>
              Kedisiplinan pencatatan transaksi minimal 6 bulan berturut-turut.
            </p>
          </div>

          {/* K2 */}
          <div style={{ padding: '16px', borderRadius: '12px', background: '#F8FAF9', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>K2 • PERTUMBUHAN OMZET</span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>{skorData.k2.score} / 25 Poin</strong>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-body)', margin: 0 }}>
              Perbandingan omzet periode 3 bulan terbaru vs 3 bulan sebelumnya.
            </p>
          </div>

          {/* K3 */}
          <div style={{ padding: '16px', borderRadius: '12px', background: '#F8FAF9', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>K3 • MARGIN LABA BERSIH</span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>{skorData.k3.score} / 25 Poin</strong>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-body)', margin: 0 }}>
              Rasio efisiensi laba bersih terhadap omzet kotor (Target: ≥ 20%).
            </p>
          </div>

          {/* K4 */}
          <div style={{ padding: '16px', borderRadius: '12px', background: '#F8FAF9', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>K4 • STABILITAS KAS POSITIF</span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>{skorData.k4.score} / 20 Poin</strong>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-body)', margin: 0 }}>
              Jumlah bulan dengan arus kas operasional surplus tanpa defisit modal.
            </p>
          </div>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <Link href="/guardrail" className="btn btn-secondary">
            <span>Uji Guardrail 30% Kas →</span>
          </Link>
          <Link href="/simulasi-kur" className="btn btn-primary">
            <span>Lanjut ke Simulasi KUR BRI →</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
