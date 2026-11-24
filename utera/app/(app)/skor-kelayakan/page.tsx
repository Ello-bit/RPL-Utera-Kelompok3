'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/database.types'
import { calculateSkorPRD, buildSkorSnapshot, rataLabaBulanan, SkorResult } from '@/lib/skor'
import { getActiveProfilId, pickActiveProfile } from '@/lib/profil-aktif'
import { formatRupiah } from '@/lib/kas'
import './skor.css'

type TransaksiKas = Tables<'transaksi_kas'>

export default function SkorKelayakanPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<TransaksiKas[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [profilId, setProfilId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

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

      const { data: profs } = await supabase
        .from('profil_usaha')
        .select('id')
        .order('created_at', { ascending: false })
      const active = pickActiveProfile(profs ?? [], getActiveProfilId())
      setProfilId(active?.id ?? null)

      let query = supabase.from('transaksi_kas').select('*')
      if (active) query = query.eq('profil_id', active.id)
      const { data, error } = await query.order('tanggal', { ascending: false })

      if (error) {
        // Pengguna login tidak boleh melihat data demo bila query gagal.
        setLoadError(error.message)
        setTransactions([])
      } else {
        setTransactions((data ?? []) as TransaksiKas[])
      }
      setLoading(false)
    }

    loadData()
  }, [])

  const skorData: SkorResult = useMemo(() => {
    return calculateSkorPRD(transactions)
  }, [transactions])

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

    try {
      const { error } = await supabase
        .from('skor_kelayakan')
        .insert({ ...buildSkorSnapshot(skorData), profil_id: profilId })

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
            Kesiapan usaha untuk KUR, dihitung dari kas 6 bulan terakhir.
          </p>
        </div>
        <div className="dash-header-actions">
          <span className="estimasi-badge">
            <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>info</span>
            Skor ini adalah estimasi UTERA, bukan keputusan bank
          </span>
        </div>
      </div>

      {loadError && (
        <p role="alert" className="dash-subheading" style={{ color: '#B5532F' }}>
          Gagal memuat transaksi: {loadError}
        </p>
      )}
      {!loading && skorData.dataKurang && skorData.category !== 'Belum Ada Data' && (
        <p role="status" className="dash-subheading" style={{ color: '#8A5E0F' }}>
          Data belum cukup: baru {skorData.k1.detail}. Skor makin akurat setelah 6 bulan tercatat.
        </p>
      )}

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
                <span className="skor-badge-kicker">SKOR UTERA</span>
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
                  ? 'Keuangan usaha konsisten dan sehat. Siap mengajukan KUR Mikro hingga Rp 50 Juta.'
                  : isCukup
                  ? 'Memenuhi standar dasar. Tingkatkan efisiensi kas dan konsistensi catatan.'
                  : 'Rapikan pencatatan kas dulu sebelum mengajukan pinjaman.'}
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
              </div>
            </div>
          </div>

          {/* Middle Row: Spektrum Skala Kelayakan */}
          <div className="skor-spectrum-card">
            <div className="spectrum-header">
              <div className="spectrum-title">
                <span className="material-symbols-rounded text-primary" style={{ fontSize: '18px' }}>tune</span>
                <span>Posisi Skor Anda</span>
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
                  {isBaik ? 'Tinggi' : isCukup ? 'Sedang' : 'Rendah'}
                </span>
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
              </div>
            </div>

            <div className="vital-card">
              <div className="vital-icon bg-blue-soft">
                <span className="material-symbols-rounded text-blue">shield</span>
              </div>
              <div className="vital-info">
                <span className="vital-label">Batas Aman Cicilan (30%)</span>
                <span className="vital-val text-emerald">
                  Maks {formatRupiah(Math.max(0, Math.round(rataLabaBulanan(skorData) * 0.30)))} / bln
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 4 DETAIL PARAMETER PRD */}
      <div className="dash-panel" style={{ marginTop: '24px', padding: '24px' }}>
        <div className="panel-header" style={{ marginBottom: '20px' }}>
          <div>
            <h2 className="panel-title">Rincian 4 Komponen Skor</h2>
            <p className="panel-subtitle">Dari catatan kas 6 bulan terakhir</p>
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
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#EEF7F2', color: '#12402F', marginBottom: '16px', fontSize: '0.875rem', fontWeight: 600 }}>
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
              Bulan yang ada catatan, dari 6 bulan
            </p>
          </div>

          {/* K2 */}
          <div style={{ padding: '16px', borderRadius: '12px', background: '#F8FAF9', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>K2 • PERTUMBUHAN OMZET</span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>{skorData.k2.score} / 25 Poin</strong>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-body)', margin: 0 }}>
              Omzet 3 bulan terbaru vs 3 bulan sebelumnya
            </p>
          </div>

          {/* K3 */}
          <div style={{ padding: '16px', borderRadius: '12px', background: '#F8FAF9', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>K3 • MARGIN LABA BERSIH</span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>{skorData.k3.score} / 25 Poin</strong>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-body)', margin: 0 }}>
              Laba dibanding omzet (target 20%)
            </p>
          </div>

          {/* K4 */}
          <div style={{ padding: '16px', borderRadius: '12px', background: '#F8FAF9', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>K4 • STABILITAS KAS POSITIF</span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>{skorData.k4.score} / 20 Poin</strong>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-body)', margin: 0 }}>
              Bulan dengan laba positif
            </p>
          </div>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <Link href="/guardrail" className="btn btn-secondary">
            <span>Cek Batas Aman Cicilan →</span>
          </Link>
          <Link href="/simulasi-kur" className="btn btn-primary">
            <span>Lanjut ke Simulasi KUR BRI →</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
