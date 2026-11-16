'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import PlafonInput from '../plafon-input'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/database.types'
import { formatRupiah } from '@/lib/kas'
import { calculateInstallment, evaluateGuardrail, evaluateKelayakanKur, KUR_TIERS, type KurTier } from '@/lib/kur'
import { calculateSkorPRD, rataLabaBulanan } from '@/lib/skor'
import { getActiveProfilId, pickActiveProfile } from '@/lib/profil-aktif'
import './simulasi-kur.css'

type TransaksiKas = Tables<'transaksi_kas'>

type TierConfig = KurTier & { desc: string }

const TIER_DESC: Record<string, string> = {
  'kur-mikro': 'Skema paling populer bagi warung dan bengkel mandiri.',
  'kur-super': 'Untuk usaha rintisan tanpa agunan fisik tambahan.',
  'kur-kecil': 'Untuk skala ekspansi cabang baru & pengadaan aset produksi.',
}

// Jenis KUR diambil dari lib/kur.ts (satu sumber sesuai PRD: bunga 6%, plafon dan tenor per jenis).
const KUR_TIERS_CONFIG: Record<string, TierConfig> = Object.fromEntries(
  Object.values(KUR_TIERS).map((t) => [
    t.id,
    { ...t, rateDisplay: `${t.rateDisplay} p.a.`, desc: TIER_DESC[t.id] ?? '' },
  ])
)

export default function SimulasiKurPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<TransaksiKas[]>([])
  // Selama data belum selesai dimuat, daftar transaksi memang masih kosong.
  // Tanpa penanda ini, pesan "Belum Ada Catatan Kas" sempat muncul lalu hilang.
  const [dataSiap, setDataSiap] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [profilId, setProfilId] = useState<string | null>(null)
  const [punyaNibAtauSku, setPunyaNibAtauSku] = useState(false)

  // Simulation Controls
  // Tombol "Uji Syarat ..." di landing membuka halaman ini dengan ?jenis=kur-super|kur-mikro|kur-kecil
  const jenisAwal = useSearchParams().get('jenis')
  const tierAwal = (jenisAwal && KUR_TIERS_CONFIG[jenisAwal]) || KUR_TIERS_CONFIG['kur-mikro']
  const [selectedTierId, setSelectedTierId] = useState<string>(tierAwal.id)
  const [selectedBank, setSelectedBank] = useState<string>('bri')
  const [plafon, setPlafon] = useState<number>(() =>
    30_000_000 > tierAwal.maxPlafon ? tierAwal.defaultPlafon : Math.max(tierAwal.minPlafon, 30_000_000)
  )
  const [tenorMonths, setTenorMonths] = useState<number>(() =>
    Math.min(tierAwal.maxTenor, Math.max(tierAwal.minTenor, 36))
  )

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // Halaman ini hanya untuk pengguna login (dijaga middleware)
      if (!user) {
        return
      }

      const { data: profs } = await supabase
        .from('profil_usaha')
        .select('id')
        .order('created_at', { ascending: false })
      const active = pickActiveProfile(profs ?? [], getActiveProfilId())
      setProfilId(active?.id ?? null)

      // Syarat administratif KUR: NIB atau SKU yang sudah terisi di Legalitas
      if (active) {
        const { data: docs } = await supabase
          .from('legalitas_dokumen')
          .select('kategori, nomor_dokumen, file_url')
          .eq('profil_id', active.id)
        setPunyaNibAtauSku(
          (docs ?? []).some(
            (d) => ['NIB', 'SKU'].includes((d.kategori || '').toUpperCase()) && (d.nomor_dokumen || d.file_url)
          )
        )
      }

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

    loadData().finally(() => setDataSiap(true))
  }, [])

  const currentTier = KUR_TIERS_CONFIG[selectedTierId] || KUR_TIERS_CONFIG['kur-mikro']

  // PRD: rata-rata laba bersih bulanan 6 bulan terakhir; tanpa angka bawaan
  const baseMonthlyProfit = useMemo(
    () => Math.max(0, rataLabaBulanan(calculateSkorPRD(transactions))),
    [transactions]
  )

  // Guardrail 30% limit
  const guardrailLimit = Math.round(baseMonthlyProfit * 0.30)

  // Installment KUR calculation
  const calcKur = useMemo(() => {
    return calculateInstallment(plafon, currentTier.rate, tenorMonths)
  }, [plafon, currentTier.rate, tenorMonths])

  // Commercial loan comparison (13% p.a.)
  const calcComm = useMemo(() => {
    return calculateInstallment(plafon, 0.13, tenorMonths)
  }, [plafon, tenorMonths])

  // Guardrail evaluation
  const guard = useMemo(() => {
    return evaluateGuardrail(calcKur.total, baseMonthlyProfit)
  }, [calcKur.total, baseMonthlyProfit])

  // Monthly savings compared to commercial loan
  const monthlySavings = Math.max(0, calcComm.total - calcKur.total)
  const totalSavings = monthlySavings * tenorMonths

  // Score estimate
  const skorDetail = calculateSkorPRD(transactions)
  const estimatedScore = skorDetail.total
  const kelayakan = evaluateKelayakanKur({
    skor: estimatedScore,
    bulanTercatat: skorDetail.monthlyData.filter((m) => m.tercatat).length,
    punyaNibAtauSku,
  })

  const handleTierChange = (tierId: string) => {
    setSelectedTierId(tierId)
    const tier = KUR_TIERS_CONFIG[tierId]
    if (plafon > tier.maxPlafon) setPlafon(tier.defaultPlafon)
    else if (plafon < tier.minPlafon) setPlafon(tier.minPlafon)
    setTenorMonths(Math.min(tier.maxTenor, Math.max(tier.minTenor, tenorMonths)))
    setSaveSuccess(null)
  }

  const handleReset = () => {
    setSelectedTierId('kur-mikro')
    setSelectedBank('bri')
    setPlafon(30_000_000)
    setTenorMonths(36)
    setSaveSuccess(null)
  }

  const handleSaveSimulation = async () => {
    // PRD: pengajuan hanya disimpan bila cicilan sesuai arus kas (maks 30% rata-rata laba bersih)
    if (!guard.isSafe) {
      alert('Cicilan ini melebihi 30% rata-rata laba bersih Anda. Coba tenor lebih panjang atau nominal lebih kecil.')
      return
    }
    setSaving(true)
    setSaveSuccess(null)

    try {
      const bankNames: Record<string, string> = {
        bri: 'Bank BRI (KUR 2026)',
        mandiri: 'Bank Mandiri (KUR 2026)',
        bni: 'Bank BNI (KUR 2026)',
      }

      const { error } = await supabase.from('simulasi_kur').insert({
        program: `${currentTier.name} via ${bankNames[selectedBank] || 'Bank BRI'}`,
        plafon,
        bunga_tahunan: currentTier.rate * 100,
        profil_id: profilId,
        tenor_bulan: tenorMonths,
        angsuran_bulanan: calcKur.total,
        rasio_kas: Math.round(guard.ratio * 10) / 10,
        status_guardrail: guard.isSafe ? (guard.ratio <= 25 ? 'aman' : 'waspada') : 'melebihi',
        catatan: `Simulasi KUR: ${guard.statusText} (${guard.ratio.toFixed(1)}% beban kas). Hemat ${formatRupiah(totalSavings)} vs pinjaman komersial.`,
      })

      if (error) throw error
      setSaveSuccess('Simulasi KUR berhasil disimpan ke database!')
    } catch (err) {
      console.error('Error saving KUR simulation:', err)
      alert('Gagal menyimpan hasil simulasi KUR ke database.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dashboard-scroll-wrap" aria-busy={!dataSiap}>
      {/* Header Row */}
      <div className="dash-header-row">
        <div>
          <h1 className="dash-heading">Simulasi KUR 2026 &amp; Rencana Pembiayaan Usaha</h1>
          <p className="dash-subheading">
            Kalkulasi simulasi Kredit Usaha Rakyat bersubsidi pemerintah (BRI, Mandiri, BNI), perencanaan alokasi dana produktif (KUR Planner), dan checklist kelayakan administratif.
          </p>
        </div>

        <div className="dash-header-actions">
          <div className="source-badge">
            <span className="source-dot"></span>
            <span>Kriteria KUR BRI 2026 • Bunga 6% per tahun</span>
          </div>
        </div>
      </div>

      {/* Zero State Guidance Banner if no transactions */}
      {dataSiap && transactions.length === 0 && (
        <div style={{
          background: 'var(--primary-soft)',
          border: '1px solid var(--primary-border)',
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
            <span className="material-symbols-rounded" style={{ color: 'var(--primary)', fontSize: '28px' }}>
              info
            </span>
            <div>
              <strong style={{ color: 'var(--primary-dark)', display: 'block', fontSize: '0.95rem' }}>
                Belum ada catatan kas
              </strong>
              <span style={{ color: 'var(--text-body)', fontSize: '0.85rem' }}>
                Anda tetap bisa mencoba menghitung cicilan KUR di bawah. Agar kelayakan KUR usaha Anda bisa dinilai, catat dulu uang masuk dan uang keluar di Buku Kas.
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
           1. TOP METRICS: ELIGIBILITY & READINESS FOUNDATION
           ==================================================================== */}
      <section className="metrics-grid" aria-label="Status Kesiapan KUR">
        {/* Metric 1: Skor Kelayakan UTERA */}
        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Skor Kelayakan Finansial</span>
            <div className="metric-icon-wrap bg-emerald" aria-hidden="true">
              <span className="material-symbols-rounded text-emerald">verified</span>
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value text-emerald" id="val-skor-kur">
              {estimatedScore}<small className="score-denom">/100</small>
            </span>
            <span
              className={estimatedScore >= 70 ? 'badge-status-safe' : 'badge-status-warning'}
              style={estimatedScore === 0 ? { background: '#F1F5F9', color: '#64748B' } : {}}
            >
              {estimatedScore >= 70 ? 'Kategori Baik' : estimatedScore > 0 ? 'Kategori Cukup' : 'Belum Ada Data'}
            </span>
          </div>
          <p className="metric-caption">
            {estimatedScore === 0
              ? 'Mulai catat transaksi di Buku Kas untuk mengaktifkan skor.'
              : 'Melampaui batas minimum syarat bank (min. 70 poin).'}
          </p>
        </div>

        {/* Metric 2: Batas Beban Kas 30% */}
        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Batas Pagar Aman Cicilan (30% Kas)</span>
            <div className="metric-icon-wrap bg-primary-soft" aria-hidden="true">
              <span className="material-symbols-rounded text-primary">shield</span>
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value text-primary" id="val-guardrail-kur">{formatRupiah(guardrailLimit)}</span>
            <span
              className="ratio-badge"
              style={baseMonthlyProfit === 0 ? { background: '#F1F5F9', color: '#64748B' } : {}}
            >
              {baseMonthlyProfit > 0 ? `Dari Laba ${formatRupiah(baseMonthlyProfit)}` : 'Laba Belum Ada'}
            </span>
          </div>
          <p className="metric-caption">
            {baseMonthlyProfit === 0
              ? 'Batas 30% akan dihitung otomatis saat kas tercatat.'
              : 'Maksimal beban angsuran bulanan yang aman bagi operasional.'}
          </p>
        </div>

        {/* Metric 3: Estimasi Angsuran KUR Terpilih */}
        <div className="metric-card metric-card-highlight">
          <div className="metric-top">
            <span className="metric-label">Estimasi Angsuran KUR / Bln</span>
            <div className="metric-icon-wrap bg-gold" aria-hidden="true">
              <span className="material-symbols-rounded text-gold">calculate</span>
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value text-gold" id="val-cicilan-kur">{formatRupiah(calcKur.total)}</span>
            <span
              className={`trend-pill ${baseMonthlyProfit > 0 ? 'trend-up' : ''}`}
              style={baseMonthlyProfit === 0 ? { background: '#F1F5F9', color: '#64748B' } : {}}
            >
              <span className="material-symbols-rounded trend-icon">
                {baseMonthlyProfit > 0 ? 'check_circle' : 'calculate'}
              </span>
              <span id="val-ratio-kur">
                {baseMonthlyProfit > 0 ? `${guard.ratio.toFixed(1)}% Laba` : 'Simulasi Bebas'}
              </span>
            </span>
          </div>
          <p className="metric-caption" id="val-sub-kur">
            Plafon {formatRupiah(plafon)} • Tenor {tenorMonths} Bulan ({currentTier.rateDisplay})
          </p>
        </div>

        {/* Metric 4: Status Kelayakan Administrasi */}
        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Status Kelayakan Pengajuan</span>
            <div className="metric-icon-wrap bg-blue" aria-hidden="true">
              <span className="material-symbols-rounded text-blue">fact_check</span>
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value text-main" id="val-status-pengajuan">{kelayakan.status}</span>
            <span
              className="badge-status-safe"
              id="badge-status-pengajuan"
              style={kelayakan.siap ? undefined : { background: '#FEF3C7', color: '#92400E' }}
            >
              {kelayakan.siap ? 'Siap Diajukan' : 'Perlu Dilengkapi'}
            </span>
          </div>
          <p className="metric-caption" id="val-desc-pengajuan">
            {kelayakan.siap
              ? 'Riwayat kas 6 bulan dan NIB/SKU terpenuhi. Pastikan juga syarat usia dan SLIK OJK.'
              : kelayakan.kekurangan.join(' • ')}
          </p>
        </div>
      </section>

      {/* ====================================================================
           2. INTERACTIVE KUR SIMULATOR & CAPACITY INDICATOR
           ==================================================================== */}
      <div className="guardrail-main-grid" id="section-simulasi">
        {/* Left Panel: Interactive KUR Calculator */}
        <div className="dash-panel panel-simulator">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Kalkulator Simulasi Angsuran KUR 2026</h2>
              <p className="panel-subtitle">Pilih jenis fasilitas KUR subsidi, nominal pengajuan modal kerja, dan jangka waktu</p>
            </div>
            <button type="button" className="btn btn-outline btn-sm" id="btn-reset-kur" onClick={handleReset}>
              Reset Nilai
            </button>
          </div>

          {/* Program Selector Tabs */}
          <div className="kur-program-selector">
            {Object.values(KUR_TIERS_CONFIG).map((tier) => (
              <button
                key={tier.id}
                type="button"
                className={`kur-program-card ${selectedTierId === tier.id ? 'active' : ''}`}
                onClick={() => handleTierChange(tier.id)}
              >
                <div className="kur-tier-header">
                  <span className="material-symbols-rounded text-primary">account_balance</span>
                  <strong>{tier.name}</strong>
                  <span className="badge-rate">{tier.rateDisplay}</span>
                </div>
                <small>{tier.desc} (Plafon s.d {formatRupiah(tier.maxPlafon)})</small>
              </button>
            ))}
          </div>

          {/* Bank Partner Selector */}
          <div style={{ marginTop: '16px', marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
              Pilih Bank Penyalur KUR
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { id: 'bri', name: 'Bank BRI' },
                { id: 'mandiri', name: 'Bank Mandiri' },
                { id: 'bni', name: 'Bank BNI' },
              ].map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBank(b.id)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: `1.5px solid ${selectedBank === b.id ? 'var(--primary)' : '#CBD5E1'}`,
                    background: selectedBank === b.id ? 'var(--primary-soft)' : '#fff',
                    color: selectedBank === b.id ? 'var(--primary-dark)' : 'var(--text-body)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>

          {/* Controls Form */}
          <div className="controls-form">
            {/* Control 1: Plafon Pinjaman */}
            <div className="control-row">
              <div className="control-header">
                <label htmlFor="range-plafon-kur" className="control-label">Nominal Pengajuan Modal Kerja (Plafon)</label>
                <div className="control-live-val">
                  <span className="currency-prefix">Rp</span>
                  <PlafonInput
                    id="display-plafon-kur"
                    value={plafon}
                    min={currentTier.minPlafon}
                    max={currentTier.maxPlafon}
                    onChange={setPlafon}
                  />
                </div>
              </div>
              <input
                type="range"
                id="range-plafon-kur"
                min={currentTier.minPlafon}
                max={currentTier.maxPlafon}
                step={1000000}
                value={plafon}
                onChange={(e) => setPlafon(Number(e.target.value))}
                className="custom-slider"
              />
              <div className="slider-ticks">
                <span>{formatRupiah(currentTier.minPlafon)}</span>
                <span>{formatRupiah(currentTier.defaultPlafon)}</span>
                <span>{formatRupiah(currentTier.maxPlafon)}</span>
              </div>
            </div>

            {/* Control 2: Tenor (Jangka Waktu) */}
            <div className="control-row">
              <div className="control-header">
                <span className="control-label">Jangka Waktu Pengembalian (Tenor)</span>
                <span className="tenor-selected-text" id="display-tenor-kur">
                  {tenorMonths} Bulan ({tenorMonths / 12 >= 1 ? `${tenorMonths / 12} Tahun` : `${tenorMonths} Bln`})
                </span>
              </div>
              <div className="tenor-pills-group">
                {[6, 12, 18, 24, 36, 48, 60].filter((m) => m >= currentTier.minTenor && m <= currentTier.maxTenor).map((m) => (
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

            {/* CTA Buttons */}
            <div style={{ marginTop: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveSimulation}
                disabled={saving || !guard.isSafe}
              >
                <span className="material-symbols-rounded">bookmark</span>
                <span>{saving ? 'Menyimpan...' : 'Simpan Simulasi KUR ke Database'}</span>
              </button>
              {saveSuccess && (
                <span style={{ fontSize: '0.85rem', color: '#2A8865', fontWeight: 600 }}>
                  ✓ {saveSuccess}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: KUR Savings & Installment Breakdown */}
        <div className="dash-panel panel-gauge">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Manfaat Subsidi Bunga Pemerintah</h2>
              <p className="panel-subtitle">Penghematan biaya bunga KUR vs pinjaman komersial biasa</p>
            </div>
            <span className="badge-status-safe">Hemat Bunga</span>
          </div>

          <div style={{ padding: '20px', background: '#EEF7F2', borderRadius: '12px', border: '1px solid #D1E7DC', marginBottom: '20px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--primary-dark)', fontWeight: 700, textTransform: 'uppercase' }}>
              TOTAL PENGHEMATAN BUNGA BERSUBSIDI
            </span>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1.2, margin: '6px 0' }}>
              {formatRupiah(totalSavings)}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-body)', margin: 0 }}>
              Dengan subsidi bunga {currentTier.rateDisplay}, cicilan Anda lebih hemat <strong>{formatRupiah(monthlySavings)}/bln</strong> dibanding kredit komersial bunga 13%.
            </p>
          </div>

          {/* Breakdown Items */}
          <div className="installment-breakdown">
            <div className="breakdown-item">
              <span className="breakdown-label">Pokok Pinjaman / Bln</span>
              <span className="breakdown-val tabular-nums">{formatRupiah(calcKur.pokok)}</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-label">Bunga Subsidi Pemerintah / Bln</span>
              <span className="breakdown-val tabular-nums text-emerald">{formatRupiah(calcKur.bunga)}</span>
            </div>
            <div className="breakdown-item total">
              <span className="breakdown-label">Total Angsuran KUR / Bln</span>
              <span className="breakdown-val tabular-nums text-primary">{formatRupiah(calcKur.total)}</span>
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <Link href="/laporan-siap-bank" className="btn btn-secondary btn-block">
              <span>Buat Laporan Siap Bank (Cetak A4) →</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
