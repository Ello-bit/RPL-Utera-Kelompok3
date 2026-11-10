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
  const completed = docs.filter((d) => d.nomor_dokumen || d.file_url).length
  const pct = Math.round((completed / total) * 100)

  let status: LegalitasSummary['status'] = 'Belum Ada Dokumen'
  if (pct === 100) status = 'Lengkap'
  else if (pct > 0) status = 'Belum Lengkap'

  return { total, completed, pct, status }
}

