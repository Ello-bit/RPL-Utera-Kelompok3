import type { TransaksiKas } from '../lib/kas'

let seq = 0
export function tx(
  tipe: 'pemasukan' | 'pengeluaran',
  nominal: number,
  tanggal: string,
  kategori = 'Penjualan'
): TransaksiKas {
  seq++
  return {
    id: `t${seq}`,
    user_id: 'u',
    profil_id: 'p',
    tipe,
    nominal,
    kategori,
    tanggal,
    keterangan: null,
    metode_pembayaran: 'Tunai',
    created_at: null,
  } as unknown as TransaksiKas
}
