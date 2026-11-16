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

export function clampToTier(tier: KurTier, plafon: number, tenor: number) {
  return {
    plafon: Math.min(tier.maxPlafon, Math.max(tier.minPlafon, plafon)),
    tenor: Math.min(tier.maxTenor, Math.max(tier.minTenor, tenor)),
  }
}

export const BANKS: Record<string, string> = {
  bri: 'Bank BRI',
  mandiri: 'Bank Mandiri',
  bni: 'Bank BNI',
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

