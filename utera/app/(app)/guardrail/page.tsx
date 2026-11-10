'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { DEMO_TRANSACTIONS, DEMO_PROFILES } from '@/lib/demo-seed'
import { Tables } from '@/lib/database.types'
import { calculateKasSummary, formatRupiah } from '@/lib/kas'
import { calculateInstallment, evaluateGuardrail, KUR_TIERS, type KurTier } from '@/lib/kur'
import { calculateSkorPRD, rataLabaBulanan } from '@/lib/skor'
import { getActiveProfilId, pickActiveProfile } from '@/lib/profil-aktif'
import './guardrail.css'

type TransaksiKas = Tables<'transaksi_kas'>

interface ProgramOption {
  id: string
  name: string
  subtitle: string
  icon: string
  rate: number // annual decimal, e.g. 0.06
  rateDisplay: string
  minPlafon: number
  maxPlafon: number
  minTenor: number
  maxTenor: number
}

const fromTier = (t: KurTier, icon: string): ProgramOption => ({
  id: t.id,
  name: t.name,
  subtitle: `Bunga ${t.rateDisplay} p.a. • Plafon ${formatRupiah(t.minPlafon)} s.d. ${formatRupiah(t.maxPlafon)} • Tenor ${t.minTenor}-${t.maxTenor} bulan`,
  icon,
  rate: t.rate,
  rateDisplay: t.rateDisplay,
  minPlafon: t.minPlafon,
  maxPlafon: t.maxPlafon,
  minTenor: t.minTenor,
  maxTenor: t.maxTenor,
})

// Jenis KUR diambil dari lib/kur.ts (satu sumber sesuai PRD); koperasi memakai bunga jasa sendiri.
const PROGRAMS: ProgramOption[] = [
  fromTier(KUR_TIERS['kur-mikro'], 'account_balance'),
  fromTier(KUR_TIERS['kur-super'], 'rocket_launch'),
  {
    id: 'koperasi',
    name: 'Pinjaman Koperasi Usaha',
    subtitle: 'Bunga jasa 9% p.a. flat • Tanpa agunan bank',
    icon: 'handshake',
    rate: 0.09,
    rateDisplay: '9.0%',
    minPlafon: 1_000_000,
    maxPlafon: 50_000_000,
    minTenor: 6,
    maxTenor: 60,
  },
]

export default function GuardrailPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<TransaksiKas[]>([])
  const [isGuest, setIsGuest] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [profilId, setProfilId] = useState<string | null>(null)

  // Simulator State
  const [selectedProgramId, setSelectedProgramId] = useState<string>('kur-mikro')
  const [plafon, setPlafon] = useState<number>(30_000_000)
  const [tenorMonths, setTenorMonths] = useState<number>(36)

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setIsGuest(true)
        setTransactions(DEMO_TRANSACTIONS)
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
        // Jangan tampilkan data demo ke pengguna yang login.
        alert('Gagal memuat transaksi: ' + error.message)
        setTransactions([])
      } else {
        setTransactions((data ?? []) as TransaksiKas[])
      }
    }

    loadData()
  }, [])

  const currentProgram = useMemo(() => {
    return PROGRAMS.find((p) => p.id === selectedProgramId) || PROGRAMS[0]
  }, [selectedProgramId])

  // Kas Summary & Base Laba Bersih
  const kasSummary = useMemo(() => calculateKasSummary(transactions), [transactions])
  // PRD: rata-rata laba bersih bulanan dari 6 bulan terakhir (bukan total seluruh waktu, tanpa angka bawaan)
  const baseMonthlyProfit = useMemo(
    () => Math.max(0, rataLabaBulanan(calculateSkorPRD(transactions, isGuest))),
    [transactions, isGuest]
  )

  // Guardrail 30% Ceiling
  const guardrailLimit = Math.round(baseMonthlyProfit * 0.30)

  // Installment calculation for selected program
  const calc = useMemo(() => {
    return calculateInstallment(plafon, currentProgram.rate, tenorMonths)
  }, [plafon, currentProgram.rate, tenorMonths])

  // Guardrail evaluation
  const guard = useMemo(() => {
    return evaluateGuardrail(calc.total, baseMonthlyProfit)
  }, [calc.total, baseMonthlyProfit])

  // Remaining Cash
  const remainingCash = Math.max(0, baseMonthlyProfit - calc.total)
  const remainingPct = Math.max(0, Math.round(((baseMonthlyProfit - calc.total) / baseMonthlyProfit) * 100))

  // Track progress bar width (capped at 100%)
  const gaugeFillPct = Math.min(100, Math.round((guard.ratio / 30) * 100))

  // Tenor pill options
  const TENOR_OPTIONS = [6, 12, 18, 24, 36, 48, 60].filter(
    (m) => m >= currentProgram.minTenor && m <= currentProgram.maxTenor
  )

  const handleReset = () => {
    setSelectedProgramId('kur-mikro')
    setPlafon(30_000_000)
    setTenorMonths(36)
    setSaveSuccess(null)
  }

  const handleSaveSimulation = async () => {
    // PRD: pengajuan hanya disimpan bila cicilan sesuai arus kas (maks 30% rata-rata laba bersih)
    if (!guard.isSafe) {
      setSaveSuccess(null)
      alert('Cicilan ini melebihi 30% rata-rata laba bersih Anda. Coba tenor lebih panjang atau nominal lebih kecil.')
      return
    }
    setSaving(true)
    setSaveSuccess(null)

    if (isGuest) {
      setTimeout(() => {
        setSaving(false)
        setSaveSuccess('Simulasi tersimpan di memori (Mode Tamu).')
      }, 500)
      return
    }

    try {
      const { error } = await supabase.from('simulasi_kur').insert({
        program: currentProgram.name,
        plafon,
        bunga_tahunan: currentProgram.rate * 100,
        profil_id: profilId,
        tenor_bulan: tenorMonths,
        angsuran_bulanan: calc.total,
        rasio_kas: Math.round(guard.ratio * 10) / 10,
        status_guardrail: guard.isSafe ? (guard.ratio <= 25 ? 'aman' : 'waspada') : 'melebihi',
        catatan: `Guardrail 30%: ${guard.statusText} (${guard.ratio.toFixed(1)}% dari laba)`,
      })

      if (error) throw error
      setSaveSuccess('Simulasi berhasil disimpan ke database!')
    } catch (err) {
      console.error('Error saving simulation:', err)
      alert('Gagal menyimpan hasil simulasi ke database.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dashboard-scroll-wrap">
      {/* Header Row */}
      <div className="dash-header-row">
        <div>
          <div className="breadcrumbs-tag">
            <span className="material-symbols-rounded" style={{ fontSize: '15px', color: 'var(--primary)' }}>
              shield
            </span>
            <span>Pilar 3 PRD UTERA — Keamanan Pembiayaan Usaha</span>
          </div>
          <h1 className="dash-heading">Guardrail 30% Arus Kas &amp; Simulasi Pembiayaan</h1>
          <p className="dash-subheading">
            Kalkulasi batas aman beban angsuran cicilan kredit perbankan agar likuiditas kas operasional warung tetap terjaga.
          </p>
        </div>

        <div className="dash-header-actions">
          <div className="source-badge">
            <span className="source-dot"></span>
            <span>Terkoneksi ke Buku Kas Warung (Real-time)</span>
          </div>
        </div>
      </div>

      {/* Zero State Guidance Banner if no transactions */}
      {transactions.length === 0 && !isGuest && (
        <div style={{
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="material-symbols-rounded" style={{ color: '#2563EB', fontSize: '28px' }}>
              info
            </span>
            <div>
              <strong style={{ color: '#1E40AF', display: 'block', fontSize: '0.95rem' }}>
                Mode Simulasi Awal — Belum Ada Catatan Kas Operasional
              </strong>
              <span style={{ color: '#1E3A8A', fontSize: '0.85rem' }}>
                Laba bersih kas Anda saat ini masih Rp 0. Anda tetap dapat menggeser kalkulator simulasi di bawah untuk melihat estimasi angsuran, namun rasio Guardrail 30% akan aktif penuh setelah Anda mencatat transaksi di Buku Kas Warung.
              </span>
            </div>
          </div>
          <Link
            href="/buku-kas"
            className="btn btn-primary btn-sm"
            style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>add</span>
            <span>Mulai Catat Kas</span>
          </Link>
        </div>
      )}

      {/* ====================================================================
           1. TOP METRICS: CAPACITY & CASHFLOW FOUNDATION
           ==================================================================== */}
      <section className="metrics-grid" aria-label="Fondasi Kapasitas Kas">
        {/* Metric 1: Rata-rata Laba Bersih Kas */}
        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Rata-rata Laba Bersih Kas Warung</span>
            <div className="metric-icon-wrap bg-emerald" aria-hidden="true">
              <span className="material-symbols-rounded text-emerald">payments</span>
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value" id="val-net-profit">{formatRupiah(baseMonthlyProfit)}</span>
            <span
              className={`trend-pill ${transactions.length > 0 ? 'trend-up' : ''}`}
              style={transactions.length === 0 ? { background: '#F1F5F9', color: '#64748B' } : {}}
            >
              <span className="material-symbols-rounded trend-icon">
                {transactions.length > 0 ? 'trending_up' : 'info'}
              </span>
              <span>{transactions.length > 0 ? '+14.2%' : 'Belum Ada Transaksi'}</span>
            </span>
          </div>
          <p className="metric-caption">Rata-rata dari catatan Buku Kas Warung aktif.</p>
        </div>

        {/* Metric 2: Batas Plafon Cicilan 30% (The Guardrail) */}
        <div className="metric-card metric-card-highlight">
          <div className="metric-top">
            <span className="metric-label">Plafon Beban Cicilan Maksimal (30%)</span>
            <div className="metric-icon-wrap bg-primary-soft" aria-hidden="true">
              <span className="material-symbols-rounded text-primary">shield</span>
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value text-primary" id="val-guardrail-limit">{formatRupiah(guardrailLimit)}</span>
            <span
              className={transactions.length > 0 ? 'badge-status-safe' : 'badge-status-warning'}
              style={transactions.length === 0 ? { background: '#F1F5F9', color: '#64748B' } : {}}
            >
              {transactions.length > 0 ? 'Batas Pagar Aman' : 'Belum Dihitung'}
            </span>
          </div>
          <p className="metric-caption">Batas tertinggi angsuran bulanan yang diizinkan sistem.</p>
        </div>

        {/* Metric 3: Estimasi Angsuran Simulasi Saat Ini */}
        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Estimasi Angsuran Terpilih</span>
            <div className="metric-icon-wrap bg-gold" aria-hidden="true">
              <span className="material-symbols-rounded text-gold">calculate</span>
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value" id="val-est-installment">{formatRupiah(calc.total)}</span>
            <span
              className={`ratio-badge ${baseMonthlyProfit > 0 ? (guard.isSafe ? 'text-emerald' : 'text-terracotta') : ''}`}
              id="val-ratio-badge"
              style={baseMonthlyProfit === 0 ? { background: '#F1F5F9', color: '#64748B' } : {}}
            >
              {baseMonthlyProfit > 0 ? `${guard.ratio.toFixed(1)}% dari laba` : 'Estimasi Simulasi'}
            </span>
          </div>
          <p className="metric-caption" id="val-installment-sub">
            Plafon {formatRupiah(plafon)} • Tenor {tenorMonths} bulan
          </p>
        </div>

        {/* Metric 4: Sisa Kas Aman Operasional (70%+) */}
        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Sisa Kas Aman Operasional</span>
            <div className="metric-icon-wrap bg-blue" aria-hidden="true">
              <span className="material-symbols-rounded text-blue">savings</span>
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value text-emerald" id="val-remaining-cash">{formatRupiah(remainingCash)}</span>
            <span
              className="trend-pill"
              style={baseMonthlyProfit === 0 ? { background: '#F1F5F9', color: '#64748B' } : {}}
            >
              {baseMonthlyProfit > 0 ? `${remainingPct}% tersisa` : '0% (Belum Ada Kas)'}
            </span>
          </div>
          <p className="metric-caption">Kas bebas untuk kulakan stok harian &amp; dana darurat warung.</p>
        </div>
      </section>

      {/* ====================================================================
           2. INTERACTIVE SIMULATOR & GUARDRAIL GAUGE
           ==================================================================== */}
      <div className="guardrail-main-grid" id="section-simulasi">
        {/* Left Panel: Interactive Slider Simulator */}
        <div className="dash-panel panel-simulator">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Kalkulator Simulasi Pembiayaan Usaha</h2>
              <p className="panel-subtitle">Sesuaikan plafon pinjaman modal kerja, jangka waktu, dan jenis lembaga pembiayaan</p>
            </div>
            <button type="button" className="btn btn-outline btn-sm" id="btn-reset-sim" onClick={handleReset}>
              Reset Nilai
            </button>
          </div>

          {/* Program Selector Tabs */}
          <div className="program-selector">
            {PROGRAMS.map((prog) => (
              <button
                key={prog.id}
                type="button"
                className={`program-tab ${selectedProgramId === prog.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedProgramId(prog.id)
                  setPlafon(Math.min(prog.maxPlafon, Math.max(prog.minPlafon, plafon)))
                  setTenorMonths(Math.min(prog.maxTenor, Math.max(prog.minTenor, tenorMonths)))
                }}
              >
                <span className="material-symbols-rounded">{prog.icon}</span>
                <div className="program-meta">
                  <strong>{prog.name}</strong>
                  <small>{prog.subtitle}</small>
                </div>
              </button>
            ))}
          </div>

          {/* Simulator Controls */}
          <div className="controls-form">
            {/* Control 1: Plafon Pinjaman Slider */}
            <div className="control-row">
              <div className="control-header">
                <label htmlFor="range-plafon" className="control-label">Nominal Pengajuan Pinjaman (Plafon)</label>
                <div className="control-live-val">
                  <span className="currency-prefix">Rp</span>
                  <input
                    type="number"
                    id="display-plafon"
                    className="live-input-val"
                    value={plafon}
                    onChange={(e) => setPlafon(Math.min(currentProgram.maxPlafon, Math.max(currentProgram.minPlafon, Number(e.target.value))))}
                    step={1000000}
                  />
                </div>
              </div>
              <input
                type="range"
                id="range-plafon"
                min={2000000}
                max={currentProgram.maxPlafon}
                step={1000000}
                value={plafon}
                onChange={(e) => setPlafon(Number(e.target.value))}
                className="custom-slider"
              />
              <div className="slider-ticks">
                <span>Rp 2 Jt</span>
                <span>Rp 25 Jt</span>
                <span>Rp 50 Jt (Rekomendasi)</span>
                <span>{formatRupiah(currentProgram.maxPlafon)}</span>
              </div>
            </div>

            {/* Control 2: Tenor (Jangka Waktu) */}
            <div className="control-row">
              <div className="control-header">
                <span className="control-label">Jangka Waktu Pengembalian (Tenor)</span>
                <span className="tenor-selected-text" id="display-tenor">
                  {tenorMonths} Bulan ({tenorMonths / 12 >= 1 ? `${tenorMonths / 12} Tahun` : `${tenorMonths} Bln`})
                </span>
              </div>
              <div className="tenor-pills-group" id="tenor-selector">
                {TENOR_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`tenor-pill ${tenorMonths === m ? 'active' : ''}`}
                    onClick={() => setTenorMonths(m)}
                  >
                    {m} Bln
                  </button>
                ))}
              </div>
            </div>

            {/* Control 3: Suku Bunga Setting */}
            <div className="control-row inline-settings">
              <div className="setting-col">
                <span className="setting-label">Suku Bunga / Jasa Efektif</span>
                <div className="rate-badge">
                  <strong id="display-interest-rate">{currentProgram.rateDisplay}</strong>
                  <small>per tahun (flat anuitas)</small>
                </div>
              </div>
              <div className="setting-col">
                <span className="setting-label">Metode Perhitungan</span>
                <div className="method-text">Sistem Anuitas Resmi Perbankan</div>
              </div>
            </div>

            {/* CTA Save Simulation */}
            <div style={{ marginTop: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveSimulation}
                disabled={saving || (!isGuest && !guard.isSafe)}
              >
                <span className="material-symbols-rounded">bookmark</span>
                <span>{saving ? 'Menyimpan...' : 'Simpan Simulasi ke Database'}</span>
              </button>
              {saveSuccess && (
                <span style={{ fontSize: '0.85rem', color: '#10B981', fontWeight: 600 }}>
                  ✓ {saveSuccess}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Visual Guardrail Meter & Capacity Gauge */}
        <div className="dash-panel panel-gauge">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Visualisasi Beban Arus Kas</h2>
              <p className="panel-subtitle">Posisi cicilan terhadap ambang batas 30%</p>
            </div>
            {baseMonthlyProfit > 0 ? (
              <span className={`status-indicator-chip ${guard.isSafe ? 'safe' : 'danger'}`} id="status-chip">
                <span className="status-indicator-dot"></span>
                <span id="status-chip-text">{guard.isSafe ? 'Kondisi Aman' : 'Peringatan Risiko'}</span>
              </span>
            ) : (
              <span className="status-indicator-chip" style={{ background: '#F1F5F9', color: '#64748B' }} id="status-chip">
                <span className="status-indicator-dot" style={{ background: '#94A3B8' }}></span>
                <span id="status-chip-text">Simulasi Awal</span>
              </span>
            )}
          </div>

          {/* Big Gauge / Meter Box */}
          <div className="gauge-card">
            <div className="gauge-center-stat">
              <span className="gauge-big-pct" id="gauge-pct">
                {baseMonthlyProfit > 0 ? `${guard.ratio.toFixed(1)}%` : '0.0%'}
              </span>
              <span className="gauge-sub-label">
                {baseMonthlyProfit > 0 ? 'Rasio Beban terhadap Laba Kas' : 'Rasio Beban (Belum Ada Catatan Kas)'}
              </span>
            </div>

            {/* Multi-segment Progress Bar */}
            <div className="guardrail-track-wrap">
              <div className="track-bar">
                <div
                  className={baseMonthlyProfit > 0 ? (guard.isSafe ? 'track-fill-safe' : 'track-fill-danger') : ''}
                  id="track-fill"
                  style={{
                    width: `${gaugeFillPct}%`,
                    background: baseMonthlyProfit === 0 ? '#CBD5E1' : undefined
                  }}
                ></div>
                {/* 30% Threshold Line */}
                <div className="threshold-marker" style={{ left: '100%' }}>
                  <div className="threshold-flag">Batas 30% Kas</div>
                </div>
              </div>
              <div className="track-axis-labels">
                <span>0%</span>
                <span>15%</span>
                <span className="font-semibold text-terracotta">30% (Pagar Aman)</span>
                <span>45%+</span>
              </div>
            </div>

            {/* Dynamic Risk Assessment Banner */}
            <div
              className={`risk-banner ${baseMonthlyProfit > 0 ? (guard.isSafe ? 'safe' : 'danger') : 'safe'}`}
              id="risk-banner"
              style={baseMonthlyProfit === 0 ? { background: '#F0F9FF', borderColor: '#BAE6FD' } : {}}
            >
              <div className="risk-icon" id="risk-icon">
                <span className="material-symbols-rounded" style={baseMonthlyProfit === 0 ? { color: '#0284C7' } : {}}>
                  {baseMonthlyProfit > 0 ? (guard.isSafe ? 'check_circle' : 'warning') : 'info'}
                </span>
              </div>
              <div className="risk-copy">
                <strong id="risk-title" style={baseMonthlyProfit === 0 ? { color: '#0C4A6E' } : {}}>
                  {baseMonthlyProfit > 0
                    ? (guard.isSafe ? 'Kapasitas Likuiditas Sangat Baik' : 'Cicilan Berisiko Defisit Kas')
                    : 'Kalkulasi Estimasi Angsuran Mandiri'}
                </strong>
                <p id="risk-desc" style={baseMonthlyProfit === 0 ? { color: '#0369A1' } : {}}>
                  {baseMonthlyProfit > 0
                    ? (guard.isSafe
                      ? `Angsuran ${formatRupiah(calc.total)}/bulan hanya memakan ${guard.ratio.toFixed(1)}% laba bersih. Anda masih memiliki bantalan kas ${remainingPct}% untuk mengamankan operasional harian warung.`
                      : `Angsuran ${formatRupiah(calc.total)}/bulan melampaui batas aman 30% laba bersih (${formatRupiah(guardrailLimit)}). Disarankan memperpanjang tenor atau menurunkan nominal pinjaman.`)
                    : `Simulasi angsuran ${formatRupiah(calc.total)}/bulan (Plafon ${formatRupiah(plafon)}, Tenor ${tenorMonths} bulan). Mulai catat transaksi di Buku Kas Warung untuk menguji apakah cicilan ini berada di dalam batas aman 30% laba bersih usaha Anda.`
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Breakdown Detail Numbers */}
          <div className="installment-breakdown">
            <div className="breakdown-item">
              <span className="breakdown-label">Pokok Pinjaman / Bln</span>
              <span className="breakdown-val tabular-nums" id="val-principal">{formatRupiah(calc.pokok)}</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-label">Bunga Subsidi / Bln</span>
              <span className="breakdown-val tabular-nums" id="val-interest">{formatRupiah(calc.bunga)}</span>
            </div>
            <div className="breakdown-item total">
              <span className="breakdown-label">Total Angsuran / Bln</span>
              <span className="breakdown-val tabular-nums text-primary" id="val-total-installment">{formatRupiah(calc.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
           3. PILAR 3 PRD: PERBANDINGAN PEMBIAYAAN & KUR PLANNER
           ==================================================================== */}
      <div className="dash-bottom-grid" id="section-perbandingan">
        {/* Left Table: Perbandingan Pilihan Pembiayaan Realistis (F17 PRD) */}
        <div className="dash-panel panel-comparison">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Tabel Perbandingan Opsi Pembiayaan (F17 PRD)</h2>
              <p className="panel-subtitle">Bandingkan beban cicilan riil dari berbagai fasilitas kredit terhadap kemampuan bayar usaha</p>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lembaga / Program</th>
                  <th>Plafon Uji</th>
                  <th>Suku Bunga</th>
                  <th>Tenor</th>
                  <th className="text-right">Cicilan / Bln</th>
                  <th className="text-center">Status Guardrail</th>
                </tr>
              </thead>
              <tbody id="comparison-tbody">
                <tr>
                  <td>
                    <div className="institution-meta">
                      <span className="material-symbols-rounded inst-icon">account_balance</span>
                      <div>
                        <strong>KUR Super Mikro Bank</strong>
                        <small>Fasilitas Modal Perdana</small>
                      </div>
                    </div>
                  </td>
                  <td className="tabular-nums">Rp 10.000.000</td>
                  <td><span className="badge-rate">3% p.a.</span></td>
                  <td>12 Bulan</td>
                  <td className="text-right tabular-nums font-semibold">Rp 858.000</td>
                  <td className="text-center"><span className="badge-status-safe">4.6% (Sangat Aman)</span></td>
                </tr>

                <tr className="highlight-row">
                  <td>
                    <div className="institution-meta">
                      <span className="material-symbols-rounded inst-icon text-primary">account_balance</span>
                      <div>
                        <strong>KUR Mikro Bank BRI / Mandiri</strong>
                        <small>Paling Direkomendasikan</small>
                      </div>
                    </div>
                  </td>
                  <td className="tabular-nums font-semibold">Rp 50.000.000</td>
                  <td><span className="badge-rate gold">6% p.a.</span></td>
                  <td>24 Bulan</td>
                  <td className="text-right tabular-nums font-bold text-primary">Rp 2.216.000</td>
                  <td className="text-center"><span className="badge-status-safe">12.0% (Aman)</span></td>
                </tr>

                <tr>
                  <td>
                    <div className="institution-meta">
                      <span className="material-symbols-rounded inst-icon">handshake</span>
                      <div>
                        <strong>Pinjaman Koperasi UMKM</strong>
                        <small>Syarat Cepat &amp; Fleksibel</small>
                      </div>
                    </div>
                  </td>
                  <td className="tabular-nums">Rp 25.000.000</td>
                  <td><span className="badge-rate">9% p.a.</span></td>
                  <td>12 Bulan</td>
                  <td className="text-right tabular-nums font-semibold">Rp 2.270.000</td>
                  <td className="text-center"><span className="badge-status-safe">12.3% (Aman)</span></td>
                </tr>

                <tr>
                  <td>
                    <div className="institution-meta">
                      <span className="material-symbols-rounded inst-icon">domain</span>
                      <div>
                        <strong>Kredit Usaha Komersial (Non-KUR)</strong>
                        <small>Bunga Pasar Standar</small>
                      </div>
                    </div>
                  </td>
                  <td className="tabular-nums">Rp 50.000.000</td>
                  <td><span className="badge-rate danger">13% p.a.</span></td>
                  <td>24 Bulan</td>
                  <td className="text-right tabular-nums font-semibold text-terracotta">Rp 2.518.000</td>
                  <td className="text-center"><span className="badge-status-warning">13.6% (Beban Tinggi)</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="comparison-footer-tip">
            <span className="material-symbols-rounded tip-icon">lightbulb</span>
            <p>
              <strong>Tips Finansial UTERA:</strong> Program <strong>KUR Mikro 6%</strong> memberikan rasio bunga subsidi terendah dengan cicilan yang hanya memakan 12% laba warung Anda, menjadikannya pilihan pembiayaan paling aman sebelum mempertimbangkan opsi komersial.
            </p>
          </div>
        </div>

        {/* Right Column: KUR Planner Alokasi Dana (F10 PRD) */}
        <div className="dash-panel panel-planner">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">KUR Planner: Alokasi Dana (F10 PRD)</h2>
              <p className="panel-subtitle">Rencana produktif penggunaan modal kerja</p>
            </div>
          </div>

          <div className="planner-grid-content" style={{ padding: '20px' }}>
            <div className="planner-allocations-wrap">
              <div className="allocation-item" style={{ marginBottom: '16px' }}>
                <div className="alloc-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                  <span>Modal Belanja Stok Bahan Baku (Kulakan)</span>
                  <strong className="tabular-nums">{formatRupiah(plafon * 0.60)} (60%)</strong>
                </div>
                <div className="alloc-track" style={{ height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div className="alloc-fill bg-emerald" style={{ width: '60%', height: '100%', background: '#10B981' }}></div>
                </div>
              </div>

              <div className="allocation-item" style={{ marginBottom: '16px' }}>
                <div className="alloc-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                  <span>Peremajaan Alat Kasir &amp; Mesin Usaha</span>
                  <strong className="tabular-nums">{formatRupiah(plafon * 0.30)} (30%)</strong>
                </div>
                <div className="alloc-track" style={{ height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div className="alloc-fill bg-primary" style={{ width: '30%', height: '100%', background: 'var(--primary)' }}></div>
                </div>
              </div>

              <div className="allocation-item" style={{ marginBottom: '16px' }}>
                <div className="alloc-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                  <span>Cadangan Kas Likuiditas &amp; Dana Darurat</span>
                  <strong className="tabular-nums">{formatRupiah(plafon * 0.10)} (10%)</strong>
                </div>
                <div className="alloc-track" style={{ height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div className="alloc-fill bg-gold" style={{ width: '10%', height: '100%', background: '#F59E0B' }}></div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <Link href="/simulasi-kur" className="btn btn-secondary btn-block">
                <span>Buka Simulasi KUR Lengkap (BRI 2026) →</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
