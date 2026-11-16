import { describe, it, expect } from 'vitest'
import { validasiFoto, pathDariUrl, FOTO_MAKS_BYTE } from '../lib/foto-usaha'

describe('Foto profil usaha: validasi file', () => {
  it('FOTO-01 JPG di bawah 2 MB diterima', () => {
    expect(validasiFoto({ type: 'image/jpeg', size: 500_000 })).toBeNull()
  })
  it('FOTO-02 tepat 2 MB diterima, lebih 1 byte ditolak', () => {
    expect(validasiFoto({ type: 'image/png', size: FOTO_MAKS_BYTE })).toBeNull()
    expect(validasiFoto({ type: 'image/png', size: FOTO_MAKS_BYTE + 1 })).toMatch(/2 MB/)
  })
  it('FOTO-03 format selain JPG/PNG/WebP ditolak (GIF, PDF, SVG)', () => {
    for (const type of ['image/gif', 'application/pdf', 'image/svg+xml']) {
      expect(validasiFoto({ type, size: 1000 })).toMatch(/JPG, PNG, atau WebP/)
    }
  })
  it('FOTO-04 file kosong ditolak', () => {
    expect(validasiFoto({ type: 'image/webp', size: 0 })).toMatch(/kosong/)
  })
})

describe('Foto profil usaha: path dari alamat publik', () => {
  it('FOTO-05 mengambil path di bucket dari URL publik Supabase', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/public/foto-usaha/user-1/profil-2-123.jpg'
    expect(pathDariUrl(url)).toBe('user-1/profil-2-123.jpg')
  })
  it('FOTO-06 URL lain atau kosong menghasilkan null', () => {
    expect(pathDariUrl(null)).toBeNull()
    expect(pathDariUrl('https://contoh.com/gambar.jpg')).toBeNull()
  })
})
