import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Foto profil usaha disimpan di Supabase Storage (bucket "foto-usaha", lihat supabase/foto-profil.sql).
// Path: <id pengguna>/<id profil>-<waktu>.<ekstensi>, sehingga aturan Storage bisa membatasi
// setiap pengguna hanya menulis ke foldernya sendiri.

export const FOTO_BUCKET = 'foto-usaha'
export const FOTO_MAKS_BYTE = 2 * 1024 * 1024 // 2 MB, sama dengan batas bucket
export const FOTO_TIPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/** Cek file sebelum diunggah; null bila valid, atau pesan kesalahan untuk pengguna. */
export function validasiFoto(file: { type: string; size: number }): string | null {
  if (!FOTO_TIPE[file.type]) return 'Format foto harus JPG, PNG, atau WebP.'
  if (file.size <= 0) return 'File foto kosong.'
  if (file.size > FOTO_MAKS_BYTE) return 'Ukuran foto maksimal 2 MB.'
  return null
}

/** Ambil path di bucket dari alamat publik foto (untuk menghapus foto lama). */
export function pathDariUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const penanda = `/object/public/${FOTO_BUCKET}/`
  const i = url.indexOf(penanda)
  return i < 0 ? null : decodeURIComponent(url.slice(i + penanda.length).split('?')[0])
}

type Client = SupabaseClient<Database>

export async function unggahFotoUsaha(
  supabase: Client,
  params: { userId: string; profilId: string; file: File; fotoLama?: string | null }
): Promise<{ url: string | null; error: string | null }> {
  const salah = validasiFoto(params.file)
  if (salah) return { url: null, error: salah }

  const ext = FOTO_TIPE[params.file.type]
  const path = `${params.userId}/${params.profilId}-${Date.now()}.${ext}`
  const { error: upErr } = await supabase.storage
    .from(FOTO_BUCKET)
    .upload(path, params.file, { contentType: params.file.type, upsert: false, cacheControl: '3600' })
  if (upErr) {
    const msg = /bucket not found/i.test(upErr.message)
      ? 'Penyimpanan foto belum disiapkan. Jalankan supabase/foto-profil.sql di Supabase.'
      : upErr.message
    return { url: null, error: msg }
  }

  const url = supabase.storage.from(FOTO_BUCKET).getPublicUrl(path).data.publicUrl
  const { error: dbErr } = await supabase.from('profil_usaha').update({ foto_url: url }).eq('id', params.profilId)
  if (dbErr) {
    // Jangan tinggalkan file yatim bila profil gagal diperbarui
    await supabase.storage.from(FOTO_BUCKET).remove([path])
    const msg = /foto_url/.test(dbErr.message)
      ? 'Kolom foto belum ada. Jalankan supabase/foto-profil.sql di Supabase.'
      : dbErr.message
    return { url: null, error: msg }
  }

  const lama = pathDariUrl(params.fotoLama)
  if (lama) await supabase.storage.from(FOTO_BUCKET).remove([lama])
  return { url, error: null }
}

export async function hapusFotoUsaha(
  supabase: Client,
  params: { profilId: string; fotoUrl: string | null | undefined }
): Promise<string | null> {
  const { error } = await supabase.from('profil_usaha').update({ foto_url: null }).eq('id', params.profilId)
  if (error) return error.message
  const path = pathDariUrl(params.fotoUrl)
  if (path) await supabase.storage.from(FOTO_BUCKET).remove([path])
  return null
}
