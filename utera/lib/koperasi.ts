import { evaluateGuardrail, calculateFlatInstallment, type GuardrailCheck } from './kur'

// Pilar Peminjaman Koperasi (PRD F12 dan F13):
// - simulasi cicilan dari nominal, tenor, dan jasa (bunga) yang bisa diisi sendiri
// - pengajuan hanya boleh disimpan jika cicilan masih sesuai arus kas (batas 30% laba)

export type MetodeJasa = 'flat' | 'menurun'

export const METODE_JASA: Record<MetodeJasa, { nama: string; penjelasan: string }> = {
  flat: {
    nama: 'Flat',
    penjelasan: 'Jasa dihitung dari pinjaman awal setiap bulan, jadi cicilan sama rata sampai lunas.',
  },
  menurun: {
    nama: 'Menurun',
    penjelasan: 'Jasa dihitung dari sisa pinjaman, jadi cicilan paling besar di awal lalu makin kecil.',
  },
}

export const STATUS_PENGAJUAN = ['direncanakan', 'diajukan', 'disetujui', 'ditolak'] as const
export type StatusPengajuan = (typeof STATUS_PENGAJUAN)[number]

export const LABEL_STATUS: Record<StatusPengajuan, string> = {
  direncanakan: 'Direncanakan',
  diajukan: 'Sudah diajukan',
  disetujui: 'Disetujui',
  ditolak: 'Ditolak',
}

export const TUJUAN_PINJAMAN = [
  'Tambah modal kerja',
  'Beli stok barang',
  'Beli atau perbaiki peralatan',
  'Renovasi tempat usaha',
  'Lainnya',
] as const

export const BATAS_KOPERASI = {
  minPlafon: 1_000_000,
  maxPlafon: 500_000_000,
  minTenor: 3,
  maxTenor: 60,
  /** Jasa per tahun dalam persen */
  minJasa: 0.1,
  maxJasa: 60,
} as const

/** Rasio maksimal cicilan terhadap laba bulanan (PRD: batas aman 30%). */
export const BATAS_CICILAN = 0.3

export interface HasilKoperasi {
  metode: MetodeJasa
  /** Cicilan bulan pertama; pada metode flat sama dengan cicilan setiap bulan */
  cicilanAwal: number
  /** Cicilan bulan terakhir; pada metode flat sama dengan cicilanAwal */
  cicilanAkhir: number
  totalJasa: number
  totalBayar: number
}

/**
 * Hitung cicilan koperasi.
 * - flat: pokok per bulan = pinjaman / tenor, jasa per bulan = pinjaman x jasa / 12 (tetap)
 * - menurun: pokok per bulan sama, jasa per bulan dihitung dari sisa pinjaman
 * jasaPersen dalam persen per tahun, mis. 9 untuk 9%.
 */
export function hitungKoperasi(
  plafon: number,
  jasaPersen: number,
  tenor: number,
  metode: MetodeJasa
): HasilKoperasi {
  if (!(plafon > 0) || !(tenor > 0) || !(jasaPersen >= 0)) {
    return { metode, cicilanAwal: 0, cicilanAkhir: 0, totalJasa: 0, totalBayar: 0 }
  }
  const rate = jasaPersen / 100

  if (metode === 'flat') {
    const h = calculateFlatInstallment(plafon, rate, tenor)
    return {
      metode,
      cicilanAwal: h.total,
      cicilanAkhir: h.total,
      totalJasa: Math.max(0, h.totalKumulatif - plafon),
      totalBayar: h.totalKumulatif,
    }
  }

  const pokok = plafon / tenor
  const jasaAwal = (plafon * rate) / 12
  const jasaAkhir = (pokok * rate) / 12
  // Jumlah jasa: plafon x jasa/12 x (n + 1) / 2 (deret turun satu per satu)
  const totalJasa = Math.round((jasaAwal * (tenor + 1)) / 2)
  return {
    metode,
    cicilanAwal: Math.round(pokok + jasaAwal),
    cicilanAkhir: Math.round(pokok + jasaAkhir),
    totalJasa,
    totalBayar: Math.round(plafon) + totalJasa,
  }
}

/**
 * Pinjaman terbesar yang cicilan pertamanya masih di dalam batas aman (30% laba),
 * dibulatkan ke bawah per Rp 100.000. Cicilan pertama berbanding lurus dengan pinjaman, jadi
 * cukup dibagi, tanpa coba-coba.
 */
export function plafonMaksimalAman(
  labaBulanan: number,
  jasaPersen: number,
  tenor: number
): number {
  if (!(labaBulanan > 0) || !(tenor > 0) || !(jasaPersen >= 0)) return 0
  const batas = labaBulanan * BATAS_CICILAN
  const perRupiah = 1 / tenor + jasaPersen / 100 / 12
  return Math.floor(batas / perRupiah / 100_000) * 100_000
}

export interface EvaluasiPengajuan {
  guard: GuardrailCheck
  /** Boleh disimpan: ada laba untuk dinilai dan cicilan di dalam batas 30% */
  boleh: boolean
  /** Penyebab bila tidak boleh disimpan */
  alasan: 'belum-ada-kas' | 'melebihi-batas' | null
}

/** Aturan PRD: pengajuan koperasi hanya disimpan jika cicilan sesuai arus kas. */
export function evaluasiPengajuan(cicilanAwal: number, labaBulanan: number): EvaluasiPengajuan {
  const guard = evaluateGuardrail(cicilanAwal, labaBulanan)
  if (!(labaBulanan > 0)) return { guard, boleh: false, alasan: 'belum-ada-kas' }
  if (!guard.isSafe) return { guard, boleh: false, alasan: 'melebihi-batas' }
  return { guard, boleh: true, alasan: null }
}

/** Jasa per tahun dari ketikan pengguna: "9", "9,5", atau "9.5". */
export function parseJasa(raw: string): { value: number; error: null } | { value: null; error: string } {
  const teks = String(raw ?? '').trim().replace('%', '').replace(',', '.')
  if (!teks) return { value: null, error: 'Jasa per tahun wajib diisi.' }
  if (!/^\d+(\.\d{1,2})?$/.test(teks)) return { value: null, error: 'Isi jasa dengan angka, misalnya 9 atau 9,5.' }
  const value = Number(teks)
  if (value < BATAS_KOPERASI.minJasa || value > BATAS_KOPERASI.maxJasa) {
    return { value: null, error: `Jasa per tahun harus antara ${BATAS_KOPERASI.minJasa}% dan ${BATAS_KOPERASI.maxJasa}%.` }
  }
  return { value, error: null }
}

export interface IsianPengajuan {
  namaKoperasi: string
  tujuan: string
  plafon: number
  tenor: number
  jasaPersen: number
}

/** Daftar pesan kesalahan isian pengajuan; kosong bila semua benar. */
export function validasiPengajuan(i: IsianPengajuan): string[] {
  const salah: string[] = []
  const nama = i.namaKoperasi.trim()
  if (nama.length < 3) salah.push('Nama koperasi minimal 3 huruf.')
  if (nama.length > 80) salah.push('Nama koperasi maksimal 80 huruf.')
  if (!i.tujuan.trim()) salah.push('Pilih tujuan pinjaman.')
  if (!(i.plafon >= BATAS_KOPERASI.minPlafon) || i.plafon > BATAS_KOPERASI.maxPlafon) {
    salah.push('Jumlah pinjaman harus antara Rp 1.000.000 dan Rp 500.000.000.')
  }
  if (!Number.isInteger(i.tenor) || i.tenor < BATAS_KOPERASI.minTenor || i.tenor > BATAS_KOPERASI.maxTenor) {
    salah.push(`Tenor harus antara ${BATAS_KOPERASI.minTenor} dan ${BATAS_KOPERASI.maxTenor} bulan.`)
  }
  if (!(i.jasaPersen >= BATAS_KOPERASI.minJasa) || i.jasaPersen > BATAS_KOPERASI.maxJasa) {
    salah.push(`Jasa per tahun harus antara ${BATAS_KOPERASI.minJasa}% dan ${BATAS_KOPERASI.maxJasa}%.`)
  }
  return salah
}

// ---------------------------------------------------------------------------
// Perbandingan dua pengajuan tersimpan (PRD F17: dua simulasi koperasi berdampingan).
// Selisih dihitung saat ditampilkan, tidak disimpan di database.
// ---------------------------------------------------------------------------

export interface RingkasPengajuan {
  /** Nama yang ditampilkan; harus berbeda antara A dan B (mis. tambah "(A)" bila namanya sama) */
  label: string
  plafon: number
  tenor: number
  jasaPersen: number
  metode: MetodeJasa
  cicilanAwal: number
  cicilanAkhir: number
  totalJasa: number
  /** Cicilan awal dibanding laba bulanan saat disimpan, dalam persen */
  rasioKas: number
}

export type Pemenang = 'a' | 'b' | 'seri'

export interface HasilBanding {
  /** Nilai A dikurangi B; negatif berarti A lebih kecil */
  selisihCicilanAwal: number
  selisihTotalJasa: number
  selisihTotalBayar: number
  totalBayar: { a: number; b: number }
  /** Total jasa per Rp 1 juta pinjaman: adil dipakai walau jumlah pinjamannya berbeda */
  jasaPerJuta: { a: number; b: number }
  /** false bila jumlah pinjaman berbeda: cicilan dan total jasa tidak bisa dibandingkan langsung */
  samaPlafon: boolean
  /** Untuk semua ukuran di bawah, nilai yang lebih kecil lebih baik */
  pemenang: { cicilan: Pemenang; totalJasa: Pemenang; jasaPerJuta: Pemenang; rasio: Pemenang }
  kesimpulan: string
}

/** Nilai yang lebih kecil menang; selisih di bawah toleransi dianggap seri (rupiah: 0,5; persen: 0,05). */
function lebihKecil(a: number, b: number, toleransi = 0.5): Pemenang {
  if (Math.abs(a - b) < toleransi) return 'seri'
  return a < b ? 'a' : 'b'
}

/** Bandingkan dua pengajuan. Ukuran biaya yang adil adalah total jasa per Rp 1 juta pinjaman. */
export function bandingkanPengajuan(a: RingkasPengajuan, b: RingkasPengajuan): HasilBanding {
  const jasaPerJutaA = a.plafon > 0 ? Math.round((a.totalJasa / a.plafon) * 1_000_000) : 0
  const jasaPerJutaB = b.plafon > 0 ? Math.round((b.totalJasa / b.plafon) * 1_000_000) : 0
  const totalBayarA = Math.round(a.plafon) + a.totalJasa
  const totalBayarB = Math.round(b.plafon) + b.totalJasa

  const pemenang = {
    cicilan: lebihKecil(a.cicilanAwal, b.cicilanAwal),
    totalJasa: lebihKecil(a.totalJasa, b.totalJasa),
    jasaPerJuta: lebihKecil(jasaPerJutaA, jasaPerJutaB),
    rasio: lebihKecil(a.rasioKas, b.rasioKas, 0.05),
  }
  const nama = (p: Pemenang) => (p === 'a' ? a.label : b.label)

  const samaPlafon = Math.abs(a.plafon - b.plafon) < 1

  let kesimpulan: string
  const { cicilan, jasaPerJuta } = pemenang
  if (!samaPlafon) {
    // Jumlah pinjaman berbeda: cicilan dan total jasa ikut berbeda hanya karena besarnya pinjaman.
    // Yang adil dibandingkan adalah biaya jasa per Rp 1 juta pinjaman.
    kesimpulan =
      jasaPerJuta === 'seri'
        ? 'Jumlah pinjamannya berbeda. Per Rp 1 juta pinjaman, biaya jasa keduanya sama.'
        : `Jumlah pinjamannya berbeda, jadi dibandingkan per Rp 1 juta pinjaman: ${nama(jasaPerJuta)} lebih hemat karena biaya jasanya lebih kecil.`
  } else if (cicilan === 'seri' && jasaPerJuta === 'seri') {
    kesimpulan = 'Kedua pengajuan punya cicilan dan biaya jasa yang sama.'
  } else if (cicilan === jasaPerJuta) {
    kesimpulan = `${nama(cicilan)} lebih menguntungkan: cicilan per bulan lebih ringan dan biaya jasanya lebih kecil.`
  } else if (cicilan === 'seri') {
    kesimpulan = `Cicilannya sama, tetapi ${nama(jasaPerJuta)} lebih hemat karena biaya jasanya lebih kecil.`
  } else if (jasaPerJuta === 'seri') {
    kesimpulan = `Biaya jasanya sama, tetapi ${nama(cicilan)} punya cicilan per bulan yang lebih ringan.`
  } else {
    kesimpulan = `${nama(cicilan)} lebih ringan tiap bulan, tetapi ${nama(jasaPerJuta)} lebih hemat secara total jasa. Pilih sesuai prioritas: kas bulanan yang longgar atau total biaya yang kecil.`
  }

  return {
    selisihCicilanAwal: a.cicilanAwal - b.cicilanAwal,
    selisihTotalJasa: a.totalJasa - b.totalJasa,
    selisihTotalBayar: totalBayarA - totalBayarB,
    totalBayar: { a: totalBayarA, b: totalBayarB },
    jasaPerJuta: { a: jasaPerJutaA, b: jasaPerJutaB },
    samaPlafon,
    pemenang,
    kesimpulan,
  }
}
