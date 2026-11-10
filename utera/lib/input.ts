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
