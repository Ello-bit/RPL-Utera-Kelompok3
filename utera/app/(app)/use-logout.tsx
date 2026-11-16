'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Logout dengan kotak konfirmasi buatan aplikasi.
 * Sebelumnya memakai window.confirm(); di browser yang memblokir dialog (atau setelah
 * pengguna memilih "jangan tampilkan lagi") confirm() langsung bernilai false, sehingga
 * tombol Keluar terlihat tidak bereaksi sama sekali.
 */
export function useLogout() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function doLogout() {
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) {
      // Sesi di server mungkin sudah tidak ada; tetap hapus sesi lokal agar benar-benar keluar.
      await supabase.auth.signOut({ scope: 'local' })
    }
    // Navigasi penuh agar cache halaman versi "sudah login" ikut dibuang.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- logout butuh muat ulang penuh
    window.location.assign('/auth?mode=login')
  }

  const dialog = open ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-title"
      onClick={() => !busy && setOpen(false)}
      onKeyDown={(e) => e.key === 'Escape' && !busy && setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '14px', padding: '22px', width: '100%', maxWidth: '360px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        }}
      >
        <h3 id="logout-title" style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main, #0F172A)' }}>
          Keluar dari akun?
        </h3>
        <p style={{ margin: '0 0 18px', fontSize: '0.875rem', color: 'var(--text-muted, #64748B)' }}>
          Anda perlu masuk lagi untuk membuka data usaha Anda.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            autoFocus
            disabled={busy}
            onClick={() => setOpen(false)}
            style={{
              padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border-subtle, #E2E8F0)',
              background: '#fff', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Batal
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={doLogout}
            style={{
              padding: '9px 16px', borderRadius: '8px', border: 'none', background: '#B5532F',
              color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
            }}
          >
            {busy ? 'Keluar…' : 'Keluar'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { requestLogout: () => setOpen(true), logoutDialog: dialog }
}
