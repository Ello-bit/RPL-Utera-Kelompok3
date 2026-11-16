import { describe, it, expect } from 'vitest'
import { calculateInstallment, evaluateGuardrail, evaluateKelayakanKur, KUR_TIERS } from '../lib/kur'

describe('F8 status cek kelayakan KUR (PRD)', () => {
  it('KUR-ST1 6 bulan + NIB + skor 40 = Memenuhi syarat', () => {
    expect(evaluateKelayakanKur({ skor: 40, bulanTercatat: 6, punyaNibAtauSku: true }).status).toBe('Memenuhi syarat')
  })
  it('KUR-ST2 syarat terpenuhi tapi skor Rendah = Belum siap', () => {
    expect(evaluateKelayakanKur({ skor: 39, bulanTercatat: 6, punyaNibAtauSku: true }).status).toBe('Belum siap')
  })
  it('KUR-ST3 data 3 bulan tanpa NIB = Belum memenuhi, dua kekurangan disebut', () => {
    const r = evaluateKelayakanKur({ skor: 75, bulanTercatat: 3, punyaNibAtauSku: false })
    expect(r.status).toBe('Belum memenuhi')
    expect(r.kekurangan).toHaveLength(2)
  })
})

describe('F12 simulasi cicilan (anuitas)', () => {
  it('KUR-01 Rp10jt, 6%/thn, 12 bulan = Rp860.664', () => {
    expect(calculateInstallment(10_000_000, 0.06, 12).total).toBe(860_664)
  })
  it('KUR-02 bunga 0% = pokok / tenor', () => {
    expect(calculateInstallment(12_000_000, 0, 12).total).toBe(1_000_000)
  })
  it('KUR-03 input tidak valid menghasilkan 0', () => {
    expect(calculateInstallment(0, 0.06, 12).total).toBe(0)
    expect(calculateInstallment(1_000_000, 0.06, 0).total).toBe(0)
    expect(calculateInstallment(-1, 0.06, 12).total).toBe(0)
  })
  it('KUR-04 total kumulatif >= pokok', () => {
    const r = calculateInstallment(50_000_000, 0.06, 36)
    expect(r.totalKumulatif).toBeGreaterThanOrEqual(50_000_000)
  })
})

describe('Aturan bisnis: cicilan maks 30% laba bersih', () => {
  it('GR-01 tepat 30% masih aman', () => {
    expect(evaluateGuardrail(3_000_000, 10_000_000).isSafe).toBe(true)
  })
  it('GR-02 30,01% melebihi batas', () => {
    expect(evaluateGuardrail(3_001_000, 10_000_000).isSafe).toBe(false)
  })
  it('GR-03 laba <= 0 selalu melebihi', () => {
    expect(evaluateGuardrail(1, 0).isSafe).toBe(false)
    expect(evaluateGuardrail(1, -5).isSafe).toBe(false)
  })
  it('GR-04 batas nominal = 30% laba', () => {
    expect(evaluateGuardrail(0, 10_000_000).guardrailLimit).toBe(3_000_000)
  })
})

describe('Jenis KUR sesuai tabel PRD', () => {
  const tiers = Object.values(KUR_TIERS)
  it('TIER-01 semua tier berbunga 6%/thn', () => {
    tiers.forEach((x) => expect(x.rate).toBe(0.06))
  })
  it('TIER-02 plafon maks: Super Mikro 10jt, Mikro 50jt, Kecil 500jt', () => {
    expect(KUR_TIERS['kur-super'].maxPlafon).toBe(10_000_000)
    expect(KUR_TIERS['kur-mikro'].maxPlafon).toBe(50_000_000)
    expect(KUR_TIERS['kur-kecil'].maxPlafon).toBe(500_000_000)
  })
  it('TIER-03 Kecil mulai Rp50jt', () => {
    expect(KUR_TIERS['kur-kecil'].minPlafon).toBe(50_000_000)
  })
  it('TIER-04 tenor per tier: 12-36 / 36-60 / maks 60', () => {
    const k = KUR_TIERS as unknown as Record<string, Record<string, unknown>>
    expect([k['kur-super'].minTenor, k['kur-super'].maxTenor]).toEqual([12, 36])
    expect([k['kur-mikro'].minTenor, k['kur-mikro'].maxTenor]).toEqual([36, 60])
    expect(k['kur-kecil'].maxTenor).toBe(60)
  })
})
