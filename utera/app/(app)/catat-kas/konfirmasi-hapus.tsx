'use client'

import { useEffect } from 'react'
import { formatRupiah } from '@/lib/kas'
import './catat-kas-form.css'

interface KonfirmasiHapusProps {
  tx: { tanggal: string | null; keterangan: string | null; kategori: string; nominal: number | string; tipe: string }
  menghapus: boolean
  onBatal: () => void
  onHapus: () => void
  /** Judul dan pesan kotak; bawaannya untuk menghapus transaksi kas */
  judul?: string
  pesan?: string
  /** Teks nilai di kanan rincian; bila diisi, menggantikan nominal berawalan + atau − */
  nilai?: string
}

/**
 * Kotak konfirmasi hapus transaksi buatan aplikasi. Sebelumnya memakai window.confirm(), yang bisa
 * diblokir browser sehingga tombol hapus terlihat tidak bereaksi. Kotak ini juga menampilkan
 * transaksi yang akan dihapus, supaya tidak salah baris.
 */
export default function KonfirmasiHapus({
  tx,
  menghapus,
  onBatal,
  onHapus,
  judul = 'Hapus transaksi ini?',
  pesan = 'Transaksi akan dihapus permanen dan tidak bisa dikembalikan. Skor kelayakan ikut dihitung ulang.',
  nilai,
}: KonfirmasiHapusProps) {
  useEffect(() => {
    const tutup = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !menghapus) onBatal()
    }
    window.addEventListener('keydown', tutup)
    return () => window.removeEventListener('keydown', tutup)
  }, [menghapus, onBatal])

  const masuk = tx.tipe === 'pemasukan'

  return (
    <div className="catat-kas-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !menghapus && onBatal()}>
      <div className="konfirmasi-hapus" role="alertdialog" aria-modal="true" aria-labelledby="hapus-judul">
        <span className="konfirmasi-hapus-ikon" aria-hidden="true">
          <span className="material-symbols-rounded">delete</span>
        </span>
        <h3 id="hapus-judul">{judul}</h3>
        <p>{pesan}</p>

        <div className="konfirmasi-hapus-ringkas">
          <div>
            <strong>{tx.keterangan || tx.kategori}</strong>
            <span>{tx.keterangan ? `${tx.tanggal} · ${tx.kategori}` : tx.tanggal}</span>
          </div>
          {nilai ? (
            <b className="netral">{nilai}</b>
          ) : (
            <b className={masuk ? 'masuk' : 'keluar'}>
              {masuk ? '+' : '−'} {formatRupiah(Number(tx.nominal))}
            </b>
          )}
        </div>

        <div className="konfirmasi-hapus-aksi">
          <button type="button" className="konfirmasi-batal" autoFocus disabled={menghapus} onClick={onBatal}>
            Batal
          </button>
          <button type="button" className="konfirmasi-ya" disabled={menghapus} onClick={onHapus}>
            {menghapus ? 'Menghapus…' : 'Ya, Hapus'}
          </button>
        </div>
      </div>
    </div>
  )
}
