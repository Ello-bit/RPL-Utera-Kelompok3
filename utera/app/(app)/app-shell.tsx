'use client'

import { Fragment, useCallback, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from './sidebar'
import TopBar from './topbar'
import CatatKasModal from './catat-kas/catat-kas-modal'
import { gulirKeCatatKas } from './catat-kas/catat-kas-form'
import KonfirmasiHapus from './catat-kas/konfirmasi-hapus'
import { createClient } from '@/lib/supabase/client'
import { hapusTransaksi } from '@/lib/hapus-transaksi'
import type { Tables } from '@/lib/database.types'

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
  const router = useRouter()

  // Tombol "Catat Kas" di kanan atas: di Buku Kas Warung langsung gulir ke formulirnya,
  // di halaman lain buka pop-up dengan formulir yang sama.
  const [catatKasOpen, setCatatKasOpen] = useState(false)
  // Dinaikkan setelah menyimpan dari pop-up, supaya isi halaman dimuat ulang dengan data terbaru
  const [versiData, setVersiData] = useState(0)
  const [toast, setToast] = useState<{ teks: string; aksi?: () => void } | null>(null)
  // Transaksi dari pop-up yang diminta dihapus (menunggu konfirmasi)
  const [hapusKas, setHapusKas] = useState<Tables<'transaksi_kas'> | null>(null)
  const [menghapus, setMenghapus] = useState(false)

  const bukaCatatKas = () => {
    if (pathname === '/buku-kas' && gulirKeCatatKas()) return
    setCatatKasOpen(true)
  }
  const tutupCatatKas = useCallback(() => setCatatKasOpen(false), [])
  const tampilkanToast = useCallback((teks: string, aksi?: () => void) => {
    setToast({ teks, aksi })
    // Toast yang punya tombol aksi tampil lebih lama supaya sempat ditekan
    window.setTimeout(() => setToast(null), aksi ? 8000 : 3000)
  }, [])

  const setelahSimpanKas = useCallback(
    (tx: Tables<'transaksi_kas'>) => {
      setCatatKasOpen(false)
      setVersiData((v) => v + 1)
      tampilkanToast('Transaksi kas berhasil disimpan.', () => setHapusKas(tx))
    },
    [tampilkanToast]
  )

  const konfirmasiHapusKas = async () => {
    if (!hapusKas) return
    setMenghapus(true)
    const err = await hapusTransaksi(createClient(), hapusKas)
    setMenghapus(false)
    if (err) {
      tampilkanToast('Gagal menghapus: ' + err)
      return
    }
    setHapusKas(null)
    setVersiData((v) => v + 1)
    router.refresh() // perbarui jumlah transaksi dan skor di menu samping
    tampilkanToast('Transaksi berhasil dihapus.')
  }

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
          {toast.teks}
          {toast.aksi && (
            <button type="button" className="toast-aksi" onClick={toast.aksi}>
              Salah catat? Hapus
            </button>
          )}
        </div>
      )}
      {hapusKas && (
        <KonfirmasiHapus
          tx={hapusKas}
          menghapus={menghapus}
          onBatal={() => setHapusKas(null)}
          onHapus={konfirmasiHapusKas}
        />
      )}
    </div>
  )
}

