'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
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
  category: string
  fullMessage: string
  recommendation: string
  time: string
  icon: string
  iconBg: string
  iconColor: string
  href: string
  actionLabel: string
  read: boolean
  urgent?: boolean
}

const DEFAULT_ADMIN_NOTIFS: NotificationItem[] = [
  {
    id: 'adm-welcome',
    title: 'Selamat Datang di Pusat Pengawasan UTERA',
    desc: 'Akun Super Administrator Anda telah aktif dan siap untuk pengawasan platform.',
    category: 'Selamat Datang',
    fullMessage: 'Selamat datang di Pusat Pengawasan & Audit UTERA! Sebagai Super Administrator, Anda memiliki wewenang penuh untuk memantau integritas kas mitra UMKM, mengesahkan status kredibilitas binaan, dan mengawasi kepatuhan batas beban cicilan pinjaman 30%.',
    recommendation: 'Buka Direktori UMKM untuk meninjau data usaha yang terdaftar dan memeriksa status verifikasi mitra binaan.',
    time: 'Baru saja',
    icon: 'admin_panel_settings',
    iconBg: '#ECFDF5',
    iconColor: '#059669',
    href: '/admin?tab=direktori',
    actionLabel: 'Buka Direktori UMKM',
    read: false,
    urgent: true,
  },
  {
    id: 'adm-system',
    title: 'Sistem Keamanan Database Multi-Tenant Beroperasi',
    desc: 'Enkripsi data Row Level Security (RLS) Supabase aktif melindungi privasi usaha.',
    category: 'Keamanan Sistem',
    fullMessage: 'Pemeriksaan otomatis mengonfirmasi bahwa seluruh 5 tabel data pengguna terisolasi dengan aman menggunakan kebijakan Row Level Security (RLS) di cloud Supabase tanpa kebocoran data antar-warung.',
    recommendation: 'Platform siap digunakan untuk audit pengawasan ekosistem UMKM secara berkala.',
    time: 'Baru saja',
    icon: 'security',
    iconBg: '#EFF6FF',
    iconColor: '#2563EB',
    href: '/admin?tab=sistem',
    actionLabel: 'Lihat Status Sistem & Log',
    read: false,
  },
]

const DEFAULT_USER_NOTIFS: NotificationItem[] = [
  {
    id: 'usr-welcome',
    title: 'Selamat Datang di UTERA!',
    desc: 'Selamat bergabung! Akun Anda telah aktif dan siap digunakan untuk pembukuan kas warung.',
    category: 'Selamat Datang',
    fullMessage: 'Halo! Selamat datang di UTERA (UMKM Sejahtera). Akun Anda telah berhasil dibuat. UTERA membantu warung dan usaha mikro mencatat arus kas harian secara transparan sesuai standar SAK EMKM dan menyiapkan kelayakan kredit perbankan secara otomatis.',
    recommendation: 'Langkah pertama: Buka menu Profil Usaha untuk melengkapi nama usaha dan data pemilik, kemudian catat transaksi pertama Anda di Buku Kas Warung.',
    time: 'Baru saja',
    icon: 'waving_hand',
    iconBg: '#ECFDF5',
    iconColor: '#059669',
    href: '/profil-usaha',
    actionLabel: 'Lengkapi Profil Usaha Saya',
    read: false,
    urgent: true,
  },
  {
    id: 'usr-guide',
    title: 'Panduan: 4 Pilar Kelayakan Kredit Bank',
    desc: 'Pelajari bagaimana pembukuan kas Anda dinilai oleh analis bank mitra (K1–K4 SAK EMKM).',
    category: 'Panduan Pemula',
    fullMessage: 'Bank mitra UTERA menilai kelayakan kredit usaha Anda melalui 4 pilar utama: K1 Konsistensi Pencatatan Kas (30%), K2 Pertumbuhan Omzet (25%), K3 Margin Operasional (25%), dan K4 Kestabilan Kas (20%).',
    recommendation: 'Cukup catat pemasukan dan pengeluaran setiap hari secara konsisten untuk membangun skor kelayakan kredit yang tinggi.',
    time: 'Baru saja',
    icon: 'school',
    iconBg: '#EFF6FF',
    iconColor: '#2563EB',
    href: '/skor-kelayakan',
    actionLabel: 'Pelajari Skor Kelayakan',
    read: false,
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
  const [notifModalOpen, setNotifModalOpen] = useState(false)
  const [modalFilter, setModalFilter] = useState<'all' | 'unread' | 'urgent'>('all')

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
  const [selectedNotif, setSelectedNotif] = useState<NotificationItem | null>(null)

  // Sync notif dataset whenever role or email changes
  useEffect(() => {
    const defaultData = isUserAdmin ? DEFAULT_ADMIN_NOTIFS : DEFAULT_USER_NOTIFS
    const storageKey = `utera_notifs_clean_${userEmail.toLowerCase().replace(/[^a-z0-9]/g, '_')}`

    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNotifList(parsed)
          setSelectedNotif(parsed[0] || null)
          return
        }
      }
    } catch (e) {
      // ignore parse error
    }

    setNotifList(defaultData)
    setSelectedNotif(defaultData[0] || null)
    try {
      localStorage.setItem(storageKey, JSON.stringify(defaultData))
    } catch (e) {}
  }, [isUserAdmin, userEmail])

  const unreadCount = notifList.filter((n) => !n.read).length

  const filteredModalNotifs = useMemo(() => {
    if (modalFilter === 'unread') return notifList.filter((n) => !n.read)
    if (modalFilter === 'urgent') return notifList.filter((n) => n.urgent)
    return notifList
  }, [notifList, modalFilter])

  const saveNotifList = (newList: NotificationItem[]) => {
    setNotifList(newList)
    const storageKey = `utera_notifs_clean_${userEmail.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    try {
      localStorage.setItem(storageKey, JSON.stringify(newList))
    } catch (e) {}
  }

  const handleMarkAllRead = () => {
    const updated = notifList.map((n) => ({ ...n, read: true }))
    saveNotifList(updated)
  }

  const handleOpenItem = (item: NotificationItem) => {
    const updated = notifList.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    saveNotifList(updated)
    setSelectedNotif({ ...item, read: true })
    setNotifModalOpen(true)
    setNotifOpen(false)
  }

  const handleOpenCenter = () => {
    if (!selectedNotif && notifList.length > 0) {
      setSelectedNotif(notifList[0])
    }
    setNotifModalOpen(true)
    setNotifOpen(false)
  }

  const handleNavigateAction = (href: string) => {
    setNotifModalOpen(false)
    router.push(href)
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
    <>
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
              placeholder={isUserAdmin ? 'Cari mitra UMKM, audit kas, atau skor...' : 'Cari transaksi kas, kategori, atau fitur...'}
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
              title="Pemberitahuan &amp; Notifikasi"
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

            {/* NOTIFICATION DROPDOWN POPUP */}
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
                      <div
                        className={`notif-item ${!item.read ? 'is-unread' : ''}`}
                        onClick={() => handleOpenItem(item)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleOpenItem(item)
                        }}
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
                      </div>
                    </li>
                  ))
                )}
              </ul>

              <div className="notif-footer">
                <button
                  type="button"
                  onClick={handleOpenCenter}
                  style={{ width: '100%', textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}
                >
                  {isUserAdmin ? 'Buka Semua Audit Pengawasan →' : 'Buka Pusat Notifikasi Lengkap →'}
                </button>
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

      {/* =====================================================================
          PUSAT NOTIFIKASI MODAL (DETAIL & RIWAYAT LENGKAP)
          ===================================================================== */}
      {notifModalOpen && (
        <div
          className="notif-modal-overlay"
          onClick={() => setNotifModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="notif-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="notif-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'var(--primary-soft)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span className="material-symbols-rounded">
                    {isUserAdmin ? 'shield' : 'notifications'}
                  </span>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                    {isUserAdmin ? 'Pusat Pemberitahuan & Audit Pengawasan' : 'Pusat Notifikasi Finansial UMKM'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {isUserAdmin ? 'Rekam jejak kepatuhan perizinan NIB, audit kas global, dan evaluasi kredit bank.' : 'Informasi kenaikan skor PRD, batas aman cicilan 30%, dan pembukuan kas warung.'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="notif-tab-btn"
                    onClick={handleMarkAllRead}
                    style={{ background: '#ECFDF5', color: '#065F46', borderColor: '#A7F3D0' }}
                  >
                    ✓ Tandai Semua Dibaca
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setNotifModalOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: 'var(--text-muted)', display: 'flex' }}
                  aria-label="Tutup Pusat Notifikasi"
                >
                  <span className="material-symbols-rounded">close</span>
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="notif-modal-tabs">
              <button
                type="button"
                className={`notif-tab-btn ${modalFilter === 'all' ? 'is-active' : ''}`}
                onClick={() => setModalFilter('all')}
              >
                Semua ({notifList.length})
              </button>
              <button
                type="button"
                className={`notif-tab-btn ${modalFilter === 'unread' ? 'is-active' : ''}`}
                onClick={() => setModalFilter('unread')}
              >
                Belum Dibaca ({unreadCount})
              </button>
              <button
                type="button"
                className={`notif-tab-btn ${modalFilter === 'urgent' ? 'is-active' : ''}`}
                onClick={() => setModalFilter('urgent')}
              >
                Penting / Prioritas
              </button>
            </div>

            {/* Modal Body: Left List + Right Detail View */}
            <div className="notif-modal-body">
              {/* Left Sidebar List */}
              <div className="notif-modal-sidebar">
                {filteredModalNotifs.length === 0 ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '28px', color: 'var(--text-light)', display: 'block', marginBottom: '6px' }}>
                      check_circle
                    </span>
                    Tidak ada notifikasi dalam filter ini.
                  </div>
                ) : (
                  filteredModalNotifs.map((item) => {
                    const isSelected = selectedNotif?.id === item.id
                    return (
                      <div
                        key={item.id}
                        className={`notif-modal-sidebar-item ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => {
                          setSelectedNotif(item)
                          if (!item.read) {
                            setNotifList((prev) =>
                              prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
                            )
                          }
                        }}
                      >
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            background: item.iconBg,
                            color: item.iconColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            marginTop: '2px',
                          }}
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                            {item.icon}
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                              {item.category}
                            </span>
                            {!item.read && (
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--emerald)' }}></span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginTop: '2px' }}>
                            {item.time}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Right Detail Pane */}
              <div className="notif-modal-content-view">
                {selectedNotif ? (
                  <div>
                    {/* Header meta */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          background: selectedNotif.iconBg,
                          color: selectedNotif.iconColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '24px' }}>
                          {selectedNotif.icon}
                        </span>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#F1F5F3', fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-body)' }}>
                            {selectedNotif.category}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <span className="material-symbols-rounded" style={{ fontSize: '13px' }}>schedule</span>
                            {selectedNotif.time}
                          </span>
                        </div>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: '4px 0 0' }}>
                          {selectedNotif.title}
                        </h2>
                      </div>
                    </div>

                    {/* Full Message content */}
                    <div style={{ background: '#F8FAF9', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-subtle)', marginBottom: '16px', fontSize: '0.875rem', lineHeight: '1.6', color: 'var(--text-body)' }}>
                      <p style={{ margin: 0 }}>{selectedNotif.fullMessage}</p>
                    </div>

                    {/* Recommendation Box */}
                    <div style={{ background: '#FAFDFB', borderRadius: '12px', padding: '16px', border: '1px solid #D1E7DC', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.825rem', color: 'var(--primary)', marginBottom: '6px' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>lightbulb</span>
                        Rekomendasi Analis &amp; Kepatuhan
                      </div>
                      <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-body)', lineHeight: '1.5' }}>
                        {selectedNotif.recommendation}
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '16px', color: '#059669' }}>check_circle</span>
                        Telah tercatat dalam sistem keamanan platform
                      </span>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setNotifModalOpen(false)}
                        >
                          Tutup
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleNavigateAction(selectedNotif.href)}
                        >
                          <span>{selectedNotif.actionLabel}</span>
                          <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                    Pilih salah satu notifikasi di sebelah kiri untuk melihat rincian detail.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
