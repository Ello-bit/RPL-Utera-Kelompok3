import { describe, it, expect } from 'vitest'
import { evaluateLegalitas } from '../lib/legalitas'
import type { LegalitasDokumen } from '../lib/legalitas'

function doc(kategori: string, nomor: string | null): LegalitasDokumen {
  return {
    id: kategori + nomor,
    user_id: 'u',
    profil_id: 'p',
    kategori,
    nama_dokumen: kategori,
    nomor_dokumen: nomor,
    tanggal_terbit: null,
    masa_berlaku: null,
    file_url: null,
    created_at: null,
  } as unknown as LegalitasDokumen
}

describe('F14 status legalitas', () => {
  it('LEG-01 tanpa dokumen', () => {
    expect(evaluateLegalitas([]).status).toBe('Belum Ada Dokumen')
  })
  it('LEG-02 semua 4 jenis terisi = 100% Lengkap', () => {
    const r = evaluateLegalitas(['NIB', 'NPWP', 'SKU', 'KTP'].map((k) => doc(k, '123')))
    expect(r.pct).toBe(100)
    expect(r.status).toBe('Lengkap')
  })
  it('LEG-03 baris duplikat satu jenis tidak boleh melebihi 100%', () => {
    const r = evaluateLegalitas(Array.from({ length: 6 }, () => doc('NIB', '1')))
    expect(r.pct).toBe(25)
  })
})

import { statusMasaBerlaku } from '../lib/legalitas'

describe('F16 reminder masa berlaku', () => {
  const hari = new Date(2026, 10, 10)
  it('LEG-04 tanpa tanggal', () => {
    expect(statusMasaBerlaku(null, hari).status).toBe('tidak-ada')
  })
  it('LEG-05 lewat tanggal = kedaluwarsa', () => {
    expect(statusMasaBerlaku('2026-11-09', hari)).toEqual({ status: 'kedaluwarsa', sisaHari: -1 })
  })
  it('LEG-06 hari ini sampai 30 hari = segera habis', () => {
    expect(statusMasaBerlaku('2026-11-10', hari).status).toBe('segera-habis')
    expect(statusMasaBerlaku('2026-12-10', hari).status).toBe('segera-habis')
  })
  it('LEG-07 lebih dari 30 hari = aktif', () => {
    expect(statusMasaBerlaku('2026-12-11', hari).status).toBe('aktif')
  })
})
