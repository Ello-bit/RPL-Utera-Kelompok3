import { describe, it, expect } from 'vitest'
import { canSubmitVerification } from '../lib/verification'
import { sortUmkm, filterByStatus, countByStatus, type SortableUmkm } from '../lib/admin-sort'

describe('Aturan satu pengajuan per usaha', () => {
  it('VER-R1 belum pernah mengajukan boleh', () => {
    expect(canSubmitVerification(undefined)).toBe(true)
    expect(canSubmitVerification(null)).toBe(true)
  })
  it('VER-R2 sedang menunggu tinjauan tidak boleh mengajukan lagi', () => {
    expect(canSubmitVerification('pending')).toBe(false)
  })
  it('VER-R3 sudah terverifikasi tidak boleh mengajukan lagi', () => {
    expect(canSubmitVerification('verified')).toBe(false)
  })
  it('VER-R4 ditolak boleh mengajukan ulang', () => {
    expect(canSubmitVerification('rejected')).toBe(true)
  })
  it('VER-R5 ditangguhkan admin boleh mengajukan lagi', () => {
    expect(canSubmitVerification('unverified')).toBe(true)
  })
})

describe('Antrean admin: urutan dan filter', () => {
  const data: SortableUmkm[] = [
    { namaUsaha: 'Cemara', skor: 50, verificationStatus: 'pending', submittedAtIso: '2026-11-10T08:00:00Z' },
    { namaUsaha: 'Anggrek', skor: 80, verificationStatus: 'pending', submittedAtIso: '2026-11-10T10:00:00Z' },
    { namaUsaha: 'Bakso', skor: 65, verificationStatus: 'unverified' },
    { namaUsaha: 'Dahlia', skor: 90, verificationStatus: 'rejected', submittedAtIso: '2026-11-09T09:00:00Z' },
  ]
  const names = (l: SortableUmkm[]) => l.map((x) => x.namaUsaha)

  it('ADM-01 terbaru: pengajuan paling baru di paling atas, yang belum mengajukan di bawah', () => {
    expect(names(sortUmkm(data, 'terbaru'))).toEqual(['Anggrek', 'Cemara', 'Dahlia', 'Bakso'])
  })
  it('ADM-02 terlama: pengajuan paling lama di atas, yang belum mengajukan tetap di bawah', () => {
    expect(names(sortUmkm(data, 'terlama'))).toEqual(['Dahlia', 'Cemara', 'Anggrek', 'Bakso'])
  })
  it('ADM-03 skor dan nama', () => {
    expect(names(sortUmkm(data, 'skor-tertinggi'))[0]).toBe('Dahlia')
    expect(names(sortUmkm(data, 'skor-terendah'))[0]).toBe('Cemara')
    expect(names(sortUmkm(data, 'nama'))).toEqual(['Anggrek', 'Bakso', 'Cemara', 'Dahlia'])
  })
  it('ADM-04 filter status dan hitungan', () => {
    expect(names(filterByStatus(data, 'pending'))).toEqual(['Cemara', 'Anggrek'])
    expect(filterByStatus(data, 'ALL').length).toBe(4)
    expect(countByStatus(data)).toMatchObject({ ALL: 4, pending: 2, rejected: 1, unverified: 1, verified: 0 })
  })
  it('ADM-05 tidak mengubah array asli', () => {
    const before = names(data)
    sortUmkm(data, 'nama')
    expect(names(data)).toEqual(before)
  })
})
