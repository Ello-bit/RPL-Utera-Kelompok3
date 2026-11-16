import { describe, it, expect } from 'vitest'
import { notifDokumenKedaluwarsa } from '../lib/notifikasi-legalitas'
import type { LegalitasDokumen } from '../lib/legalitas'

// Tanggal acuan: 16 November 2026
const HARI_INI = new Date(2026, 10, 16)

function doc(over: Partial<LegalitasDokumen>): LegalitasDokumen {
  return {
    id: 'd1',
    user_id: 'u1',
    profil_id: 'p1',
    kategori: 'NIB',
    nama_dokumen: 'Nomor Induk Berusaha (NIB)',
    nomor_dokumen: '123',
    tanggal_terbit: null,
    masa_berlaku: null,
    file_url: null,
    created_at: '2026-10-01T00:00:00Z',
    ...over,
  }
}

describe('Notifikasi dokumen legalitas hampir kedaluwarsa', () => {
  it('NL-01 tanpa masa berlaku: tidak ada notifikasi', () => {
    expect(notifDokumenKedaluwarsa([doc({ masa_berlaku: null })], HARI_INI)).toEqual([])
  })

  it('NL-02 masih lama (lebih dari 30 hari): tidak ada notifikasi', () => {
    expect(notifDokumenKedaluwarsa([doc({ masa_berlaku: '2027-03-01' })], HARI_INI)).toEqual([])
  })

  it('NL-03 tepat 30 hari lagi: segera habis', () => {
    const [n] = notifDokumenKedaluwarsa([doc({ masa_berlaku: '2026-12-16' })], HARI_INI)
    expect(n.title).toContain('segera habis')
    expect(n.desc).toContain('30 hari lagi')
    expect(n.urgent).toBe(false)
  })

  it('NL-04 tinggal 1 hari: teks dan penanda penting', () => {
    const [n] = notifDokumenKedaluwarsa([doc({ masa_berlaku: '2026-11-17' })], HARI_INI)
    expect(n.desc).toContain('tinggal 1 hari lagi')
    expect(n.desc).toContain('17 November 2026')
    expect(n.urgent).toBe(true)
  })

  it('NL-05 berakhir hari ini', () => {
    const [n] = notifDokumenKedaluwarsa([doc({ masa_berlaku: '2026-11-16' })], HARI_INI)
    expect(n.desc).toContain('berakhir hari ini')
  })

  it('NL-06 sudah lewat: kedaluwarsa dan penting', () => {
    const [n] = notifDokumenKedaluwarsa([doc({ masa_berlaku: '2026-11-10' })], HARI_INI)
    expect(n.title).toContain('sudah kedaluwarsa')
    expect(n.fullMessage).toContain('6 hari yang lalu')
    expect(n.urgent).toBe(true)
    expect(n.href).toBe('/legalitas')
  })

  it('NL-07 id berubah saat status berpindah dari segera habis ke kedaluwarsa', () => {
    const d = doc({ masa_berlaku: '2026-11-17' })
    const sebelum = notifDokumenKedaluwarsa([d], HARI_INI)[0]
    const sesudah = notifDokumenKedaluwarsa([d], new Date(2026, 10, 20))[0]
    expect(sebelum.id).not.toBe(sesudah.id)
  })

  it('NL-08 id tetap sepanjang masih segera habis, jadi status dibaca tidak hilang', () => {
    const d = doc({ masa_berlaku: '2026-12-10' })
    const a = notifDokumenKedaluwarsa([d], new Date(2026, 10, 16))[0]
    const b = notifDokumenKedaluwarsa([d], new Date(2026, 10, 20))[0]
    expect(a.id).toBe(b.id)
  })

  it('NL-09 masa berlaku diperbarui ke tanggal jauh: notifikasi hilang', () => {
    expect(notifDokumenKedaluwarsa([doc({ masa_berlaku: '2028-01-01' })], HARI_INI)).toEqual([])
  })

  it('NL-10 kedaluwarsa diurutkan di atas, lalu yang paling dekat berakhir', () => {
    const hasil = notifDokumenKedaluwarsa(
      [
        doc({ id: 'a', nama_dokumen: 'A', masa_berlaku: '2026-12-10' }),
        doc({ id: 'b', nama_dokumen: 'B', masa_berlaku: '2026-11-20' }),
        doc({ id: 'c', nama_dokumen: 'C', masa_berlaku: '2026-11-01' }),
      ],
      HARI_INI
    )
    expect(hasil.map((n) => n.title.split(' ')[0])).toEqual(['C', 'B', 'A'])
  })

  it('NL-11 waktu segera habis tidak lebih awal dari saat dokumen dicatat', () => {
    const [n] = notifDokumenKedaluwarsa(
      [doc({ masa_berlaku: '2026-11-17', created_at: '2026-11-15T08:00:00Z' })],
      HARI_INI
    )
    expect(n.timeIso).toBe('2026-11-15T08:00:00Z')
  })
})
