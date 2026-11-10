import { describe, it, expect } from 'vitest'
import { parseNominal, todayLocal, csvCell } from '../lib/input'

describe('Validasi input transaksi (F4)', () => {
  it('INP-01 nominal valid', () => {
    expect(parseNominal('250000')).toEqual({ value: 250000, error: null })
    expect(parseNominal('1.500.000')).toEqual({ value: 1500000, error: null })
    expect(parseNominal('Rp 2.000')).toEqual({ value: 2000, error: null })
  })
  it('INP-02 negatif ditolak (bukan diam-diam jadi positif)', () => {
    expect(parseNominal('-5000').value).toBeNull()
  })
  it('INP-03 nol, kosong, huruf ditolak', () => {
    expect(parseNominal('0').value).toBeNull()
    expect(parseNominal('').value).toBeNull()
    expect(parseNominal('abc').value).toBeNull()
  })
  it('INP-04 desimal ditolak (1.5 bukan jadi 15)', () => {
    expect(parseNominal('1,5').value).toBeNull()
    expect(parseNominal('1.5').value).toBeNull()
  })
  it('INP-05 tanggal lokal, bukan UTC', () => {
    // 00:30 WIB = 17:30 UTC hari sebelumnya; lokal tetap hari yang sama.
    expect(todayLocal(new Date(2026, 10, 10, 0, 30))).toBe('2026-11-10')
  })
  it('INP-06 CSV aman untuk koma, kutip, #', () => {
    expect(csvCell('a, "b" #1')).toBe('"a, ""b"" #1"')
  })
})
