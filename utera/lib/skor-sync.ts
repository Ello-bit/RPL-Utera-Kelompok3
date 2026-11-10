import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { buildSkorSnapshot, calculateSkorPRD } from './skor'

type Tx = Database['public']['Tables']['transaksi_kas']['Row']

function localDay(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/**
 * PRD: setiap transaksi yang tersimpan memicu hitung ulang skor, lalu skor disimpan.
 * Satu snapshot per hari per usaha (diperbarui bila sudah ada hari ini) agar riwayat tidak membengkak.
 * Mengembalikan pesan error atau null.
 */
export async function syncSkorSnapshot(
  supabase: SupabaseClient<Database>,
  profilId: string
): Promise<string | null> {
  const { data: txs, error } = await supabase
    .from('transaksi_kas')
    .select('*')
    .eq('profil_id', profilId)
  if (error) return error.message

  const snap = buildSkorSnapshot(calculateSkorPRD((txs ?? []) as Tx[]))

  const { data: last } = await supabase
    .from('skor_kelayakan')
    .select('id, created_at')
    .eq('profil_id', profilId)
    .order('created_at', { ascending: false })
    .limit(1)

  const row = last?.[0]
  if (row && localDay(row.created_at) === localDay(null)) {
    const { error: upErr } = await supabase.from('skor_kelayakan').update(snap).eq('id', row.id)
    return upErr?.message ?? null
  }
  const { error: insErr } = await supabase
    .from('skor_kelayakan')
    .insert({ ...snap, profil_id: profilId })
  return insErr?.message ?? null
}
