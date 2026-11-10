import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { calculateSkorPRD } from '../lib/skor'
import { tx } from './helpers'

// "Hari ini" dibekukan agar jendela 6 bulan kalender deterministik (Jun-Nov 2026).
beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-10T03:00:00Z'))
})
afterAll(() => vi.useRealTimers())

const MONTHS = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']

describe('F6 skor kelayakan (PRD: rumus 30/25/25/20)', () => {
  it('SKOR-01 tanpa transaksi: skor 0, kategori Belum Ada Data', () => {
    const r = calculateSkorPRD([])
    expect(r.total).toBe(0)
    expect(r.category).toBe('Belum Ada Data')
  })

  it('SKOR-02 6 bulan penuh, margin >=20%, tren naik: skor 100', () => {
    const txs = MONTHS.flatMap((m, i) => [
      tx('pemasukan', 10_000_000 + i * 1_000_000, `${m}-05`),
      tx('pengeluaran', 5_000_000, `${m}-06`, 'Operasional'),
    ])
    const r = calculateSkorPRD(txs)
    expect(r.k1.score).toBe(30)
    expect(r.k2.score).toBe(25)
    expect(r.k3.score).toBe(25)
    expect(r.k4.score).toBe(20)
    expect(r.total).toBe(100)
    expect(r.category).toBe('Baik')
  })

  it('SKOR-03 R_lama=0 dan R_baru>0: komponen tren penuh', () => {
    const txs = ['2026-09', '2026-10', '2026-11'].map((m) => tx('pemasukan', 1_000_000, `${m}-01`))
    expect(calculateSkorPRD(txs).k2.score).toBe(25)
  })

  it('SKOR-04 tren turun: rasio R_baru/R_lama', () => {
    const txs = [
      tx('pemasukan', 10_000_000, '2026-06-01'),
      tx('pemasukan', 5_000_000, '2026-09-01'),
    ]
    const r = calculateSkorPRD(txs)
    expect(r.k2.ratio).toBeCloseTo(0.5)
    expect(r.k2.score).toBe(Math.round(25 * 0.5))
  })

  it('SKOR-05 margin negatif: tanpa poin profitabilitas dan stabilitas', () => {
    const txs = [
      tx('pemasukan', 1_000_000, '2026-10-01'),
      tx('pengeluaran', 3_000_000, '2026-10-02', 'Operasional'),
    ]
    const r = calculateSkorPRD(txs)
    expect(r.k3.score).toBe(0)
    expect(r.k4.score).toBe(0)
  })

  it('SKOR-06 6 bulan tercatat, laba tipis: K1=30, K4=20, K3=0', () => {
    const txs = MONTHS.flatMap((m) => [
      tx('pemasukan', 1_000_000, `${m}-05`),
      tx('pengeluaran', 999_999, `${m}-06`, 'Operasional'),
    ])
    const r = calculateSkorPRD(txs)
    expect(r.k1.score).toBe(30)
    expect(r.k3.score).toBe(0)
    expect(r.k4.score).toBe(20)
  })

  it('SKOR-07 batas kategori: <40 Rendah, 40-69 Cukup, >=70 Baik', () => {
    // 4 dari 6 bulan tercatat, laba positif, tren naik, margin >=20%:
    // K1=20, K2=25, K3=25, K4=round(20*4/6)=13 -> 83 (Baik)
    const baik = ['2026-08', '2026-09', '2026-10', '2026-11'].flatMap((m) => [
      tx('pemasukan', 10_000_000, `${m}-05`),
      tx('pengeluaran', 5_000_000, `${m}-06`, 'Operasional'),
    ])
    expect(calculateSkorPRD(baik).category).toBe('Baik')
    // 1 bulan, rugi: K1=5, K2=25, K3=0, K4=0 -> 30 (Rendah)
    const rendah = [
      tx('pemasukan', 1_000_000, '2026-11-01'),
      tx('pengeluaran', 2_000_000, '2026-11-02', 'Operasional'),
    ]
    expect(calculateSkorPRD(rendah).total).toBe(30)
    expect(calculateSkorPRD(rendah).category).toBe('Rendah')
  })

  it('SKOR-08 jendela = 6 bulan KALENDER terakhir; bulan lama tidak dihitung', () => {
    const txs = [
      tx('pemasukan', 1_000_000, '2026-03-01'),
      tx('pemasukan', 1_000_000, '2026-10-01'),
    ]
    expect(calculateSkorPRD(txs).k1.detail).toContain('1 dari 6')
  })

  it('SKOR-09 data < 6 bulan memunculkan peringatan (PRD)', () => {
    const r = calculateSkorPRD([tx('pemasukan', 1_000_000, '2026-10-01')]) as unknown as Record<string, unknown>
    expect(r.dataKurang).toBe(true)
  })
})

import { buildSkorSnapshot } from '../lib/skor'

describe('Snapshot skor_kelayakan', () => {
  it('SNAP-01 konsistensi_bulan = jumlah bulan, omzet = rata-rata per bulan tercatat', () => {
    const txs = ['2026-09', '2026-10'].flatMap((m) => [
      tx('pemasukan', 10_000_000, `${m}-05`),
      tx('pengeluaran', 4_000_000, `${m}-06`, 'Operasional'),
    ])
    const s = buildSkorSnapshot(calculateSkorPRD(txs))
    expect(s.konsistensi_bulan).toBe(2)
    expect(s.omzet_bulanan).toBe(10_000_000)
    expect(s.laba_bersih).toBe(12_000_000)
    expect(s.margin_profit).toBe(60)
  })
})

import { rataLabaBulanan } from '../lib/skor'

describe('Dasar guardrail 30%', () => {
  it('GR-05 rata-rata laba per bulan tercatat, bukan total seluruh waktu', () => {
    const txs = ['2026-09', '2026-10'].flatMap((m) => [
      tx('pemasukan', 10_000_000, `${m}-05`),
      tx('pengeluaran', 4_000_000, `${m}-06`, 'Operasional'),
    ])
    expect(rataLabaBulanan(calculateSkorPRD(txs))).toBe(6_000_000)
  })
  it('GR-06 tanpa data = 0 (tidak ada angka bawaan)', () => {
    expect(rataLabaBulanan(calculateSkorPRD([]))).toBe(0)
  })
})
