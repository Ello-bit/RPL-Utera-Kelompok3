// Profil (usaha) aktif disimpan di cookie agar konsisten antar halaman dan terbaca
// oleh server component (layout). Bukan data bisnis; hanya penunjuk id profil.
export const PROFIL_COOKIE = 'utera_profil_aktif'

export function getActiveProfilId(): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp('(?:^|; )' + PROFIL_COOKIE + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}

export function setActiveProfilId(id: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${PROFIL_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`
}

/** Pilih profil aktif: yang tersimpan di cookie bila masih ada, jika tidak yang terbaru. */
export function pickActiveProfile<T extends { id: string }>(
  profiles: T[],
  activeId: string | null
): T | undefined {
  return profiles.find((p) => p.id === activeId) ?? profiles[0]
}
