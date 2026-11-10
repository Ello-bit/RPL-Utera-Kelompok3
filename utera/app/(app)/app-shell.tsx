'use client'

import { useState } from 'react'
import Sidebar from './sidebar'
import TopBar from './topbar'

interface AppShellProps {
  businessName: string
  totalTx: number
  skor: number
  userEmail: string
  userName: string
  children: React.ReactNode
}

export default function AppShell({
  businessName,
  totalTx,
  skor,
  userEmail,
  userName,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="app-layout">
      <Sidebar
        businessName={businessName}
        totalTx={totalTx}
        skor={skor}
        userEmail={userEmail}
        userName={userName}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="main-content" id="main-content">
        <TopBar
          businessName={businessName}
          userName={userName}
          userEmail={userEmail}
          onToggleMobileMenu={() => setMobileOpen(!mobileOpen)}
        />
        {children}
      </div>
    </div>
  )
}
