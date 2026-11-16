export interface KurTier {
  id: string
  name: string
  rate: number
  rateDisplay: string
  minPlafon: number
  maxPlafon: number
  minTenor: number
  maxTenor: number
  defaultPlafon: number
  defaultTenor: number
  ticks: string[]
}

// Sumber tunggal jenis KUR (PRD "Jenis KUR sebagai batas nominal"). Bunga 6%/tahun.
export const KUR_TIERS: Record<string, KurTier> = {
  'kur-super': {
    id: 'kur-super',
    name: 'KUR Super Mikro',
    rate: 0.06,
    rateDisplay: '6.0%',
    minPlafon: 1_000_000,
    maxPlafon: 10_000_000,
    minTenor: 12,
    maxTenor: 36,
    defaultPlafon: 10_000_000,
    defaultTenor: 12,
    ticks: ['Rp 1 Jt', 'Rp 3 Jt', 'Rp 5 Jt', 'Rp 10 Jt'],
  },
  'kur-mikro': {
    id: 'kur-mikro',
    name: 'KUR Mikro',
    rate: 0.06,
    rateDisplay: '6.0%',
    minPlafon: 10_000_000,
    maxPlafon: 50_000_000,
    minTenor: 36,
    maxTenor: 60,
    defaultPlafon: 30_000_000,
    defaultTenor: 36,
    ticks: ['Rp 10 Jt', 'Rp 20 Jt', 'Rp 35 Jt', 'Rp 50 Jt'],
  },
  'kur-kecil': {
    id: 'kur-kecil',
    name: 'KUR Kecil (Ekspansi)',
    rate: 0.06,
    rateDisplay: '6.0%',
    minPlafon: 50_000_000,
    maxPlafon: 500_000_000,
    minTenor: 12,
    maxTenor: 60,
    defaultPlafon: 100_000_000,
    defaultTenor: 36,
    ticks: ['Rp 50 Jt', 'Rp 200 Jt', 'Rp 350 Jt', 'Rp 500 Jt'],
  },
}

export interface InstallmentResult {
  total: number
  pokok: number
  bunga: number
  totalKumulatif: number
}

/**
 * Annuity formula: P * (r * (1 + r)^n) / ((1 + r)^n - 1)
 */
export function calculateInstallment(
  principal: number,
  annualRate: number,
  months: number
): InstallmentResult {
  if (months <= 0 || principal <= 0) {
    return { total: 0, pokok: 0, bunga: 0, totalKumulatif: 0 }
  }

  const monthlyRate = annualRate / 12
  if (monthlyRate === 0) {
    const pokok = Math.round(principal / months)
    return { total: pokok, pokok, bunga: 0, totalKumulatif: principal }
  }

  const factor = Math.pow(1 + monthlyRate, months)
  const total = Math.round((principal * (monthlyRate * factor)) / (factor - 1))
  const pokok = Math.round(principal / months)
  const bunga = Math.max(0, total - pokok)
  const totalKumulatif = total * months

  return { total, pokok, bunga, totalKumulatif }
}

/**
 * Status cek kelayakan KUR sesuai PRD:
 * - Memenuhi syarat: syarat administratif terpenuhi dan skor Cukup/Baik (>= 40)
 * - Belum siap: syarat administratif terpenuhi tetapi skor Rendah (< 40)
 * - Belum memenuhi: ada syarat administratif yang gagal (disebutkan satu per satu)
 * Syarat yang bisa dicek otomatis: usaha berjalan >= 6 bulan (bulan tercatat) dan punya NIB/SKU.
 * Syarat deklarasi (usia, SLIK OJK, kredit lain) tidak bisa diverifikasi UTERA.
 */
export interface KelayakanKur {
  status: 'Memenuhi syarat' | 'Belum siap' | 'Belum memenuhi'
  siap: boolean
  kekurangan: string[]
}

export function evaluateKelayakanKur(input: {
  skor: number
  bulanTercatat: number
  punyaNibAtauSku: boolean
}): KelayakanKur {
  const kekurangan: string[] = []
  if (input.bulanTercatat < 6) {
    kekurangan.push(`Riwayat kas baru ${input.bulanTercatat} dari 6 bulan`)
  }
  if (!input.punyaNibAtauSku) kekurangan.push('Belum ada NIB atau SKU di Legalitas')
  if (kekurangan.length > 0) return { status: 'Belum memenuhi', siap: false, kekurangan }
  if (input.skor < 40) {
    return { status: 'Belum siap', siap: false, kekurangan: ['Skor kelayakan masih Rendah (di bawah 40)'] }
  }
  return { status: 'Memenuhi syarat', siap: true, kekurangan: [] }
}

export interface GuardrailCheck {
  guardrailLimit: number
  ratio: number
  isSafe: boolean
  remainingCash: number
  statusText: 'Kondisi Aman' | 'Batas Waspada' | 'Melebihi Batas Kas'
  color: string
}

export function evaluateGuardrail(
  installment: number,
  netProfit: number
): GuardrailCheck {
  const guardrailLimit = Math.max(0, Math.round(netProfit * 0.3))
  const ratio = netProfit > 0 ? (installment / netProfit) * 100 : 100
  const remainingCash = Math.max(0, netProfit - installment)

  let statusText: GuardrailCheck['statusText']
  let color: string

  if (ratio <= 25) {
    statusText = 'Kondisi Aman'
    color = '#2A8865'
  } else if (ratio <= 30) {
    statusText = 'Batas Waspada'
    color = '#C98A1B'
  } else {
    statusText = 'Melebihi Batas Kas'
    color = '#DC2626'
  }

  return {
    guardrailLimit,
    ratio,
    isSafe: ratio <= 30,
    remainingCash,
    statusText,
    color,
  }
}


// ---------------------------------------------------------------------------
// Pinjaman koperasi dan kredit komersial, serta perbandingan semua pilihan pembiayaan
// ---------------------------------------------------------------------------

/** Pinjaman koperasi: bunga jasa flat (PRD F12). */
export const KOPERASI = {
  id: 'koperasi',
  name: 'Pinjaman Koperasi UMKM',
  rate: 0.09,
  rateDisplay: '9.0%',
  minPlafon: 1_000_000,
  maxPlafon: 50_000_000,
  minTenor: 6,
  maxTenor: 60,
} as const

/** Kredit usaha komersial (non-KUR): asumsi bunga pasar, hanya untuk pembanding. */
export const KOMERSIAL = {
  id: 'komersial',
  name: 'Kredit Usaha Komersial (Non-KUR)',
  rate: 0.13,
  rateDisplay: '13.0%',
  minPlafon: 1_000_000,
  maxPlafon: 500_000_000,
  minTenor: 6,
  maxTenor: 60,
} as const

/** Bunga flat: pokok dibagi rata, bunga selalu dihitung dari pokok awal. */
export function calculateFlatInstallment(
  principal: number,
  annualRate: number,
  months: number
): InstallmentResult {
  if (months <= 0 || principal <= 0) return { total: 0, pokok: 0, bunga: 0, totalKumulatif: 0 }
  const pokok = Math.round(principal / months)
  const bunga = Math.round((principal * annualRate) / 12)
  return { total: pokok + bunga, pokok, bunga, totalKumulatif: (pokok + bunga) * months }
}

export type MetodeBunga = 'anuitas' | 'flat'

export interface BarisPerbandingan {
  id: string
  nama: string
  keterangan: string
  rate: number
  rateDisplay: string
  metode: MetodeBunga
  /** false bila plafon atau tenor yang diuji di luar batas program ini */
  tersedia: boolean
  /** Alasan bila tidak tersedia, mis. "Plafon s.d. Rp 10.000.000" */
  alasan?: string
  cicilan: number
  totalBunga: number
  /** Cicilan dibanding laba bulanan, dalam persen (100 bila laba 0) */
  rasio: number
  status: GuardrailCheck['statusText']
  aman: boolean
}

interface ProgramPembanding {
  id: string
  nama: string
  keterangan: string
  rate: number
  rateDisplay: string
  metode: MetodeBunga
  minPlafon: number
  maxPlafon: number
  minTenor: number
  maxTenor: number
}

function programPembanding(): ProgramPembanding[] {
  const kur = (t: KurTier, nama: string, keterangan: string): ProgramPembanding => ({
    id: t.id,
    nama,
    keterangan,
    rate: t.rate,
    rateDisplay: t.rateDisplay,
    metode: 'anuitas',
    minPlafon: t.minPlafon,
    maxPlafon: t.maxPlafon,
    minTenor: t.minTenor,
    maxTenor: t.maxTenor,
  })
  return [
    kur(KUR_TIERS['kur-super'], 'KUR Super Mikro', 'Modal perdana, bunga subsidi'),
    kur(KUR_TIERS['kur-mikro'], 'KUR Mikro', 'Modal kerja warung dan usaha kecil'),
    kur(KUR_TIERS['kur-kecil'], 'KUR Kecil (Ekspansi)', 'Perluasan usaha'),
    { ...KOPERASI, nama: KOPERASI.name, keterangan: 'Bunga flat, syarat cepat', metode: 'flat' },
    { ...KOMERSIAL, nama: KOMERSIAL.name, keterangan: 'Bunga pasar (asumsi 13%)', metode: 'anuitas' },
  ]
}

const rupiahPendek = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

/**
 * Bandingkan semua pilihan pembiayaan pada plafon dan tenor yang sama, memakai rumus yang sama
 * dengan simulator (anuitas untuk KUR dan komersial, flat untuk koperasi) dan batas aman 30% laba.
 * Program yang tidak melayani plafon atau tenor tersebut tetap ditampilkan, ditandai tidak tersedia.
 */
export function bandingkanPembiayaan(input: {
  plafon: number
  tenor: number
  labaBulanan: number
}): BarisPerbandingan[] {
  const { plafon, tenor, labaBulanan } = input

  return programPembanding().map((p) => {
    const alasan: string[] = []
    if (plafon < p.minPlafon || plafon > p.maxPlafon) {
      alasan.push(`plafon ${rupiahPendek(p.minPlafon)} sampai ${rupiahPendek(p.maxPlafon)}`)
    }
    if (tenor < p.minTenor || tenor > p.maxTenor) {
      alasan.push(`tenor ${p.minTenor} sampai ${p.maxTenor} bulan`)
    }
    const tersedia = alasan.length === 0

    const hasil = !tersedia
      ? { total: 0, pokok: 0, bunga: 0, totalKumulatif: 0 }
      : p.metode === 'flat'
        ? calculateFlatInstallment(plafon, p.rate, tenor)
        : calculateInstallment(plafon, p.rate, tenor)
    const guard = evaluateGuardrail(hasil.total, labaBulanan)

    return {
      id: p.id,
      nama: p.nama,
      keterangan: p.keterangan,
      rate: p.rate,
      rateDisplay: p.rateDisplay,
      metode: p.metode,
      tersedia,
      alasan: tersedia ? undefined : `Batas program: ${alasan.join(' dan ')}`,
      cicilan: hasil.total,
      totalBunga: Math.max(0, hasil.totalKumulatif - plafon),
      rasio: guard.ratio,
      status: guard.statusText,
      aman: guard.isSafe,
    }
  })
}

/** Pilihan paling hemat (total bunga terendah) di antara yang tersedia dan masih aman; null bila tidak ada. */
export function pilihanPalingHemat(baris: BarisPerbandingan[]): BarisPerbandingan | null {
  const layak = baris.filter((b) => b.tersedia && b.aman)
  if (layak.length === 0) return null
  return layak.reduce((a, b) => (b.totalBunga < a.totalBunga ? b : a))
}
