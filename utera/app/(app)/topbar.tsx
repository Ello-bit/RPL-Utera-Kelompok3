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

interface NotificationItem {
  id: string
  title: string
  desc: string
  time: string
  icon: string
  iconBg: string
  iconColor: string
  href: string
  read: boolean
}

const DEFAULT_ADMIN_NOTIFS: NotificationItem[] = [
  {
    id: 'adm-1',
    title: 'Permohonan Verifikasi Kredibilitas',
    desc: 'Konveksi Berkah Makmur mengajukan audit NIB OSS dan validasi kredibilitas.',
    time: '10 menit lalu',
    icon: 'verified',
    iconBg: '#ECFDF5',
    iconColor: '#059669',
    href: '/admin?tab=direktori',
    read: false,
  },
  {
    id: 'adm-2',
    title: 'Peringatan Guardrail Cicilan 30%',
    desc: 'Bengkel Motor Sejahtera mendekati batas waspada angsuran pinjaman (24% dari laba).',
    time: '1 jam lalu',
    icon: 'warning',
    iconBg: '#FEF3C7',
    iconColor: '#D97706',
    href: '/admin?tab=kur',
    read: false,
  },
  {
    id: 'adm-3',
    title: 'Ledger Audit: 18 Transaksi Kas Baru',
    desc: 'Tercatat mutasi kas operasional baru di ekosistem binaan hari ini.',
    time: '3 jam lalu',
    icon: 'receipt_long',
    iconBg: '#EFF6FF',
    iconColor: '#2563EB',
    href: '/admin?tab=kas',
    read: false,
  },
  {
    id: 'adm-4',
    title: 'Pembaruan Skor Kelayakan Bank',
    desc: 'Warung Berkah Jaya mencapai skor 88/100 (Kategori: Siap KUR Mikro s.d. Rp 100 Jt).',
    time: 'Kemarin',
    icon: 'star',
    iconBg: '#FEF7EC',
    iconColor: '#C98A1B',
    href: '/admin?tab=skor',
    read: true,
  },
  {
    id: 'adm-5',
    title: 'Pemeriksaan Integritas Sistem RLS',
    desc: 'Seluruh isolasi database multi-tenant dan enkripsi cloud Supabase terverifikasi aman.',
    time: '2 hari lalu',
    icon: 'security',
    iconBg: '#F3F4F6',
    iconColor: '#4B5563',
    href: '/admin?tab=sistem',
    read: true,
  },
]

const DEFAULT_USER_NOTIFS: NotificationItem[] = [
  {
    id: 'usr-1',
    title: 'Skor Kelayakan Bank Meningkat!',
    desc: 'Skor PRD Anda naik menjadi 79/100 (+5 poin) berkat pencatatan kas yang konsisten.',
    time: '15 menit lalu',
    icon: 'verified',
    iconBg: '#ECFDF5',
    iconColor: '#059669',
    href: '/skor-kelayakan',
    read: false,
  },
  {
    id: 'usr-2',
    title: 'Batas Cicilan Aman Terkalkulasi',
    desc: 'Kapasitas angsuran aman maksimal warung Anda saat ini adalah Rp 16.905.000 / bln.',
    time: '2 jam lalu',
    icon: 'account_balance',
    iconBg: '#EFF6FF',
    iconColor: '#2563EB',
    href: '/guardrail',
    read: false,
  },
  {
    id: 'usr-3',
    title: 'Pengingat Pembukuan Kas Harian',
    desc: 'Catat transaksi penjualan dan kulakan hari ini agar menjaga reputasi skor SAK EMKM Anda.',
    time: '5 jam lalu',
    icon: 'receipt_long',
    iconBg: '#FEF7EC',
    iconColor: '#C98A1B',
    href: '/buku-kas',
    read: false,
  },
  {
    id: 'usr-4',
    title: 'Legalitas NIB OSS Terverifikasi',
    desc: 'Dokumen legalitas usaha Anda telah aktif dan dapat dilampirkan pada berkas pengajuan KUR.',
    time: 'Kemarin',
    icon: 'description',
    iconBg: '#FAF5FF',
    iconColor: '#7C3AED',
    href: '/legalitas',
    read: true,
  },
]

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
  const [notifOpen, setNotifOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  const isUserAdmin = isAdmin || userEmail.toLowerCase().includes('admin')
  const displayName = isUserAdmin ? 'Super Administrator' : (userName || businessName || 'Pemilik Usaha')
  const initials = isUserAdmin ? 'SA' : displayName
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const [notifList, setNotifList] = useState<NotificationItem[]>(
    isUserAdmin ? DEFAULT_ADMIN_NOTIFS : DEFAULT_USER_NOTIFS
  )

  const unreadCount = notifList.filter((n) => !n.read).length

  const handleMarkAllRead = () => {
    setNotifList((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const handleItemClick = (id: string) => {
    setNotifList((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    setNotifOpen(false)
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false)
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
        {/* Notification Pill with Interactive Dropdown */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            type="button"
            className="topbar-action-pill"
            id="action-notif"
            title="Pemberitahuan & Notifikasi"
            aria-expanded={notifOpen}
            onClick={() => setNotifOpen(!notifOpen)}
            style={{
              background: notifOpen ? '#FFFFFF' : undefined,
              borderColor: notifOpen ? 'var(--primary)' : undefined,
              color: notifOpen ? 'var(--primary)' : undefined,
            }}
          >
            <span className="material-symbols-rounded">
              {unreadCount > 0 ? 'notifications_active' : 'notifications'}
            </span>
            {unreadCount > 0 && <span className="dot-unread"></span>}
          </button>

          {/* NOTIFICATION POPUP */}
          <div className={`notif-dropdown-menu ${notifOpen ? 'show' : ''}`} id="notif-dropdown-menu">
            <div className="notif-header">
              <div className="notif-title-row">
                <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--primary)' }}>
                  {isUserAdmin ? 'shield' : 'notifications'}
                </span>
                <span className="notif-title">
                  {isUserAdmin ? 'Pengawasan & Audit' : 'Notifikasi Keuangan'}
                </span>
                {unreadCount > 0 && (
                  <span className="notif-count-pill">{unreadCount} Baru</span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notif-action-mark"
                  onClick={handleMarkAllRead}
                  title="Tandai semua pesan sudah dibaca"
                >
                  Tandai Dibaca
                </button>
              )}
            </div>

            <ul className="notif-list">
              {notifList.length === 0 ? (
                <li className="notif-empty-state">
                  <span className="material-symbols-rounded" style={{ fontSize: '32px', color: 'var(--text-light)', display: 'block', marginBottom: '8px' }}>
                    drafts
                  </span>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>Tidak ada notifikasi saat ini.</p>
                </li>
              ) : (
                notifList.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={`notif-item ${!item.read ? 'is-unread' : ''}`}
                      onClick={() => handleItemClick(item.id)}
                    >
                      <div
                        className="notif-item-icon"
                        style={{ background: item.iconBg, color: item.iconColor }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                          {item.icon}
                        </span>
                      </div>
                      <div className="notif-item-content">
                        <div className="notif-item-title">{item.title}</div>
                        <div className="notif-item-desc">{item.desc}</div>
                        <div className="notif-item-time">
                          <span className="material-symbols-rounded" style={{ fontSize: '12px' }}>
                            schedule
                          </span>
                          <span>{item.time}</span>
                          {!item.read && (
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--emerald)', marginLeft: '4px' }}></span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))
              )}
            </ul>

            <div className="notif-footer">
              <Link
                href={isUserAdmin ? '/admin?tab=direktori' : '/dashboard'}
                onClick={() => setNotifOpen(false)}
              >
                {isUserAdmin ? 'Buka Semua Audit Pengawasan →' : 'Lihat Ringkasan Finansial →'}
              </Link>
            </div>
          </div>
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

