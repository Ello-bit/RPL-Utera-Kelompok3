import { describe, it, expect } from 'vitest'
import {
  hitungKoperasi,
  plafonMaksimalAman,
  evaluasiPengajuan,
  parseJasa,
  validasiPengajuan,
  bandingkanPengajuan,
} from '../lib/koperasi'

describe('F12 simulasi cicilan koperasi', () => {
  it('KOP-01 flat: Rp 30 jt, 36 bulan, 9% = Rp 1.058.333 per bulan, tetap sama sampai lunas', () => {
    const h = hitungKoperasi(30_000_000, 9, 36, 'flat')
    expect(h.cicilanAwal).toBe(1_058_333)
    expect(h.cicilanAkhir).toBe(1_058_333)
    expect(h.totalJasa).toBe(1_058_333 * 36 - 30_000_000)
    expect(h.totalBayar).toBe(1_058_333 * 36)
  })

  it('KOP-02 menurun: cicilan awal lebih besar dari akhir, jasa dari sisa pinjaman', () => {
    // Rp 12 jt, 12 bulan, 12%: pokok 1.000.000; jasa awal 120.000; jasa akhir 10.000
    const h = hitungKoperasi(12_000_000, 12, 12, 'menurun')
    expect(h.cicilanAwal).toBe(1_120_000)
    expect(h.cicilanAkhir).toBe(1_010_000)
    expect(h.totalJasa).toBe(780_000) // 120.000 + 110.000 + ... + 10.000
    expect(h.totalBayar).toBe(12_780_000)
  })

  it('KOP-03 total jasa menurun selalu lebih kecil dari flat pada angka yang sama', () => {
    const flat = hitungKoperasi(30_000_000, 9, 36, 'flat')
    const menurun = hitungKoperasi(30_000_000, 9, 36, 'menurun')
    expect(menurun.totalJasa).toBeLessThan(flat.totalJasa)
    expect(menurun.cicilanAwal).toBeGreaterThanOrEqual(flat.cicilanAwal - 1)
  })

  it('KOP-04 jasa bisa diubah: jasa lebih tinggi membuat cicilan lebih besar', () => {
    expect(hitungKoperasi(20_000_000, 12, 24, 'flat').cicilanAwal).toBeGreaterThan(
      hitungKoperasi(20_000_000, 9, 24, 'flat').cicilanAwal
    )
  })

  it('KOP-05 jasa 0%: cicilan hanya pokok dan tidak ada jasa', () => {
    const h = hitungKoperasi(12_000_000, 0, 12, 'menurun')
    expect(h.cicilanAwal).toBe(1_000_000)
    expect(h.totalJasa).toBe(0)
  })

  it('KOP-06 masukan tidak valid menghasilkan nol', () => {
    expect(hitungKoperasi(0, 9, 12, 'flat').cicilanAwal).toBe(0)
    expect(hitungKoperasi(10_000_000, 9, 0, 'menurun').cicilanAwal).toBe(0)
    expect(hitungKoperasi(10_000_000, -1, 12, 'flat').cicilanAwal).toBe(0)
  })
})

describe('F13 aturan pengajuan koperasi', () => {
  it('KOP-07 cicilan di dalam 30% laba boleh disimpan', () => {
    const e = evaluasiPengajuan(2_000_000, 10_000_000) // 20%
    expect(e.boleh).toBe(true)
    expect(e.alasan).toBeNull()
  })

  it('KOP-08 tepat 30% masih boleh, di atas 30% tidak', () => {
    expect(evaluasiPengajuan(3_000_000, 10_000_000).boleh).toBe(true)
    const lewat = evaluasiPengajuan(3_000_001, 10_000_000)
    expect(lewat.boleh).toBe(false)
    expect(lewat.alasan).toBe('melebihi-batas')
  })

  it('KOP-09 belum ada laba (belum mencatat kas): tidak boleh disimpan, alasannya jelas', () => {
    const e = evaluasiPengajuan(500_000, 0)
    expect(e.boleh).toBe(false)
    expect(e.alasan).toBe('belum-ada-kas')
  })

  it('KOP-10 pinjaman maksimal aman: cicilan pertamanya tidak melebihi 30% laba', () => {
    for (const metode of ['flat', 'menurun'] as const) {
      const maks = plafonMaksimalAman(10_000_000, 9, 36)
      expect(maks).toBeGreaterThan(0)
      expect(maks % 100_000).toBe(0)
      const h = hitungKoperasi(maks, 9, 36, metode)
      expect(evaluasiPengajuan(h.cicilanAwal, 10_000_000).boleh).toBe(true)
      // Satu langkah lebih besar sudah melewati batas
      const lebih = hitungKoperasi(maks + 200_000, 9, 36, metode)
      expect(evaluasiPengajuan(lebih.cicilanAwal, 10_000_000).boleh).toBe(false)
    }
  })

  it('KOP-11 tanpa laba tidak ada pinjaman yang aman', () => {
    expect(plafonMaksimalAman(0, 9, 36)).toBe(0)
  })
})

describe('Validasi isian pengajuan', () => {
  const baik = { namaKoperasi: 'Koperasi Sejahtera', tujuan: 'Beli stok barang', plafon: 20_000_000, tenor: 24, jasaPersen: 9 }

  it('KOP-12 isian benar tidak menghasilkan pesan salah', () => {
    expect(validasiPengajuan(baik)).toEqual([])
  })

  it('KOP-13 nama, tujuan, jumlah, tenor, dan jasa yang salah masing-masing ditolak', () => {
    expect(validasiPengajuan({ ...baik, namaKoperasi: ' ab ' })).toHaveLength(1)
    expect(validasiPengajuan({ ...baik, tujuan: '' })).toHaveLength(1)
    expect(validasiPengajuan({ ...baik, plafon: 500_000 })).toHaveLength(1)
    expect(validasiPengajuan({ ...baik, plafon: 600_000_000 })).toHaveLength(1)
    expect(validasiPengajuan({ ...baik, tenor: 2 })).toHaveLength(1)
    expect(validasiPengajuan({ ...baik, tenor: 12.5 })).toHaveLength(1)
    expect(validasiPengajuan({ ...baik, jasaPersen: 0 })).toHaveLength(1)
    expect(validasiPengajuan({ ...baik, jasaPersen: 70 })).toHaveLength(1)
  })

  it('KOP-14 jasa diketik dengan koma, titik, atau tanda persen', () => {
    expect(parseJasa('9')).toEqual({ value: 9, error: null })
    expect(parseJasa('9,5')).toEqual({ value: 9.5, error: null })
    expect(parseJasa('9.5%')).toEqual({ value: 9.5, error: null })
  })

  it('KOP-15 jasa kosong, huruf, atau di luar batas ditolak', () => {
    expect(parseJasa('').value).toBeNull()
    expect(parseJasa('abc').value).toBeNull()
    expect(parseJasa('-5').value).toBeNull()
    expect(parseJasa('0').value).toBeNull()
    expect(parseJasa('61').value).toBeNull()
  })
})

describe('F17 perbandingan dua pengajuan koperasi', () => {
  const dasar = {
    plafon: 20_000_000,
    tenor: 24,
    jasaPersen: 9,
    metode: 'flat' as const,
    cicilanAwal: 983_333,
    cicilanAkhir: 983_333,
    totalJasa: 3_599_992,
    rasioKas: 2.5,
  }
  const A = { ...dasar, label: 'Koperasi A' }

  it('BND-01 jasa lebih rendah menang di cicilan, total jasa, dan biaya per juta', () => {
    const B = { ...dasar, label: 'Koperasi B', jasaPersen: 12, cicilanAwal: 1_033_333, cicilanAkhir: 1_033_333, totalJasa: 4_799_992, rasioKas: 2.6 }
    const h = bandingkanPengajuan(A, B)
    expect(h.pemenang).toEqual({ cicilan: 'a', totalJasa: 'a', jasaPerJuta: 'a', rasio: 'a' })
    expect(h.selisihCicilanAwal).toBe(983_333 - 1_033_333)
    expect(h.selisihTotalJasa).toBe(3_599_992 - 4_799_992)
    expect(h.kesimpulan).toContain('Koperasi A lebih menguntungkan')
  })

  it('BND-02 tenor pendek: cicilan lebih besar tetapi total jasa lebih kecil, kesimpulannya menjelaskan pilihan', () => {
    const pendek = { ...dasar, label: 'Cicilan Cepat', tenor: 12, cicilanAwal: 1_816_667, cicilanAkhir: 1_816_667, totalJasa: 1_800_004 }
    const h = bandingkanPengajuan(A, pendek)
    expect(h.pemenang.cicilan).toBe('a') // A lebih ringan tiap bulan
    expect(h.pemenang.totalJasa).toBe('b') // pendek lebih hemat total
    expect(h.kesimpulan).toContain('Koperasi A lebih ringan tiap bulan')
    expect(h.kesimpulan).toContain('Cicilan Cepat lebih hemat')
  })

  it('BND-03 dua pengajuan identik: seri semua', () => {
    const h = bandingkanPengajuan(A, { ...dasar, label: 'Koperasi A2' })
    expect(h.pemenang).toEqual({ cicilan: 'seri', totalJasa: 'seri', jasaPerJuta: 'seri', rasio: 'seri' })
    expect(h.kesimpulan).toContain('sama')
  })

  it('BND-04 jumlah pinjaman berbeda: dibandingkan per Rp 1 juta supaya adil', () => {
    const kecil = { ...dasar, label: 'Kecil', plafon: 10_000_000, totalJasa: 1_000_000 } // 100.000 per juta
    const besar = { ...dasar, label: 'Besar', plafon: 20_000_000, totalJasa: 1_500_000 } // 75.000 per juta
    const h = bandingkanPengajuan(kecil, besar)
    expect(h.jasaPerJuta).toEqual({ a: 100_000, b: 75_000 })
    expect(h.pemenang.totalJasa).toBe('a') // total jasa kecil lebih sedikit, tetapi tidak adil
    expect(h.pemenang.jasaPerJuta).toBe('b') // per juta, yang besar lebih murah
  })

  it('BND-05 total yang dibayar adalah pinjaman ditambah total jasa', () => {
    const h = bandingkanPengajuan(A, { ...dasar, label: 'B', totalJasa: 4_000_000 })
    expect(h.totalBayar).toEqual({ a: 23_599_992, b: 24_000_000 })
    expect(h.selisihTotalBayar).toBe(23_599_992 - 24_000_000)
  })
})

describe('Perbandingan dengan jumlah pinjaman berbeda', () => {
  const dasar = {
    tenor: 24,
    jasaPersen: 9,
    metode: 'flat' as const,
    cicilanAkhir: 0,
    rasioKas: 2.5,
  }
  const mk = (label: string, plafon: number, totalJasa: number, cicilanAwal: number) => ({ ...dasar, label, plafon, totalJasa, cicilanAwal, cicilanAkhir: cicilanAwal })

  it('BND-06 pinjaman berbeda dengan biaya per juta sama: kesimpulan tidak menyebut pemenang', () => {
    const h = bandingkanPengajuan(mk('jopwo', 25_000_000, 4_500_000, 1_229_167), mk('KOPDES', 20_000_000, 3_600_000, 983_333))
    expect(h.samaPlafon).toBe(false)
    expect(h.pemenang.jasaPerJuta).toBe('seri')
    expect(h.kesimpulan).toBe('Jumlah pinjamannya berbeda. Per Rp 1 juta pinjaman, biaya jasa keduanya sama.')
  })

  it('BND-07 pinjaman berbeda: yang lebih murah per juta disebut, bukan yang cicilannya kecil', () => {
    const h = bandingkanPengajuan(mk('Kecil', 10_000_000, 1_000_000, 500_000), mk('Besar', 20_000_000, 1_500_000, 900_000))
    expect(h.kesimpulan).toContain('Besar lebih hemat')
    expect(h.kesimpulan).not.toContain('Kecil lebih')
  })

  it('BND-08 jumlah pinjaman sama dinyatakan sama', () => {
    expect(bandingkanPengajuan(mk('A', 20_000_000, 3_000_000, 900_000), mk('B', 20_000_000, 3_500_000, 950_000)).samaPlafon).toBe(true)
  })
})
