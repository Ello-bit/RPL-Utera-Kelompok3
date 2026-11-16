import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { syncSkorSnapshot } from './skor-sync'

/**
 * Hapus satu transaksi kas, lalu hitung ulang skor kelayakan usahanya (aturan PRD: setiap
 * perubahan transaksi memicu hitung ulang skor).
 * Mengembalikan pesan error, atau null bila berhasil.
 *
 * Kalau tidak ada baris yang terhapus (sudah dihapus, atau bukan milik akun ini karena RLS),
 * dianggap gagal supaya pengguna tidak mengira transaksinya hilang padahal masih ada.
 */
export async function hapusTransaksi(
  supabase: SupabaseClient<Database>,
  tx: { id: string; profil_id: string | null }
): Promise<string | null> {
  const { data, error } = await supabase.from('transaksi_kas').delete().eq('id', tx.id).select('id')
  if (error) return error.message
  if (!data || data.length === 0) return 'Transaksi tidak ditemukan atau sudah dihapus.'

  if (tx.profil_id) {
    const err = await syncSkorSnapshot(supabase, tx.profil_id)
    if (err) console.error('Gagal menyimpan skor kelayakan:', err)
  }
  return null
}
