import Link from 'next/link'
import './banner-kas-kosong.css'

interface BannerKasKosongProps {
  /** Satu kalimat pendek tambahan, misalnya apa yang masih bisa dilakukan tanpa catatan kas */
  keterangan?: string
}

/**
 * Pesan seragam saat usaha belum punya catatan kas. Dipakai di Dashboard, Simulasi KUR,
 * Batas Aman Cicilan, dan Pinjaman Koperasi, supaya isi dan tampilannya sama di semua halaman.
 */
export default function BannerKasKosong({ keterangan }: BannerKasKosongProps) {
  return (
    <div className="banner-kas-kosong" role="status">
      <span className="bkk-ikon" aria-hidden="true">
        <span className="material-symbols-rounded">info</span>
      </span>
      <div className="bkk-teks">
        <strong>Belum ada catatan kas</strong>
        {keterangan && <span>{keterangan}</span>}
      </div>
      <Link href="/buku-kas" className="btn btn-primary btn-sm bkk-tombol">
        Mulai Catat
      </Link>
    </div>
  )
}
