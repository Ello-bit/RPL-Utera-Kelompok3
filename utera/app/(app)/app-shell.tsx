'use client'

import { Fragment, useCallback, useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './sidebar'
import TopBar from './topbar'
import CatatKasModal from './catat-kas/catat-kas-modal'
import { gulirKeCatatKas } from './catat-kas/catat-kas-form'

interface AppShellProps {
  businessName: string
  fotoUrl?: string | null
  totalTx: number
  skor: number
  userEmail: string
  userName: string
  /** Tanggal akun dibuat (Supabase Auth), dipakai untuk waktu notifikasi sambutan */
  userCreatedAt?: string | null
  isAdmin?: boolean
  children: React.ReactNode
}

export default function AppShell({
  businessName,
  fotoUrl = null,
  totalTx,
  skor,
  userEmail,
  userName,
  userCreatedAt = null,
  isAdmin = false,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Tombol "Catat Kas" di kanan atas: di Buku Kas Warung langsung gulir ke formulirnya,
  // di halaman lain buka pop-up dengan formulir yang sama.
  const [catatKasOpen, setCatatKasOpen] = useState(false)
  // Dinaikkan setelah menyimpan dari pop-up, supaya isi halaman dimuat ulang dengan data terbaru
  const [versiData, setVersiData] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  const bukaCatatKas = () => {
    if (pathname === '/buku-kas' && gulirKeCatatKas()) return
    setCatatKasOpen(true)
  }
  const tutupCatatKas = useCallback(() => setCatatKasOpen(false), [])
  const setelahSimpanKas = useCallback(() => {
    setCatatKasOpen(false)
    setVersiData((v) => v + 1)
    setToast('Transaksi kas berhasil disimpan.')
    window.setTimeout(() => setToast(null), 3000)
  }, [])

  return (
    <div className="app-layout">
      <Sidebar
        businessName={businessName}
        fotoUrl={fotoUrl}
        totalTx={totalTx}
        skor={skor}
        userEmail={userEmail}
        isAdmin={isAdmin}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="main-content" id="main-content">
        <TopBar
          businessName={businessName}
          userName={userName}
          userEmail={userEmail}
          userCreatedAt={userCreatedAt}
          isAdmin={isAdmin}
          onToggleMobileMenu={() => setMobileOpen(!mobileOpen)}
          onCatatKas={bukaCatatKas}
        />
        <Fragment key={versiData}>{children}</Fragment>
      </div>
      {catatKasOpen && <CatatKasModal onClose={tutupCatatKas} onSaved={setelahSimpanKas} />}
      {toast && (
        <div className="catat-kas-toast" role="status">
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>check_circle</span>
          {toast}
        </div>
      )}
    </div>
  )
}

