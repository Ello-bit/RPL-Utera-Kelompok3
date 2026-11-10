import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from './database.types'

// Pengajuan verifikasi usaha disimpan di tabel Supabase `verifikasi_usaha`
// (lihat supabase/verifikasi.sql). Sebelumnya di localStorage, sehingga admin
// di browser lain tidak pernah melihat pengajuan pengguna.

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected'

export interface VerificationRequest {
  id: string
  businessId: string
  businessName: string
  ownerName: string
  phoneNumber: string
  businessSector: string
  applicationType: string
  notes: string
  hasNib: boolean
  nomorNib?: string
  totalTransactions: number
  skorPRD: number
  status: VerificationStatus
  submittedAt: string
  /** Waktu pengajuan lengkap (ISO), dipakai untuk mengurutkan antrean admin. */
  submittedAtIso: string
  reviewedAt?: string
  reviewedBy?: string
  /** Catatan dari admin saat mengesahkan atau menolak (opsional). */
  adminNote?: string
  certificateNumber?: string
}

type Client = SupabaseClient<Database>
type VerifikasiRow = Tables<'verifikasi_usaha'>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function rowToRequest(row: VerifikasiRow): VerificationRequest {
  return {
    id: row.id,
    businessId: row.profil_id,
    businessName: row.nama_usaha,
    ownerName: row.nama_pemilik || 'Pemilik Usaha',
    phoneNumber: row.nomor_telepon || '-',
    businessSector: row.jenis_usaha || '-',
    applicationType: row.jenis_pengajuan,
    notes: row.catatan || '',
    hasNib: row.punya_nib,
    nomorNib: row.nomor_nib || undefined,
    totalTransactions: row.total_transaksi,
    skorPRD: row.skor,
    status: row.status as VerificationStatus,
    submittedAt: row.diajukan_pada ? row.diajukan_pada.slice(0, 10) : '',
    submittedAtIso: row.diajukan_pada || '',
    reviewedAt: row.ditinjau_pada ? row.ditinjau_pada.slice(0, 10) : undefined,
    reviewedBy: row.ditinjau_oleh || undefined,
    adminNote: row.catatan_admin || row.alasan_penolakan || undefined,
    certificateNumber: row.nomor_sertifikat || undefined,
  }
}

/** Pengajuan milik satu usaha (pemilik), atau null bila belum pernah mengajukan. */
export async function fetchVerificationByProfil(
  supabase: Client,
  profilId: string
): Promise<VerificationRequest | null> {
  if (!UUID_RE.test(profilId)) return null
  const { data, error } = await supabase
    .from('verifikasi_usaha')
    .select('*')
    .eq('profil_id', profilId)
    .maybeSingle()
  if (error) {
    console.error('Gagal memuat status verifikasi:', error.message)
    return null
  }
  return data ? rowToRequest(data) : null
}

/** Semua pengajuan (admin). Pengguna biasa hanya mendapat miliknya sendiri karena RLS. */
export async function fetchAllVerifications(
  supabase: Client
): Promise<{ data: VerificationRequest[]; error: string | null }> {
  const { data, error } = await supabase
    .from('verifikasi_usaha')
    .select('*')
    .order('diajukan_pada', { ascending: false })
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []).map(rowToRequest), error: null }
}

export async function submitVerificationRequest(
  supabase: Client,
  data: {
    businessId: string
    businessName: string
    ownerName: string
    phoneNumber: string
    businessSector: string
    applicationType: string
    notes: string
    hasNib: boolean
    nomorNib?: string
    totalTransactions: number
    skorPRD: number
  }
): Promise<{ record: VerificationRequest | null; error: string | null }> {
  if (!UUID_RE.test(data.businessId)) {
    return { record: null, error: 'Simpan profil usaha terlebih dahulu sebelum mengajukan verifikasi.' }
  }

  // Aturan: satu usaha hanya boleh punya satu pengajuan aktif. Selama masih 'pending' atau
  // sudah 'verified' tidak bisa mengajukan lagi; baru boleh ajukan ulang setelah ditolak.
  const existing = await fetchVerificationByProfil(supabase, data.businessId)
  if (!canSubmitVerification(existing?.status)) {
    return {
      record: null,
      error:
        existing?.status === 'verified'
          ? 'Usaha ini sudah terverifikasi, tidak perlu mengajukan lagi.'
          : 'Pengajuan Anda masih menunggu tinjauan admin. Anda bisa mengajukan lagi hanya jika ditolak.',
    }
  }

  const payload = {
    nama_usaha: data.businessName,
    nama_pemilik: data.ownerName || null,
    nomor_telepon: data.phoneNumber || null,
    jenis_usaha: data.businessSector || null,
    jenis_pengajuan: data.applicationType || 'Verifikasi Kredibilitas Lengkap (Siap KUR)',
    catatan: data.notes || null,
    punya_nib: data.hasNib,
    nomor_nib: data.hasNib ? data.nomorNib || null : null,
    total_transaksi: data.totalTransactions,
    skor: data.skorPRD,
    status: 'pending',
    alasan_penolakan: null,
    catatan_admin: null,
    nomor_sertifikat: null,
    ditinjau_oleh: null,
    ditinjau_pada: null,
    diajukan_pada: new Date().toISOString(),
  }

  const query = existing
    ? supabase.from('verifikasi_usaha').update(payload).eq('profil_id', data.businessId)
    : supabase.from('verifikasi_usaha').insert({ ...payload, profil_id: data.businessId })

  const { data: row, error } = await query.select().single()
  if (error) {
    // Dua klik bersamaan: baris kedua ditolak oleh UNIQUE(profil_id) / RLS.
    const duplicate = error.code === '23505' || /row-level security/i.test(error.message)
    return {
      record: null,
      error: duplicate
        ? 'Pengajuan untuk usaha ini sudah ada dan masih diproses.'
        : error.message,
    }
  }
  return { record: rowToRequest(row), error: null }
}

/** Satu pengajuan per usaha: boleh mengajukan bila belum pernah, ditolak, atau ditangguhkan admin. */
export function canSubmitVerification(status: VerificationStatus | undefined | null): boolean {
  return !status || status === 'rejected' || status === 'unverified'
}

/**
 * Keputusan admin atas pengajuan yang masih 'pending': hanya 'verified' (sahkan) atau
 * 'rejected' (tolak), keduanya boleh disertai catatan yang dilihat pemilik usaha.
 */
export async function reviewVerification(
  supabase: Client,
  businessId: string,
  decision: 'verified' | 'rejected',
  options?: {
    note?: string
    certificateNumber?: string
    reviewedBy?: string
  }
): Promise<{ record: VerificationRequest | null; error: string | null }> {
  if (!UUID_RE.test(businessId)) {
    // Baris contoh (mock) di halaman admin tidak punya pengajuan di database.
    return { record: null, error: null }
  }

  const note = options?.note?.trim() || null
  const { data, error } = await supabase
    .from('verifikasi_usaha')
    .update({
      status: decision,
      ditinjau_pada: new Date().toISOString(),
      ditinjau_oleh: options?.reviewedBy || 'Super Administrator UTERA',
      catatan_admin: note,
      alasan_penolakan: decision === 'rejected' ? note : null,
      nomor_sertifikat: decision === 'verified' ? options?.certificateNumber || null : null,
    })
    .or(`profil_id.eq.${businessId},id.eq.${businessId}`)
    .eq('status', 'pending')
    .select()

  if (error) return { record: null, error: error.message }
  if (!data || data.length === 0) {
    return {
      record: null,
      error: 'Pengajuan tidak ditemukan, sudah ditinjau, atau akun ini bukan admin.',
    }
  }
  return { record: rowToRequest(data[0]), error: null }
}
