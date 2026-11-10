import { Tables } from './database.types'

export type LegalitasDokumen = Tables<'legalitas_dokumen'>

export const DEFAULT_LEGALITAS_DOCS = [
  {
    jenis: 'NIB',
    judul: 'Nomor Induk Berusaha (NIB)',
    deskripsi: 'Dokumen legalitas utama dari OSS. Wajib untuk semua pengajuan KUR.',
    required: true,
  },
  {
    jenis: 'NPWP',
    judul: 'NPWP Pemilik / Usaha',
    deskripsi: 'Diperlukan untuk pinjaman di atas Rp 50 juta.',
    required: true,
  },
  {
    jenis: 'SKU',
    judul: 'Surat Keterangan Usaha (SKU)',
    deskripsi: 'Diterbitkan oleh Kelurahan / Kepala Desa setempat.',
    required: false,
  },
  {
    jenis: 'KTP',
    judul: 'KTP & KK Pemilik Usaha',
    deskripsi: 'Identitas kependudukan resmi pemohon pembiayaan.',
    required: true,
  },
]

export interface LegalitasSummary {
  total: number
  completed: number
  pct: number
  status: 'Lengkap' | 'Belum Lengkap' | 'Belum Ada Dokumen'
}

export function evaluateLegalitas(
  docs: LegalitasDokumen[]
): LegalitasSummary {
  const total = DEFAULT_LEGALITAS_DOCS.length
  // Hitung per jenis dokumen (bukan per baris) agar duplikat tidak melebihi 100%.
  const terisi = new Set(
    docs
      .filter((d) => d.nomor_dokumen || d.file_url)
      .map((d) => (d.kategori || '').toUpperCase())
  )
  const completed = DEFAULT_LEGALITAS_DOCS.filter((d) =>
    terisi.has(d.jenis)
  ).length
  const pct = Math.round((completed / total) * 100)

  let status: LegalitasSummary['status'] = 'Belum Ada Dokumen'
  if (pct === 100) status = 'Lengkap'
  else if (pct > 0) status = 'Belum Lengkap'

  return { total, completed, pct, status }
}


export type MasaBerlakuStatus =
  | { status: 'tidak-ada' }
  | { status: 'aktif'; sisaHari: number }
  | { status: 'segera-habis'; sisaHari: number }
  | { status: 'kedaluwarsa'; sisaHari: number }

export const AMBANG_REMINDER_HARI = 30

/** F16: reminder saat dokumen mendekati masa berlaku habis (default 30 hari). */
export function statusMasaBerlaku(
  masaBerlaku: string | null | undefined,
  hariIni: Date = new Date()
): MasaBerlakuStatus {
  if (!masaBerlaku) return { status: 'tidak-ada' }
  const [y, m, d] = masaBerlaku.split('-').map(Number)
  if (!y || !m || !d) return { status: 'tidak-ada' }
  const akhir = Date.UTC(y, m - 1, d)
  const awal = Date.UTC(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate())
  const sisaHari = Math.round((akhir - awal) / 86_400_000)
  if (sisaHari < 0) return { status: 'kedaluwarsa', sisaHari }
  if (sisaHari <= AMBANG_REMINDER_HARI) return { status: 'segera-habis', sisaHari }
  return { status: 'aktif', sisaHari }
}
