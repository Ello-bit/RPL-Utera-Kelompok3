import { describe, it, expect } from 'vitest'
import { calculateKasSummary, getMonthlyBreakdown, getCategoryDistribution, formatRupiah } from '../lib/kas'
import { tx } from './helpers'

describe('F5 dashboard: pemasukan, pengeluaran, laba bersih', () => {
  const data = [
    tx('pemasukan', 10_000_000, '2026-09-01'),
    tx('pemasukan', 5_000_000, '2026-10-01', 'Pendapatan lain'),
    tx('pengeluaran', 4_000_000, '2026-10-02', 'Operasional'),
  ]
  it('KAS-01 ringkasan', () => {
    const s = calculateKasSummary(data)
    expect(s.totalIncome).toBe(15_000_000)
    expect(s.totalExpense).toBe(4_000_000)
    expect(s.netProfit).toBe(11_000_000)
    expect(s.marginPct).toBe(73)
    expect(s.count).toBe(3)
  })
  it('KAS-02 kosong = 0 tanpa NaN', () => {
    expect(calculateKasSummary([])).toMatchObject({ totalIncome: 0, totalExpense: 0, netProfit: 0, marginPct: 0 })
  })
  it('KAS-03 breakdown per bulan terurut', () => {
    const m = getMonthlyBreakdown(data, 6)
    expect(m.map((x) => x.key)).toEqual(['2026-09', '2026-10'])
    expect(m[1].labaBersih).toBe(1_000_000)
  })
  it('KAS-04 nominal string dari DB (numeric) dihitung benar', () => {
    const t = tx('pemasukan', 0, '2026-10-01')
    ;(t as unknown as { nominal: string }).nominal = '2500000.50'
    expect(calculateKasSummary([t]).totalIncome).toBeCloseTo(2_500_000.5)
  })
  it('KAS-05 distribusi kategori', () => {
    const d = getCategoryDistribution(data, 'pemasukan')
    expect(d[0].category).toBe('Penjualan')
    expect(d.reduce((a, b) => a + b.pct, 0)).toBeGreaterThanOrEqual(99)
  })
  it('KAS-06 format rupiah', () => {
    expect(formatRupiah(1500000)).toBe('Rp 1.500.000')
  })
})
