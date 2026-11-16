import type { VerificationRequest } from './verification'

// Notifikasi lonceng yang dibuat dari tabel verifikasi_usaha:
// - pemilik usaha: hasil tinjauan admin (diterima / ditolak)
// - admin: jumlah pengajuan yang masih menunggu ditinjau
// Tidak perlu tabel baru; datanya sudah ada di verifikasi_usaha (lihat supabase/verifikasi.sql).

export const PREFIX_NOTIF_VERIFIKASI = 'verif-'

export interface NotifikasiVerifikasi {
  /** Berubah bila ada keputusan/antrean baru, sehingga muncul lagi sebagai belum dibaca. */
  id: string
  title: string
  desc: string
  category: string
  fullMessage: string
  recommendation: string
  /** Waktu kejadian (ISO): waktu ditinjau, atau waktu pengajuan terbaru untuk admin. */
  timeIso: string
  icon: string
  iconBg: string
  iconColor: string
  href: string
  actionLabel: string
  urgent: boolean
}

/** Notifikasi hasil verifikasi untuk pemilik usaha (satu per usaha yang sudah ditinjau). */
export function notifHasilVerifikasi(list: VerificationRequest[]): NotifikasiVerifikasi[] {
  return list
    .filter((v) => (v.status === 'verified' || v.status === 'rejected') && v.reviewedAtIso)
    .map((v) => {
      const peninjau = v.reviewedBy || 'Admin UTERA'
      const catatan = v.adminNote ? ` Catatan admin: "${v.adminNote}".` : ''
      const base = {
        id: `${PREFIX_NOTIF_VERIFIKASI}${v.id}-${v.reviewedAtIso}`,
        category: 'Verifikasi Usaha',
        timeIso: v.reviewedAtIso as string,
        href: '/profil-usaha',
      }
      if (v.status === 'verified') {
        const sertifikat = v.certificateNumber ? ` dengan nomor sertifikat ${v.certificateNumber}` : ''
        return {
          ...base,
          title: 'Verifikasi usaha diterima',
          desc: `${v.businessName} sudah terverifikasi oleh admin UTERA.`,
          fullMessage: `Pengajuan verifikasi ${v.businessName} sudah diperiksa oleh ${peninjau} dan dinyatakan terverifikasi${sertifikat}.${catatan}`,
          recommendation:
            'Usaha yang terverifikasi lebih dipercaya saat mengajukan KUR. Lanjutkan dengan mencatat kas secara rutin dan siapkan Laporan Siap Bank.',
          icon: 'verified',
          iconBg: '#EEF7F2',
          iconColor: '#1F6B4F',
          actionLabel: 'Lihat Status Verifikasi',
          urgent: false,
        }
      }
      return {
        ...base,
        title: 'Verifikasi usaha ditolak',
        desc: v.adminNote
          ? `${v.businessName}: ${v.adminNote}`
          : `${v.businessName} perlu diperbaiki sebelum diajukan ulang.`,
        fullMessage: `Pengajuan verifikasi ${v.businessName} sudah diperiksa oleh ${peninjau}, tetapi belum bisa diterima.${catatan}`,
        recommendation:
          'Perbaiki data sesuai catatan admin, misalnya lengkapi profil, NIB, dan catatan kas, lalu ajukan verifikasi ulang dari halaman Profil Usaha.',
        icon: 'error',
        iconBg: '#FEF2F2',
        iconColor: '#B5532F',
        actionLabel: 'Perbaiki & Ajukan Ulang',
        urgent: true,
      }
    })
}

/** Notifikasi untuk admin: ringkasan pengajuan yang masih menunggu, atau null bila tidak ada. */
export function notifAntreanAdmin(list: VerificationRequest[]): NotifikasiVerifikasi | null {
  const menunggu = list
    .filter((v) => v.status === 'pending')
    .sort((a, b) => b.submittedAtIso.localeCompare(a.submittedAtIso))
  if (menunggu.length === 0) return null

  const terbaru = menunggu[0]
  const nama = menunggu.slice(0, 2).map((v) => v.businessName).join(', ')
  const lainnya = menunggu.length > 2 ? ` dan ${menunggu.length - 2} lainnya` : ''
  return {
    // Id berubah saat jumlah atau pengajuan terbaru berubah, jadi pengajuan baru muncul lagi
    id: `${PREFIX_NOTIF_VERIFIKASI}antrean-${menunggu.length}-${terbaru.submittedAtIso}`,
    title: `${menunggu.length} pengajuan verifikasi menunggu`,
    desc: `${nama}${lainnya} menunggu untuk ditinjau.`,
    category: 'Verifikasi Usaha',
    fullMessage: `Ada ${menunggu.length} usaha yang mengajukan verifikasi dan belum ditinjau: ${nama}${lainnya}. Pengajuan terbaru dari ${terbaru.businessName}.`,
    recommendation: 'Buka Direktori UMKM, periksa data dan catatan kas tiap usaha, lalu terima atau tolak pengajuannya.',
    timeIso: terbaru.submittedAtIso,
    icon: 'pending_actions',
    iconBg: '#FEF7EC',
    iconColor: '#C98A1B',
    href: '/admin?tab=direktori',
    actionLabel: 'Tinjau Pengajuan',
    urgent: true,
  }
}
