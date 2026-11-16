export type NominalResult = { value: number; error: null } | { value: null; error: string }

/** Validasi nominal rupiah: bilangan bulat > 0. "1.500.000" dan "Rp 1500000" diterima. */
export function parseNominal(raw: string): NominalResult {
  const s = String(raw ?? '').trim().replace(/^rp\.?\s*/i, '').replace(/\s/g, '')
  if (!s) return { value: null, error: 'Nominal wajib diisi.' }
  if (s.startsWith('-')) return { value: null, error: 'Nominal tidak boleh negatif.' }
  if (/[,]/.test(s) || /^\d+\.\d{1,2}$/.test(s)) {
    return { value: null, error: 'Isi nominal dengan angka bulat, tanpa koma atau desimal.' }
  }
  const digits = s.replace(/\./g, '')
  if (!/^\d+$/.test(digits)) return { value: null, error: 'Nominal hanya boleh berisi angka.' }
  const value = Number(digits)
  if (!Number.isSafeInteger(value) || value <= 0) {
    return { value: null, error: 'Nominal harus lebih dari 0.' }
  }
  return { value, error: null }
}

/** Tanggal hari ini (YYYY-MM-DD) menurut zona waktu perangkat, bukan UTC. */
export function todayLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Satu sel CSV: selalu di-quote agar koma, kutip, dan baris baru aman. */
export function csvCell(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

/** Tampilan angka dengan titik ribuan: "1500000" -> "1.500.000". Masukan hanya digit. */
export function formatRibuan(digits: string): string {
  return digits ? Number(digits).toLocaleString('id-ID') : ''
}

/**
 * Olah ketikan di kolom rupiah bertitik ribuan.
 * - `teks`: isi kolom setelah diketik (bisa berisi titik), `caret`: posisi kursor
 * - `digitLama`: angka sebelum diketik (tanpa titik)
 * - `jenis`: InputEvent.inputType, untuk menangani hapus tepat di atas titik
 * Hasil: angka tanpa titik dan berapa digit yang ada di kiri kursor (untuk menaruh kursor lagi).
 */
export function olahKetikanRupiah(
  teks: string,
  caret: number,
  digitLama: string,
  jenis?: string,
  maksDigit = 13
): { digits: string; digitDiKiriKursor: number } {
  let digits = teks.replace(/\D/g, '')
  let kiri = teks.slice(0, caret).replace(/\D/g, '').length

  // Menghapus tepat di atas titik: titik muncul lagi, jadi hapus digit di sebelahnya
  if (digits === digitLama && teks.length < formatRibuan(digitLama).length) {
    if (jenis === 'deleteContentBackward' && kiri > 0) {
      digits = digits.slice(0, kiri - 1) + digits.slice(kiri)
      kiri -= 1
    } else if (jenis === 'deleteContentForward') {
      digits = digits.slice(0, kiri) + digits.slice(kiri + 1)
    }
  }

  // Buang nol di depan ("007" -> "7") dan batasi panjang
  const tanpaNol = digits.replace(/^0+(?=\d)/, '')
  kiri = Math.max(0, kiri - (digits.length - tanpaNol.length))
  digits = tanpaNol.slice(0, maksDigit)
  return { digits, digitDiKiriKursor: Math.min(kiri, digits.length) }
}

/** Posisi kursor di teks bertitik setelah `n` digit pertama. */
export function posisiKursorRupiah(teksBertitik: string, n: number): number {
  let hitung = 0
  for (let i = 0; i < teksBertitik.length; i++) {
    if (hitung === n) return i
    if (/\d/.test(teksBertitik[i])) hitung++
  }
  return teksBertitik.length
}
