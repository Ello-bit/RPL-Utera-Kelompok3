'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface TopBarProps {
  businessName: string
  userName: string
  userEmail: string
  isAdmin?: boolean
  onToggleMobileMenu?: () => void
}

export default function TopBar({
  businessName,
  userName,
  userEmail,
  isAdmin = false,
  onToggleMobileMenu,
}: TopBarProps) {
  const router = useRouter()
  const supabase = createClient()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isUserAdmin = isAdmin || userEmail.toLowerCase().includes('admin')
  const displayName = isUserAdmin ? 'Super Administrator' : (userName || businessName || 'Pemilik Usaha')
  const initials = isUserAdmin ? 'SA' : displayName
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleLogout() {
    if (!confirm('Apakah Anda yakin ingin keluar dari akun UTERA?')) return
    await supabase.auth.signOut()
    router.push('/auth?mode=login')
    router.refresh()
  }

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <button
          type="button"
          className="btn-mobile-menu"
          id="btn-mobile-menu"
          aria-label="Buka menu navigasi"
          onClick={onToggleMobileMenu}
        >
          <span className="material-symbols-rounded">menu</span>
        </button>

        {/* Search Bar */}
        <div className="search-box">
          <span className="material-symbols-rounded search-icon">search</span>
          <input
            type="text"
            id="global-search"
            placeholder="Cari transaksi kas, kategori, atau fitur..."
            autoComplete="off"
          />
          <span className="search-shortcut">⌘F</span>
        </div>
      </div>

      <div className="top-bar-right">
        {/* Notification Pill */}
        <div className="topbar-action-pill" id="action-notif" title="Notifikasi Keuangan">
          <span className="material-symbols-rounded">notifications</span>
          <span className="dot-unread"></span>
        </div>

        {/* Quick Action */}
        {isUserAdmin ? (
          <Link href="/admin?tab=direktori" className="btn btn-primary btn-sm" id="btn-open-tx-modal" style={{ background: '#14532D', borderColor: '#14532D' }}>
            <span className="material-symbols-rounded btn-icon" style={{ fontSize: '18px' }}>verified</span>
            <span>Verifikasi UMKM</span>
          </Link>
        ) : (
          <Link href="/buku-kas" className="btn btn-primary btn-sm" id="btn-open-tx-modal">
            <span className="material-symbols-rounded btn-icon" style={{ fontSize: '18px' }}>add</span>
            <span>Catat Kas</span>
          </Link>
        )}

        {/* User Topbar Profile with Dropdown */}
        <div className="user-top-profile-wrap" style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            type="button"
            className="user-top-profile"
            id="btn-user-dropdown"
            title="Menu Akun & Profil"
            aria-expanded={dropdownOpen}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <div className="user-avatar-circle" id="user-top-avatar" style={isUserAdmin ? { background: '#14532D', color: '#FCD34D' } : {}}>
              {isUserAdmin ? (
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>admin_panel_settings</span>
              ) : (
                initials
              )}
            </div>
            <div className="user-meta-top">
              <span className="user-name-label" id="user-top-name">{displayName}</span>
              <small className="user-role-label">
                {isUserAdmin ? 'Super Administrator' : 'Pemilik Usaha'}
              </small>
            </div>
            <span
              className="material-symbols-rounded"
              style={{ fontSize: '18px', color: 'var(--text-muted)', marginLeft: '4px' }}
            >
              expand_more
            </span>
          </button>

          <div className={`user-dropdown-menu ${dropdownOpen ? 'show' : ''}`} id="user-dropdown-menu">
            <div className="dropdown-header">
              <strong id="dropdown-user-name">{displayName}</strong>
              <span id="dropdown-user-email" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {userEmail}
              </span>
              {isUserAdmin && (
                <div style={{ marginTop: '6px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ECFDF5', color: '#065F46', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '13px' }}>verified_user</span>
                    Otoritas Pengawas Platform
                  </span>
                </div>
              )}
            </div>
            <div className="dropdown-divider"></div>

            {isUserAdmin ? (
              <>
                <Link href="/admin" className="dropdown-link" onClick={() => setDropdownOpen(false)}>
                  <span className="material-symbols-rounded">admin_panel_settings</span>
                  <span>Pusat Pengawasan</span>
                </Link>
                <Link href="/admin?tab=direktori" className="dropdown-link" onClick={() => setDropdownOpen(false)}>
                  <span className="material-symbols-rounded">storefront</span>
                  <span>Direktori &amp; Verifikasi UMKM</span>
                </Link>
                <Link href="/admin?tab=skor" className="dropdown-link" onClick={() => setDropdownOpen(false)}>
                  <span className="material-symbols-rounded">verified</span>
                  <span>Audit Kredibilitas &amp; Skor</span>
                </Link>
                <Link href="/admin?tab=kas" className="dropdown-link" onClick={() => setDropdownOpen(false)}>
                  <span className="material-symbols-rounded">receipt_long</span>
                  <span>Audit Mutasi Kas Global</span>
                </Link>
                <Link href="/admin?tab=kur" className="dropdown-link" onClick={() => setDropdownOpen(false)}>
                  <span className="material-symbols-rounded">account_balance</span>
                  <span>Pengawasan Penyaluran KUR</span>
                </Link>
                <Link href="/admin?tab=sistem" className="dropdown-link" onClick={() => setDropdownOpen(false)}>
                  <span className="material-symbols-rounded">security</span>
                  <span>Status Keamanan &amp; Log</span>
                </Link>
              </>
            ) : (
              <>
                <Link href="/profil-usaha" className="dropdown-link" onClick={() => setDropdownOpen(false)}>
                  <span className="material-symbols-rounded">storefront</span>
                  <span>Profil Usaha</span>
                </Link>
                <Link href="/buku-kas" className="dropdown-link" onClick={() => setDropdownOpen(false)}>
                  <span className="material-symbols-rounded">receipt_long</span>
                  <span>Buku Kas Warung</span>
                </Link>
                <Link href="/skor-kelayakan" className="dropdown-link" onClick={() => setDropdownOpen(false)}>
                  <span className="material-symbols-rounded">verified</span>
                  <span>Skor Kelayakan</span>
                </Link>
              </>
            )}

            <div className="dropdown-divider"></div>
            <button
              type="button"
              className="dropdown-link text-danger"
              id="topbar-btn-logout"
              onClick={handleLogout}
              style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
            >
              <span className="material-symbols-rounded" style={{ color: '#EF4444' }}>logout</span>
              <span style={{ color: '#EF4444' }}>Keluar (Logout)</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

