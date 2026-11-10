import type { VerificationStatus } from './verification'

export interface SortableUmkm {
  namaUsaha: string
  skor: number
  verificationStatus: VerificationStatus
  /** Waktu pengajuan verifikasi (ISO); kosong bila belum pernah mengajukan. */
  submittedAtIso?: string
}

export type UmkmSortKey = 'terbaru' | 'terlama' | 'skor-tertinggi' | 'skor-terendah' | 'nama'
export type UmkmStatusFilter = 'ALL' | VerificationStatus

export const SORT_OPTIONS: { value: UmkmSortKey; label: string }[] = [
  { value: 'terbaru', label: 'Pengajuan terbaru' },
  { value: 'terlama', label: 'Pengajuan terlama' },
  { value: 'skor-tertinggi', label: 'Skor tertinggi' },
  { value: 'skor-terendah', label: 'Skor terendah' },
  { value: 'nama', label: 'Nama usaha A-Z' },
]

function time(r: SortableUmkm): number {
  const t = r.submittedAtIso ? Date.parse(r.submittedAtIso) : NaN
  return Number.isNaN(t) ? 0 : t
}

/**
 * Urutan antrean admin. Pada 'terbaru'/'terlama' usaha yang belum pernah mengajukan
 * selalu di bawah, supaya pengajuan yang perlu ditinjau ada di atas.
 */
export function sortUmkm<T extends SortableUmkm>(list: T[], key: UmkmSortKey): T[] {
  const copy = [...list]
  switch (key) {
    case 'terbaru':
      return copy.sort((a, b) => {
        const ta = time(a)
        const tb = time(b)
        if (!ta && !tb) return a.namaUsaha.localeCompare(b.namaUsaha, 'id')
        if (!ta) return 1
        if (!tb) return -1
        return tb - ta
      })
    case 'terlama':
      return copy.sort((a, b) => {
        const ta = time(a)
        const tb = time(b)
        if (!ta && !tb) return a.namaUsaha.localeCompare(b.namaUsaha, 'id')
        if (!ta) return 1
        if (!tb) return -1
        return ta - tb
      })
    case 'skor-tertinggi':
      return copy.sort((a, b) => b.skor - a.skor)
    case 'skor-terendah':
      return copy.sort((a, b) => a.skor - b.skor)
    case 'nama':
      return copy.sort((a, b) => a.namaUsaha.localeCompare(b.namaUsaha, 'id'))
  }
}

export function filterByStatus<T extends SortableUmkm>(list: T[], status: UmkmStatusFilter): T[] {
  return status === 'ALL' ? list : list.filter((r) => r.verificationStatus === status)
}

export function countByStatus<T extends SortableUmkm>(list: T[]): Record<UmkmStatusFilter, number> {
  const counts: Record<UmkmStatusFilter, number> = {
    ALL: list.length,
    pending: 0,
    verified: 0,
    rejected: 0,
    unverified: 0,
  }
  list.forEach((r) => {
    counts[r.verificationStatus]++
  })
  return counts
}

/** "10 Nov 2026, 14.30" menurut zona waktu perangkat. */
export function formatWaktuPengajuan(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
