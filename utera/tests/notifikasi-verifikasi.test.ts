import { describe, it, expect } from 'vitest'
import { notifHasilVerifikasi, notifAntreanAdmin } from '../lib/notifikasi-verifikasi'
import type { VerificationRequest } from '../lib/verification'

function req(over: Partial<VerificationRequest>): VerificationRequest {
  return {
    id: 'v1',
    businessId: 'p1',
    businessName: 'Kopi Nusantara',
    ownerName: 'Budi',
    phoneNumber: '-',
    businessSector: 'Kuliner',
    applicationType: 'Verifikasi Usaha',
    notes: '',
    hasNib: true,
    totalTransactions: 10,
    skorPRD: 80,
    status: 'pending',
    submittedAt: '2026-11-10',
    submittedAtIso: '2026-11-10T08:00:00Z',
    ...over,
  }
}

describe('Notifikasi hasil verifikasi untuk pemilik usaha', () => {
  it('NV-01 pengajuan yang belum ditinjau tidak menghasilkan notifikasi', () => {
    expect(notifHasilVerifikasi([req({ status: 'pending' })])).toEqual([])
  })

  it('NV-02 diterima: judul, nomor sertifikat, dan waktu dari waktu ditinjau', () => {
    const [n] = notifHasilVerifikasi([
      req({ status: 'verified', reviewedAtIso: '2026-11-12T09:00:00Z', certificateNumber: 'UTR-001' }),
    ])
    expect(n.title).toBe('Verifikasi usaha diterima')
    expect(n.fullMessage).toContain('UTR-001')
    expect(n.timeIso).toBe('2026-11-12T09:00:00Z')
    expect(n.urgent).toBe(false)
  })

  it('NV-03 ditolak: catatan admin ikut tampil dan ditandai penting', () => {
    const [n] = notifHasilVerifikasi([
      req({ status: 'rejected', reviewedAtIso: '2026-11-12T09:00:00Z', adminNote: 'Lengkapi NIB' }),
    ])
    expect(n.title).toBe('Verifikasi usaha ditolak')
    expect(n.desc).toContain('Lengkapi NIB')
    expect(n.urgent).toBe(true)
    expect(n.href).toBe('/profil-usaha')
  })

  it('NV-04 keputusan baru (waktu tinjau berbeda) menghasilkan id baru', () => {
    const a = notifHasilVerifikasi([req({ status: 'rejected', reviewedAtIso: '2026-11-12T09:00:00Z' })])[0]
    const b = notifHasilVerifikasi([req({ status: 'verified', reviewedAtIso: '2026-11-14T09:00:00Z' })])[0]
    expect(a.id).not.toBe(b.id)
  })
})

describe('Notifikasi antrean verifikasi untuk admin', () => {
  it('NV-05 tidak ada pengajuan menunggu: tidak ada notifikasi', () => {
    expect(notifAntreanAdmin([req({ status: 'verified' })])).toBeNull()
  })

  it('NV-06 menghitung pengajuan menunggu dan memakai pengajuan terbaru sebagai waktu', () => {
    const n = notifAntreanAdmin([
      req({ id: 'a', businessName: 'A', submittedAtIso: '2026-11-10T08:00:00Z' }),
      req({ id: 'b', businessName: 'B', submittedAtIso: '2026-11-11T08:00:00Z' }),
      req({ id: 'c', businessName: 'C', submittedAtIso: '2026-11-09T08:00:00Z' }),
      req({ id: 'd', businessName: 'D', status: 'verified' }),
    ])!
    expect(n.title).toBe('3 pengajuan verifikasi menunggu')
    expect(n.timeIso).toBe('2026-11-11T08:00:00Z')
    expect(n.desc).toContain('B, A dan 1 lainnya')
  })

  it('NV-07 pengajuan baru masuk mengubah id, jadi muncul lagi sebagai belum dibaca', () => {
    const satu = notifAntreanAdmin([req({ id: 'a' })])!
    const dua = notifAntreanAdmin([req({ id: 'a' }), req({ id: 'b', submittedAtIso: '2026-11-11T08:00:00Z' })])!
    expect(satu.id).not.toBe(dua.id)
  })
})
