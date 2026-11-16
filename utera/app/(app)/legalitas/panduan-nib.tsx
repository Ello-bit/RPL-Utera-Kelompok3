const SIAPKAN = [
  'KTP pemilik usaha',
  'NPWP pemilik usaha',
  'Alamat email aktif dan nomor HP',
  'Data usaha: nama usaha, alamat lengkap, jenis kegiatan usaha, dan perkiraan modal',
]

const LANGKAH = [
  {
    judul: 'Buka situs OSS dan buat akun',
    isi: 'Buka oss.go.id, pilih Daftar, lalu pilih jenis pelaku usaha "Perseorangan" untuk usaha milik pribadi.',
  },
  {
    judul: 'Isi data diri pemilik',
    isi: 'Isi sesuai KTP, lalu verifikasi email Anda dan masuk ke akun OSS.',
  },
  {
    judul: 'Lengkapi data usaha',
    isi: 'Isi nama dan alamat usaha, pilih jenis kegiatan usaha (kodenya disebut KBLI, bisa dicari dengan mengetik kata kunci seperti "warung" atau "kedai kopi"), lalu isi perkiraan modal.',
  },
  {
    judul: 'Periksa tingkat risiko usaha',
    isi: 'Sistem akan menentukan tingkat risiko usaha Anda. Untuk warung dan usaha kecil, umumnya risikonya rendah dan NIB sudah cukup.',
  },
  {
    judul: 'Simpan dan unduh NIB',
    isi: 'Setujui pernyataan, simpan data, lalu unduh NIB dalam bentuk PDF. Nomor NIB tertera di dokumen itu.',
  },
  {
    judul: 'Daftarkan nomornya di UTERA',
    isi: 'Kembali ke halaman ini, tekan "Daftarkan Nomor Dokumen" pada kartu NIB, lalu isi nomor dan tanggal terbitnya. Nomor ini akan dipakai otomatis untuk cek kelayakan KUR dan Laporan Siap Bank.',
  },
]

/** Panduan singkat mengurus NIB lewat OSS. Terbuka otomatis bila NIB belum terdaftar. */
export default function PanduanNib({ defaultOpen }: { defaultOpen: boolean }) {
  return (
    <details className="nib-guide" open={defaultOpen}>
      <summary className="nib-guide-summary">
        <span className="nib-guide-icon" aria-hidden="true">
          <span className="material-symbols-rounded">menu_book</span>
        </span>
        <span className="nib-guide-heading">
          <strong>Cara Mengurus NIB</strong>
          <span>Diurus sendiri secara online lewat OSS dan tidak dipungut biaya</span>
        </span>
        <span className="nib-guide-chevron" aria-hidden="true">
          <span className="material-symbols-rounded">expand_more</span>
        </span>
      </summary>

      <div className="nib-guide-body">
        <div className="nib-guide-prep">
          <h3>Siapkan dulu</h3>
          <ul>
            {SIAPKAN.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>

        <ol className="nib-guide-steps">
          {LANGKAH.map((l) => (
            <li key={l.judul}>
              <strong>{l.judul}</strong>
              <p>{l.isi}</p>
            </li>
          ))}
        </ol>

        <div className="nib-guide-actions">
          <a href="https://oss.go.id" target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
            <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
              open_in_new
            </span>
            <span>Buka Situs OSS</span>
          </a>
        </div>

        <p className="nib-guide-note">
          <strong>Belum sempat mengurus NIB?</strong> Surat Keterangan Usaha (SKU) dari kelurahan atau desa juga
          dipakai UTERA untuk pengecekan awal, tetapi bank tetap bisa meminta NIB. Tampilan situs OSS dapat berubah;
          jika ragu, tanyakan ke dinas koperasi dan UMKM atau kelurahan setempat.
        </p>
      </div>
    </details>
  )
}
