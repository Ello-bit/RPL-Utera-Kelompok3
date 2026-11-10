'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DEMO_TRANSACTIONS } from '@/lib/demo-seed'
import { Tables } from '@/lib/database.types'
import { calculateKasSummary, formatRupiah } from '@/lib/kas'
import { KUR_TIERS, BANKS, calculateInstallment, evaluateGuardrail } from '@/lib/kur'

type TransaksiKas = Tables<'transaksi_kas'>

export default function SimulasiKurPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<TransaksiKas[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isGuest, setIsGuest] = useState(false)

  // Simulation Controls
  const [selectedTier, setSelectedTier] = useState<string>('kur-mikro')
  const [selectedBank, setSelectedBank] = useState<string>('bri')
  const [plafon, setPlafon] = useState<number>(50_000_000)
  const [tenorMonths, setTenorMonths] = useState<number>(24)

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

  const kasSummary = calculateKasSummary(transactions)
  const currentTier = KUR_TIERS[selectedTier] || KUR_TIERS['kur-mikro']
  const calc = calculateInstallment(plafon, currentTier.rate, tenorMonths)
  // Commercial loan comparison (13% p.a.)
  const calcCommercial = calculateInstallment(plafon, 0.13, tenorMonths)
  const subsidySavings = Math.max(0, calcCommercial.totalKumulatif - calc.totalKumulatif)
  const guard = evaluateGuardrail(calc.total, kasSummary.netProfit)

  const handleTierChange = (tierId: string) => {
    setSelectedTier(tierId)
    const tier = KUR_TIERS[tierId]
    setPlafon(tier.defaultPlafon)
    setTenorMonths(tier.defaultTenor)
  }

  const handleSaveSimulation = async () => {
    if (isGuest) {
      setMessage({ type: 'success', text: 'Mode Demo: Simulasi tersimpan di memori.' })
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('simulasi_kur').insert({
        program: `${currentTier.name} (${BANKS[selectedBank]})`,
        plafon,
        bunga_tahunan: currentTier.rate,
        tenor_bulan: tenorMonths,
        angsuran_bulanan: calc.total,
        rasio_kas: Math.round(guard.ratio),
        status_guardrail: guard.statusText,
        catatan: `Hemat bunga KUR Rp ${subsidySavings.toLocaleString('id-ID')} vs komersial 13%`,
      })

      if (error) throw error
      setMessage({ type: 'success', text: 'Hasil simulasi KUR berhasil disimpan ke database!' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan simulasi.'
      setMessage({ type: 'error', text: msg })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '28px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
            Simulasi KUR 2026 & Pembiayaan
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Simulasikan plafon Kredit Usaha Rakyat bersubsidi pemerintah dengan suku bunga rendah 3%–6% per tahun.
          </p>
        </div>
        <button
          onClick={handleSaveSimulation}
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
            {saving ? 'hourglass_top' : 'save'}
          </span>
          <span>{saving ? 'Menyimpan...' : 'Simpan Simulasi KUR'}</span>
        </button>
      </div>

      {/* Message Feedback */}
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

      {/* Tier Selector Pills */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        {Object.values(KUR_TIERS).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => handleTierChange(t.id)}
            style={{
              flex: 1,
              padding: '16px',
              borderRadius: '12px',
              border: selectedTier === t.id ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
              background: selectedTier === t.id ? 'var(--primary-soft)' : '#fff',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{t.name}</strong>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', background: '#fff', padding: '2px 8px', borderRadius: '8px' }}>
                {t.rateDisplay} p.a.
              </span>
            </div>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Plafon {formatRupiah(t.minPlafon)} s/d {formatRupiah(t.maxPlafon)}
            </small>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
        {/* Left: Input Simulator */}
        <div style={{ background: '#fff', padding: '28px', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '20px' }}>
            Kalkulator Angsuran
          </h3>

          {/* Bank Selector */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '6px' }}>
              Bank Penyalur KUR
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {Object.entries(BANKS).map(([k, name]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelectedBank(k)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: selectedBank === k ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                    background: selectedBank === k ? 'var(--primary-soft)' : '#fff',
                    color: selectedBank === k ? 'var(--primary)' : 'var(--text-body)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Plafon Slider */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-body)' }}>
                Plafon Pinjaman:
              </label>
              <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>
                {formatRupiah(plafon)}
              </strong>
            </div>
            <input
              type="range"
              min={currentTier.minPlafon}
              max={currentTier.maxPlafon}
              step={currentTier.minPlafon}
              value={plafon}
              onChange={(e) => setPlafon(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              <span>{formatRupiah(currentTier.minPlafon)}</span>
              <span>{formatRupiah(currentTier.maxPlafon)}</span>
            </div>
          </div>

          {/* Tenor Options */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '8px' }}>
              Jangka Waktu (Tenor):
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {[12, 24, 36, 48].map((months) => (
                <button
                  key={months}
                  type="button"
                  onClick={() => setTenorMonths(months)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: tenorMonths === months ? 'var(--primary)' : '#fff',
                    color: tenorMonths === months ? '#fff' : 'var(--text-body)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  {months} Bulan
                </button>
              ))}
            </div>
          </div>

          {/* Subsidy Benefit Callout */}
          <div style={{ padding: '16px', borderRadius: '12px', background: '#ECFDF5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="material-symbols-rounded" style={{ color: '#059669', fontSize: '24px' }}>savings</span>
            <div>
              <strong style={{ display: 'block', color: '#065F46', fontSize: '0.875rem' }}>
                Penghematan Subsidi Pemerintah: {formatRupiah(subsidySavings)}
              </strong>
              <small style={{ color: '#047857', fontSize: '0.75rem' }}>
                Dibandingkan pinjaman komersial non-KUR dengan suku bunga pasar ~13% p.a.
              </small>
            </div>
          </div>
        </div>

        {/* Right: Breakdown & Guardrail */}
        <div style={{ background: '#fff', padding: '28px', borderRadius: '16px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Estimasi Angsuran Bulanan
            </span>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--primary)', margin: '8px 0 16px' }}>
              {formatRupiah(calc.total)}
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)' }}> / bulan</span>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: '10px', background: guard.isSafe ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${guard.color}40`, marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <strong style={{ fontSize: '0.85rem', color: guard.color }}>
                  Guardrail 30%: {guard.statusText}
                </strong>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: guard.color }}>
                  {guard.ratio.toFixed(1)}% Laba
                </span>
              </div>
              <small style={{ color: 'var(--text-body)', fontSize: '0.75rem' }}>
                {guard.isSafe
                  ? 'Beban angsuran berada dalam zona aman arus kas operasional warung.'
                  : 'Angsuran berisiko menekan laba bersih warung. Pertimbangkan tenor lebih panjang.'}
              </small>
            </div>

            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px' }}>
              Rincian Amortisasi Pinjaman
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Pokok Per Bulan:</span>
                <strong>{formatRupiah(calc.pokok)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Bunga Subsidi / Bln:</span>
                <strong>{formatRupiah(calc.bunga)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Suku Bunga Efektif:</span>
                <strong style={{ color: 'var(--primary)' }}>{currentTier.rateDisplay} p.a.</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Bunga ({tenorMonths} Bln):</span>
                <strong>{formatRupiah(calc.bunga * tenorMonths)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Total Akumulasi:</span>
                <strong style={{ fontWeight: 800, color: 'var(--text-main)' }}>{formatRupiah(calc.totalKumulatif)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
