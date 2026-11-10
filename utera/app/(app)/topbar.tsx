'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface TopBarProps {
  businessName: string
  userName: string
  userEmail: string
  onToggleMobileMenu?: () => void
}

export default function TopBar({
  businessName,
  userName,
  userEmail,
  onToggleMobileMenu,
}: TopBarProps) {
  const router = useRouter()
  const supabase = createClient()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const displayName = userName || businessName || 'Pemilik Usaha'
  const initials = displayName
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
        {userEmail.toLowerCase().includes('admin') ? (
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
            <div className="user-avatar-circle" id="user-top-avatar">
              {initials}
            </div>
            <div className="user-meta-top">
              <span className="user-name-label" id="user-top-name">{displayName}</span>
              <small className="user-role-label">
                {userEmail.toLowerCase().includes('admin') ? 'Super Administrator' : 'Pemilik Usaha'}
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
            </div>
            <div className="dropdown-divider"></div>
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

