import { describe, it, expect, vi, beforeEach } from 'vitest'

const syncSkorSnapshot = vi.fn()
vi.mock('../lib/skor-sync', () => ({ syncSkorSnapshot: (...a: unknown[]) => syncSkorSnapshot(...a) }))

import { hapusTransaksi } from '../lib/hapus-transaksi'

// Klien Supabase tiruan: from().delete().eq().select() -> { data, error }
function klien(hasil: { data: { id: string }[] | null; error: { message: string } | null }) {
  const calls: { tabel?: string; kolom?: string; nilai?: string } = {}
  const supabase = {
    from(tabel: string) {
      calls.tabel = tabel
      return {
        delete: () => ({
          eq: (kolom: string, nilai: string) => {
            calls.kolom = kolom
            calls.nilai = nilai
            return { select: () => Promise.resolve(hasil) }
          },
        }),
      }
    },
  }
  return { supabase: supabase as never, calls }
}

describe('Hapus transaksi kas', () => {
  beforeEach(() => {
    syncSkorSnapshot.mockReset()
    syncSkorSnapshot.mockResolvedValue(null)
  })

  it('HT-01 berhasil: menghapus berdasarkan id lalu menghitung ulang skor usahanya', async () => {
    const { supabase, calls } = klien({ data: [{ id: 't1' }], error: null })
    const err = await hapusTransaksi(supabase, { id: 't1', profil_id: 'p1' })
    expect(err).toBeNull()
    expect(calls).toEqual({ tabel: 'transaksi_kas', kolom: 'id', nilai: 't1' })
    expect(syncSkorSnapshot).toHaveBeenCalledWith(supabase, 'p1')
  })

  it('HT-02 galat dari database: pesan dikembalikan dan skor tidak disentuh', async () => {
    const { supabase } = klien({ data: null, error: { message: 'izin ditolak' } })
    expect(await hapusTransaksi(supabase, { id: 't1', profil_id: 'p1' })).toBe('izin ditolak')
    expect(syncSkorSnapshot).not.toHaveBeenCalled()
  })

  it('HT-03 tidak ada baris yang terhapus (sudah hilang atau bukan milik akun): dianggap gagal', async () => {
    const { supabase } = klien({ data: [], error: null })
    const err = await hapusTransaksi(supabase, { id: 't1', profil_id: 'p1' })
    expect(err).toContain('tidak ditemukan')
    expect(syncSkorSnapshot).not.toHaveBeenCalled()
  })

  it('HT-04 transaksi tanpa usaha: tetap terhapus, tanpa hitung ulang skor', async () => {
    const { supabase } = klien({ data: [{ id: 't1' }], error: null })
    expect(await hapusTransaksi(supabase, { id: 't1', profil_id: null })).toBeNull()
    expect(syncSkorSnapshot).not.toHaveBeenCalled()
  })

  it('HT-05 gagal menyimpan ulang skor tidak membatalkan penghapusan', async () => {
    syncSkorSnapshot.mockResolvedValue('gagal simpan skor')
    const { supabase } = klien({ data: [{ id: 't1' }], error: null })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await hapusTransaksi(supabase, { id: 't1', profil_id: 'p1' })).toBeNull()
    spy.mockRestore()
  })
})
