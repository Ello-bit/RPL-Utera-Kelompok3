import type { LegalitasDokumen } from './legalitas'
import { statusMasaBerlaku, AMBANG_REMINDER_HARI } from './legalitas'
import type { NotifikasiVerifikasi } from './notifikasi-verifikasi'

// Notifikasi lonceng untuk dokumen legalitas yang segera habis atau sudah kedaluwarsa.
// Datanya dari tabel legalitas_dokumen (kolom masa_berlaku), tanpa tabel baru.

export const PREFIX_NOTIF_LEGALITAS = 'legal-'

const HARI_MS = 86_400_000

/** "2026-11-17" -> "17 November 2026" (tanpa pergeseran zona waktu). */
function tanggalPanjang(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function sisaHariTeks(sisaHari: number): string {
  if (sisaHari === 0) return 'berakhir hari ini'
  if (sisaHari === 1) return 'tinggal 1 hari lagi'
  return `tinggal ${sisaHari} hari lagi`
}

/**
 * Satu notifikasi per dokumen yang masa berlakunya tinggal AMBANG_REMINDER_HARI hari atau sudah lewat.
 * Dokumen tanpa masa berlaku, atau yang masih lama, tidak menghasilkan notifikasi.
 * Id memuat status dan tanggal masa berlaku: pindah dari "segera habis" ke "kedaluwarsa", atau masa
 * berlaku diperbarui, menghasilkan notifikasi baru yang belum dibaca.
 */
export function notifDokumenKedaluwarsa(
  docs: LegalitasDokumen[],
  hariIni: Date = new Date()
): NotifikasiVerifikasi[] {
  const hasil: NotifikasiVerifikasi[] = []

  for (const doc of docs) {
    const mb = statusMasaBerlaku(doc.masa_berlaku, hariIni)
    if (mb.status !== 'segera-habis' && mb.status !== 'kedaluwarsa') continue
    // statusMasaBerlaku sudah memastikan masa_berlaku terisi dan valid
    const berlakuSampai = doc.masa_berlaku as string
    const nama = doc.nama_dokumen || doc.kategori
    const tanggal = tanggalPanjang(berlakuSampai)
    const [y, m, d] = berlakuSampai.split('-').map(Number)
    const akhir = new Date(y, m - 1, d).toISOString()

    if (mb.status === 'kedaluwarsa') {
      hasil.push({
        id: `${PREFIX_NOTIF_LEGALITAS}${doc.id}-kedaluwarsa-${berlakuSampai}`,
        title: `${nama} sudah kedaluwarsa`,
        desc: `Masa berlakunya berakhir pada ${tanggal}. Perbarui dokumen ini.`,
        category: 'Legalitas',
        fullMessage: `${nama} sudah melewati masa berlakunya sejak ${tanggal} (${Math.abs(mb.sisaHari)} hari yang lalu). Dokumen yang kedaluwarsa bisa membuat pengajuan KUR ditolak bank.`,
        recommendation:
          'Urus perpanjangan dokumen ini, lalu perbarui nomor dan masa berlakunya di halaman Legalitas & NIB.',
        // Kedaluwarsa: waktu kejadiannya adalah tanggal berakhirnya
        timeIso: akhir,
        icon: 'event_busy',
        iconBg: '#FEF2F2',
        iconColor: '#B5532F',
        href: '/legalitas',
        actionLabel: 'Perbarui Dokumen',
        urgent: true,
      })
      continue
    }

    // Segera habis: waktu kejadiannya saat pengingat mulai berlaku, tetapi tidak lebih awal dari
    // saat dokumen dicatat (supaya tidak terlihat seperti pesan lama untuk dokumen yang baru diisi).
    const mulaiPengingat = new Date(new Date(akhir).getTime() - AMBANG_REMINDER_HARI * HARI_MS).toISOString()
    const timeIso = doc.created_at && doc.created_at > mulaiPengingat ? doc.created_at : mulaiPengingat

    hasil.push({
      id: `${PREFIX_NOTIF_LEGALITAS}${doc.id}-segera-${berlakuSampai}`,
      title: `${nama} segera habis masa berlakunya`,
      desc: `Berlaku sampai ${tanggal}, ${sisaHariTeks(mb.sisaHari)}.`,
      category: 'Legalitas',
      fullMessage: `${nama} berlaku sampai ${tanggal}, ${sisaHariTeks(mb.sisaHari)}. Perpanjang sebelum habis supaya pengajuan KUR tidak terhambat.`,
      recommendation:
        'Urus perpanjangan dokumen ini, lalu perbarui masa berlakunya di halaman Legalitas & NIB.',
      timeIso,
      icon: 'schedule',
      iconBg: '#FEF7EC',
      iconColor: '#C98A1B',
      href: '/legalitas',
      actionLabel: 'Perbarui Dokumen',
      urgent: mb.sisaHari <= 7,
    })
  }

  // Kedaluwarsa di atas, lalu yang paling dekat berakhir
  return hasil.sort((a, b) => urutanDesak(a) - urutanDesak(b))
}

function urutanDesak(n: NotifikasiVerifikasi): number {
  // Kedaluwarsa dulu, lalu segera habis; antar sesama ikut urutan tanggal berakhir yang tertulis di id
  const kedaluwarsa = n.id.includes('-kedaluwarsa-') ? 0 : 1
  const tanggal = Number(n.id.slice(-10).replace(/-/g, ''))
  return kedaluwarsa * 1e9 + tanggal
}
