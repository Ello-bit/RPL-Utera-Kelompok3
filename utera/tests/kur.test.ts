import { describe, it, expect } from 'vitest'
import { calculateInstallment, calculateFlatInstallment, bandingkanPembiayaan, pilihanPalingHemat, tandaPlafon, evaluateGuardrail, evaluateKelayakanKur, KUR_TIERS } from '../lib/kur'

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

describe('Perbandingan pilihan pembiayaan', () => {
  const cari = (baris: ReturnType<typeof bandingkanPembiayaan>, id: string) => baris.find((b) => b.id === id)!

  it('CP-01 hanya program yang melayani plafon dan tenor itu yang tersedia', () => {
    const b = bandingkanPembiayaan({ plafon: 30_000_000, tenor: 36, labaBulanan: 11_807_800 })
    expect(b.map((x) => [x.id, x.tersedia])).toEqual([
      ['kur-super', false],
      ['kur-mikro', true],
      ['kur-kecil', false],
      ['koperasi', true],
      ['komersial', true],
    ])
    expect(cari(b, 'kur-super').alasan).toContain('Batas program')
  })

  it('CP-02 cicilan sama dengan simulator: KUR Mikro anuitas dan koperasi flat', () => {
    const b = bandingkanPembiayaan({ plafon: 30_000_000, tenor: 36, labaBulanan: 11_807_800 })
    expect(cari(b, 'kur-mikro').cicilan).toBe(912_658)
    expect(cari(b, 'koperasi').cicilan).toBe(1_058_333)
    expect(cari(b, 'komersial').cicilan).toBe(calculateInstallment(30_000_000, 0.13, 36).total)
  })

  it('CP-03 total bunga: flat koperasi lebih mahal daripada KUR Mikro', () => {
    const b = bandingkanPembiayaan({ plafon: 30_000_000, tenor: 36, labaBulanan: 11_807_800 })
    expect(cari(b, 'kur-mikro').totalBunga).toBe(912_658 * 36 - 30_000_000)
    expect(cari(b, 'koperasi').totalBunga).toBe(1_058_333 * 36 - 30_000_000)
    expect(cari(b, 'koperasi').totalBunga).toBeGreaterThan(cari(b, 'kur-mikro').totalBunga)
  })

  it('CP-04 status mengikuti batas 30% laba', () => {
    const lega = bandingkanPembiayaan({ plafon: 30_000_000, tenor: 36, labaBulanan: 4_000_000 })
    expect(cari(lega, 'kur-mikro').status).toBe('Kondisi Aman') // 22,8%
    expect(cari(lega, 'koperasi').status).toBe('Batas Waspada') // 26,5%
    const sempit = bandingkanPembiayaan({ plafon: 30_000_000, tenor: 36, labaBulanan: 3_000_000 })
    expect(cari(sempit, 'kur-mikro').aman).toBe(false) // 30,4%
    expect(cari(sempit, 'kur-mikro').status).toBe('Melebihi Batas Kas')
  })

  it('CP-05 laba nol: tidak ada yang aman dan tidak ada rekomendasi', () => {
    const b = bandingkanPembiayaan({ plafon: 30_000_000, tenor: 36, labaBulanan: 0 })
    expect(b.filter((x) => x.tersedia).every((x) => !x.aman && x.rasio === 100)).toBe(true)
    expect(pilihanPalingHemat(b)).toBeNull()
  })

  it('CP-06 rekomendasi: total bunga terendah di antara yang aman', () => {
    const b = bandingkanPembiayaan({ plafon: 30_000_000, tenor: 36, labaBulanan: 20_000_000 })
    expect(pilihanPalingHemat(b)?.id).toBe('kur-mikro')
  })

  it('CP-07 tenor di luar batas program membuatnya tidak tersedia', () => {
    const b = bandingkanPembiayaan({ plafon: 30_000_000, tenor: 24, labaBulanan: 11_807_800 })
    expect(cari(b, 'kur-mikro').tersedia).toBe(false) // KUR Mikro minimal 36 bulan
    expect(cari(b, 'kur-mikro').alasan).toContain('tenor 36 sampai 60 bulan')
    expect(cari(b, 'koperasi').tersedia).toBe(true)
  })

  it('CP-08 plafon kecil: KUR Super Mikro tersedia, KUR Mikro tidak', () => {
    const b = bandingkanPembiayaan({ plafon: 5_000_000, tenor: 12, labaBulanan: 11_807_800 })
    expect(cari(b, 'kur-super').tersedia).toBe(true)
    expect(cari(b, 'kur-mikro').tersedia).toBe(false)
    expect(cari(b, 'kur-super').rateDisplay).toBe('6.0%')
  })

  it('CP-09 bunga flat: nol bila plafon atau tenor tidak valid', () => {
    expect(calculateFlatInstallment(0, 0.09, 12).total).toBe(0)
    expect(calculateFlatInstallment(10_000_000, 0.09, 0).total).toBe(0)
    expect(calculateFlatInstallment(25_000_000, 0.09, 12).total).toBe(2_270_833)
  })
})

describe('Penanda slider plafon', () => {
  it('TP-01 tiga angka: batas bawah, tengah, batas atas, tanpa angka ganda', () => {
    expect(tandaPlafon(10_000_000, 50_000_000)).toEqual([10_000_000, 30_000_000, 50_000_000])
    expect(tandaPlafon(1_000_000, 10_000_000)).toEqual([1_000_000, 6_000_000, 10_000_000])
  })

  it('TP-02 untuk semua jenis KUR tidak ada angka yang sama', () => {
    for (const t of Object.values(KUR_TIERS)) {
      const tanda = tandaPlafon(t.minPlafon, t.maxPlafon)
      expect(new Set(tanda).size).toBe(tanda.length)
      expect(tanda[0]).toBe(t.minPlafon)
      expect(tanda[tanda.length - 1]).toBe(t.maxPlafon)
    }
  })

  it('TP-03 rentang sempit: titik tengah dibuang bila menempel ke ujung', () => {
    expect(tandaPlafon(10_000_000, 11_000_000)).toEqual([10_000_000, 11_000_000])
  })

  it('TP-04 batas tidak valid menghasilkan satu angka', () => {
    expect(tandaPlafon(5_000_000, 5_000_000)).toEqual([5_000_000])
  })
})
