import { describe, it, expect } from 'vitest'
import { parseNominal, todayLocal, csvCell, formatRibuan, olahKetikanRupiah, posisiKursorRupiah } from '../lib/input'

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

describe('Kolom rupiah bertitik ribuan', () => {
  it('RP-01 titik muncul tiap 3 digit', () => {
    expect(formatRibuan('1500000')).toBe('1.500.000')
    expect(formatRibuan('999')).toBe('999')
    expect(formatRibuan('')).toBe('')
  })
  it('RP-02 mengetik di akhir: titik ditambahkan, kursor tetap di akhir', () => {
    const r = olahKetikanRupiah('1.5000', 6, '1500')
    expect(r.digits).toBe('15000')
    expect(posisiKursorRupiah(formatRibuan(r.digits), r.digitDiKiriKursor)).toBe('15.000'.length)
  })
  it('RP-03 huruf dan simbol dibuang, nol di depan dihapus', () => {
    expect(olahKetikanRupiah('Rp 0025a0', 9, '').digits).toBe('250')
  })
  it('RP-04 Backspace tepat di belakang titik menghapus digit sebelum titik', () => {
    // "1.500" -> kursor setelah titik (posisi 2), Backspace menghapus titik -> "1500", kursor 1
    const r = olahKetikanRupiah('1500', 1, '1500', 'deleteContentBackward')
    expect(r.digits).toBe('500')
    expect(r.digitDiKiriKursor).toBe(0)
  })
  it('RP-05 Delete tepat di depan titik menghapus digit sesudah titik', () => {
    // "1.500" -> kursor sebelum titik (posisi 1), Delete menghapus titik -> "1500", kursor 1
    expect(olahKetikanRupiah('1500', 1, '1500', 'deleteContentForward').digits).toBe('100')
  })
  it('RP-06 panjang dibatasi', () => {
    expect(olahKetikanRupiah('12345678901234567', 17, '', undefined, 13).digits).toHaveLength(13)
  })
  it('RP-07 angka bertitik tetap lolos validasi nominal', () => {
    expect(parseNominal(formatRibuan('2500000'))).toEqual({ value: 2500000, error: null })
  })
})
