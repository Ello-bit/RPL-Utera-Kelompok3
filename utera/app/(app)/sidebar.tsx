'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useLogout } from './use-logout'

interface SidebarProps {
  businessName: string
  /** Foto profil usaha aktif (Supabase Storage), bila ada */
  fotoUrl?: string | null
  totalTx: number
  skor: number
  userEmail: string
  isAdmin?: boolean
  mobileOpen?: boolean
  onCloseMobile?: () => void
}

interface NavItem {
  name: string
  href: string
  icon: string
  badge?: number
  pill?: number
  infoPill?: string
}

interface NavSection {
  section: string
  items: NavItem[]
}

export default function Sidebar({
  businessName,
  fotoUrl = null,
  totalTx,
  skor,
  userEmail,
  isAdmin = false,
  mobileOpen: controlledMobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab')
  const [internalMobileOpen, setInternalMobileOpen] = useState(false)
  const isMobileOpen = controlledMobileOpen !== undefined ? controlledMobileOpen : internalMobileOpen

  const closeSidebar = () => {
    if (onCloseMobile) onCloseMobile()
    else setInternalMobileOpen(false)
  }

  // Konfirmasi keluar memakai kotak dialog aplikasi (bukan window.confirm yang bisa diblokir browser)
  const { requestLogout: handleLogout, logoutDialog } = useLogout()

  const navItems: NavSection[] = [
    {
      section: 'UTAMA',
      items: [
        {
          name: 'Ringkasan Kas',
          href: '/dashboard',
          icon: 'grid_view',
        },
        {
          name: 'Buku Kas Warung',
          href: '/buku-kas',
          icon: 'receipt_long',
          badge: totalTx,
        },
        {
          name: 'Skor Kelayakan',
          href: '/skor-kelayakan',
          icon: 'verified',
          pill: skor > 0 ? skor : undefined,
        },
        {
          name: 'Batas Aman Cicilan',
          href: '/guardrail',
          icon: 'shield',
        },
      ],
    },
    {
      section: 'LAYANAN & BANK',
      items: [
        {
          name: 'Simulasi KUR 2026',
          href: '/simulasi-kur',
          icon: 'account_balance',
        },
        {
          name: 'Pinjaman Koperasi',
          href: '/koperasi',
          icon: 'handshake',
        },
        {
          name: 'Legalitas & NIB',
          href: '/legalitas',
          icon: 'description',
          infoPill: 'OSS RBA',
        },
        {
          name: 'Laporan Siap Bank',
          href: '/laporan-siap-bank',
          icon: 'monitoring',
        },
      ],
    },
    {
      section: 'PENGATURAN',
      items: [
        {
          name: 'Profil Usaha',
          href: '/profil-usaha',
          icon: 'storefront',
        },
        {
          name: 'Halaman Utama',
          href: '/',
          icon: 'open_in_new',
        },
      ],
    },
  ]

  const isUserAdmin = isAdmin

  const adminNavItems: NavSection[] = [
    {
      section: 'PENGAWASAN PLATFORM',
      items: [
        {
          name: 'Pusat Pengawasan',
          href: '/admin',
          icon: 'shield',
          infoPill: 'Pusat',
        },
        {
          name: 'Direktori & Verifikasi UMKM',
          href: '/admin?tab=direktori',
          icon: 'storefront',
        },
        {
          name: 'Audit Kredibilitas & Skor',
          href: '/admin?tab=skor',
          icon: 'verified',
        },
      ],
    },
    {
      section: 'AUDIT & KREDIT BANK',
      items: [
        {
          name: 'Audit Mutasi Kas Global',
          href: '/admin?tab=kas',
          icon: 'receipt_long',
        },
        {
          name: 'Pengawasan Penyaluran KUR',
          href: '/admin?tab=kur',
          icon: 'account_balance',
          infoPill: 'Bank',
        },
      ],
    },
    {
      section: 'SISTEM',
      items: [
        {
          name: 'Status Keamanan & Log',
          href: '/admin?tab=sistem',
          icon: 'security',
        },
        {
          name: 'Halaman Utama',
          href: '/',
          icon: 'open_in_new',
        },
      ],
    },
  ]

  const activeNavItems = isUserAdmin ? adminNavItems : navItems

  return (
    <>
      {logoutDialog}
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="sidebar-backdrop mobile-open"
          onClick={closeSidebar}
        />
      )}

      {/* Main Sidebar Shell */}
      <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`} id="app-sidebar">
        <div className="sidebar-header">
          <Link href={isUserAdmin ? '/admin' : '/dashboard'} className="sidebar-brand">
            <div className="brand-symbol" style={isUserAdmin ? { background: '#12402F', color: '#FCD34D' } : {}}>
              {isUserAdmin ? (
                <span className="material-symbols-rounded" style={{ fontSize: '22px', color: '#FCD34D' }}>
                  admin_panel_settings
                </span>
              ) : (
                <img src="/logo.png" alt="" className="brand-logo-img" />
              )}
            </div>
            <div className="brand-text">
              <span className="brand-name">{isUserAdmin ? 'UTERA PENGAWAS' : 'UTERA'}</span>
              <span className="brand-tag">{isUserAdmin ? 'Auditor & Kredibilitas' : 'Finansial UMKM'}</span>
            </div>
          </Link>
          <button
            type="button"
            className="sidebar-toggle-btn"
            id="btn-collapse-sidebar"
            onClick={closeSidebar}
            aria-label="Tutup navigasi"
          >
            <span className="material-symbols-rounded">dock_to_right</span>
          </button>
        </div>

        {/* Navigation Menus */}
        <nav className="sidebar-nav" aria-label="Menu Navigasi">
          {activeNavItems.map((sec) => (
            <div key={sec.section} className="nav-section">
              <div className="nav-section-title">{sec.section}</div>
              <ul className="nav-list">
                {sec.items.map((item) => {
                  // Menu admin hanya beda di ?tab=..., jadi bandingkan path DAN tab-nya.
                  // Tanpa ini semua menu /admin?tab=... ikut tersorot sekaligus.
                  const [itemPath, itemQuery] = item.href.split('?')
                  const itemTab = new URLSearchParams(itemQuery || '').get('tab')
                  const isActive =
                    pathname === itemPath && (itemPath !== '/admin' || itemTab === currentTab)
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`nav-item ${isActive ? 'active' : ''}`}
                        onClick={closeSidebar}
                      >
                        <span className="material-symbols-rounded">{item.icon}</span>
                        <span>{item.name}</span>
                        {item.badge !== undefined && (
                          <span className="nav-badge" id="badge-total-tx">{item.badge}</span>
                        )}
                        {item.pill !== undefined && (
                          <span className="nav-pill-good" id="nav-pill-skor">{item.pill}</span>
                        )}
                        {item.infoPill && (
                          <span className="nav-pill-info">{item.infoPill}</span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom Profile / Business Card */}
        <div className="sidebar-footer">
          <div
            className="business-profile-card"
            title={isUserAdmin ? 'Pengawas Ekosistem UTERA' : 'Profil Usaha'}
            style={{ textDecoration: 'none' }}
          >
            <div
              className="business-avatar"
              aria-hidden="true"
              style={isUserAdmin ? { background: '#EEF7F2' } : fotoUrl ? { overflow: 'hidden', padding: 0 } : {}}
            >
              {!isUserAdmin && fotoUrl ? (
                <img src={fotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <span className="material-symbols-rounded" style={{ color: '#1F6B4F' }}>
                  {isUserAdmin ? 'verified_user' : 'storefront'}
                </span>
              )}
            </div>
            <div className="business-details">
              <span className="business-title" id="sidebar-business-name">
                {isUserAdmin ? 'Super Administrator' : (businessName || 'Profil Usaha')}
              </span>
              <span className="business-badge">
                {isUserAdmin ? 'Pengawas & Penjaga Kredibilitas' : (userEmail || 'UMKM Mandiri')}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn-logout"
            id="btn-logout"
            onClick={handleLogout}
            title="Keluar dari akun"
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            <span className="material-symbols-rounded">logout</span>
            <span>Keluar</span>
          </button>
        </div>
      </aside>
    </>
  )
}
