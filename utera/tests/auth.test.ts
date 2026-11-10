import { describe, it, expect } from 'vitest'
import { isAdminUser, safeRedirect } from '../lib/auth'

describe('Keamanan peran admin dan redirect', () => {
  it('AUTH-01 email berisi "admin" bukan admin', () => {
    expect(isAdminUser({ app_metadata: {} })).toBe(false)
  })
  it('AUTH-02 user_metadata.role tidak dipakai (bisa diisi pengguna)', () => {
    const u = { app_metadata: {}, user_metadata: { role: 'admin' } }
    expect(isAdminUser(u)).toBe(false)
  })
  it('AUTH-03 app_metadata.role = admin', () => {
    expect(isAdminUser({ app_metadata: { role: 'admin' } })).toBe(true)
  })
  it('AUTH-04 tanpa user', () => {
    expect(isAdminUser(null)).toBe(false)
  })
  it('AUTH-05 redirect hanya path internal', () => {
    expect(safeRedirect('/buku-kas')).toBe('/buku-kas')
    expect(safeRedirect('//evil.com')).toBe('/dashboard')
    expect(safeRedirect('https://evil.com')).toBe('/dashboard')
    expect(safeRedirect('/\\evil.com')).toBe('/dashboard')
    expect(safeRedirect(null)).toBe('/dashboard')
  })
})
