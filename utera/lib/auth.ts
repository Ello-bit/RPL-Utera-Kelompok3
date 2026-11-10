import type { User } from '@supabase/supabase-js'

/**
 * Admin hanya ditentukan oleh app_metadata.role, yang tidak bisa diubah pengguna
 * (user_metadata bisa diisi sendiri lewat signUp/updateUser, dan email bebas didaftar).
 * Set lewat SQL: update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email = '...';
 */
export function isAdminUser(user: Pick<User, 'app_metadata'> | null | undefined): boolean {
  return user?.app_metadata?.role === 'admin'
}

/** Hanya izinkan path internal agar parameter redirect tidak menjadi open redirect. */
export function safeRedirect(target: string | null | undefined, fallback = '/dashboard'): string {
  if (!target) return fallback
  if (!target.startsWith('/') || target.startsWith('//') || /[\\\s]/.test(target)) return fallback
  return target
}
