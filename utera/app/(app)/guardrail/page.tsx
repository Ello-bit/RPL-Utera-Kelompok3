'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DEMO_TRANSACTIONS } from '@/lib/demo-seed'
import { Tables } from '@/lib/database.types'
import { calculateKasSummary, formatRupiah } from '@/lib/kas'
import { calculateInstallment, evaluateGuardrail } from '@/lib/kur'

type TransaksiKas = Tables<'transaksi_kas'>

export default function GuardrailPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<TransaksiKas[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isGuest, setIsGuest] = useState(false)

  // Simulation State
  const [plafon, setPlafon] = useState<number>(50_000_000)
  const [tenorMonths, setTenorMonths] = useState<number>(24)
  const [annualRate, setAnnualRate] = useState<number>(0.06) // 6% p.a.
  const [programName, setProgramName] = useState<string>('KUR Mikro BRI (6% p.a.)')

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
  // Effective profit used for guardrail calculation
  const effectiveProfit = Math.max(0, kasSummary.netProfit)
  const calc = calculateInstallment(plafon, annualRate, tenorMonths)
  const guard = evaluateGuardrail(calc.total, effectiveProfit)

  const handleSaveSimulation = async () => {
    if (isGuest) {
      setMessage({ type: 'success', text: 'Mode Demo: Simulasi tersimpan di memori.' })
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('simulasi_kur').insert({
        program: programName,
        plafon,
        bunga_tahunan: annualRate,
        tenor_bulan: tenorMonths,
        angsuran_bulanan: calc.total,
        rasio_kas: Math.round(guard.ratio),
        status_guardrail: guard.statusText,
        catatan: `Simulasi Guardrail: ${guard.statusText} (${guard.ratio.toFixed(1)}% dari laba)`,
      })

      if (error) throw error
      setMessage({ type: 'success', text: 'Simulasi guardrail berhasil disimpan ke database!' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan simulasi.'
      setMessage({ type: 'error', text: msg })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
            Guardrail 30% Arus Kas
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Prinsip keamanan finansial: batas beban angsuran kredit UMKM maksimal 30% dari laba bersih bulanan.
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
          <span>{saving ? 'Menyimpan...' : 'Simpan Simulasi'}</span>
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

      {/* 3 Top KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Laba Bersih Bulanan
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: '8px 0 4px' }}>
            {formatRupiah(effectiveProfit)}
          </div>
          <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Dasar perhitungan batas cicilan kas
          </small>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Batas Maksimal Angsuran (30%)
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', margin: '8px 0 4px' }}>
            {formatRupiah(guard.guardrailLimit)}
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)' }}> / bln</span>
          </div>
          <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Plafon angsuran aman agar warung tidak defisit
          </small>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Estimasi Cicilan Terpilih
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: guard.color, margin: '8px 0 4px' }}>
            {formatRupiah(calc.total)}
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)' }}> / bln</span>
          </div>
          <small style={{ color: guard.color, fontSize: '0.75rem', fontWeight: 700 }}>
            {guard.ratio.toFixed(1)}% dari Laba ({guard.statusText})
          </small>
        </div>
      </div>

      {/* Simulator Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
        {/* Left: Controls */}
        <div style={{ background: '#fff', padding: '28px', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '20px' }}>
            Parameter Simulasi Pembiayaan
          </h3>

          {/* Program Selector */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '6px' }}>
              Program Pinjaman / Kredit
            </label>
            <select
              value={annualRate}
              onChange={(e) => {
                const rate = parseFloat(e.target.value)
                setAnnualRate(rate)
                if (rate === 0.03) setProgramName('KUR Super Mikro (3.0% p.a.)')
                else if (rate === 0.06) setProgramName('KUR Mikro BRI / Mandiri (6.0% p.a.)')
                else setProgramName('Koperasi Usaha (9.0% p.a.)')
              }}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem', outline: 'none', background: '#fff' }}
            >
              <option value={0.03}>KUR Super Mikro — 3.0% per tahun</option>
              <option value={0.06}>KUR Mikro Bank — 6.0% per tahun</option>
              <option value={0.09}>Pinjaman Koperasi Usaha — 9.0% per tahun</option>
            </select>
          </div>

          {/* Plafon Slider */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-body)' }}>
                Plafon Pinjaman:
              </label>
              <strong style={{ fontSize: '1rem', color: 'var(--primary)' }}>
                {formatRupiah(plafon)}
              </strong>
            </div>
            <input
              type="range"
              min={5_000_000}
              max={100_000_000}
              step={5_000_000}
              value={plafon}
              onChange={(e) => setPlafon(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              <span>Rp 5 Jt</span>
              <span>Rp 50 Jt</span>
              <span>Rp 100 Jt</span>
            </div>
          </div>

          {/* Tenor Buttons */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '8px' }}>
              Jangka Waktu (Tenor):
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {[12, 18, 24, 36].map((months) => (
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
        </div>

        {/* Right: Guardrail Evaluation Card */}
        <div style={{ background: '#fff', padding: '28px', borderRadius: '16px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Hasil Evaluasi Arus Kas
              </h3>
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: guard.isSafe ? '#ECFDF5' : '#FEF2F2',
                  color: guard.color,
                }}
              >
                {guard.statusText}
              </span>
            </div>

            <div style={{ padding: '16px', borderRadius: '12px', background: guard.isSafe ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${guard.color}40`, marginBottom: '20px' }}>
              <strong style={{ display: 'block', color: guard.color, fontSize: '0.9rem', marginBottom: '4px' }}>
                {guard.isSafe
                  ? 'Kapasitas Kas Memadai'
                  : 'Peringatan: Angsuran Melebihi Batas Kas'}
              </strong>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-body)', lineHeight: 1.4 }}>
                {guard.isSafe
                  ? `Angsuran Rp ${calc.total.toLocaleString('id-ID')} hanya menyerap ${guard.ratio.toFixed(1)}% dari laba bersih. Anda masih memiliki sisa arus kas bebas ${formatRupiah(guard.remainingCash)} per bulan.`
                  : `Angsuran menyerap ${guard.ratio.toFixed(1)}% dari laba bersih bulanan, berisiko mengganggu operasional kulakan warung. Disarankan memperpanjang tenor atau mengurangi plafon pinjaman.`}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Pokok Angsuran / Bln:</span>
                <strong>{formatRupiah(calc.pokok)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Bunga / Bln:</span>
                <strong>{formatRupiah(calc.bunga)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Pembayaran ({tenorMonths} Bln):</span>
                <strong style={{ color: 'var(--primary)' }}>{formatRupiah(calc.totalKumulatif)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

