import { describe, it, expect } from 'vitest'
import { pickActiveProfile } from '../lib/profil-aktif'

describe('E2E-03 profil aktif', () => {
  const ps = [{ id: 'a' }, { id: 'b' }]
  it('PA-01 memakai id tersimpan bila ada', () => {
    expect(pickActiveProfile(ps, 'b')?.id).toBe('b')
  })
  it('PA-02 id kedaluwarsa jatuh ke profil terbaru (pertama)', () => {
    expect(pickActiveProfile(ps, 'zzz')?.id).toBe('a')
    expect(pickActiveProfile(ps, null)?.id).toBe('a')
  })
  it('PA-03 tanpa profil', () => {
    expect(pickActiveProfile([], 'a')).toBeUndefined()
  })
})
