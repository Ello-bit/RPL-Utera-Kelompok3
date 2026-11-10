import { cookies } from 'next/headers'
import { isAdminUser } from '@/lib/auth'
import { calculateSkorPRD } from '@/lib/skor'
import { PROFIL_COOKIE, pickActiveProfile } from '@/lib/profil-aktif'
import { createClient } from '@/lib/supabase/server'
import { DEMO_PROFILES, DEMO_TRANSACTIONS } from '@/lib/demo-seed'
import { Tables } from '@/lib/database.types'
import AppShell from './app-shell'
import './app-layout.css'

export const dynamic = 'force-dynamic'

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let businessName = 'Kopi Nusantara'
  let totalTx = 0
  let skor = 0
  let userEmail = user?.email || 'Tamu (Demo Mode)'
  let userName = (user?.user_metadata?.full_name as string) || ''

  let isAdmin = false
  if (user) {
    if (isAdminUser(user)) {
      isAdmin = true
      businessName = 'Ekosistem UMKM UTERA'
      userName = 'Administrator'
    } else {
      // 1. Fetch live profil usaha
      const { data: profiles } = await supabase
        .from('profil_usaha')
        .select('*')
        .order('created_at', { ascending: false })

      const cookieStore = await cookies()
      const activeId = cookieStore.get(PROFIL_COOKIE)?.value ?? null
      const firstProfile = pickActiveProfile(
        (profiles ?? []) as Tables<'profil_usaha'>[],
        activeId
      )
      if (firstProfile) {
        businessName = firstProfile.nama_usaha
        if (firstProfile.nama_pemilik) userName = firstProfile.nama_pemilik
      }

      // 2. Transaksi usaha aktif -> jumlah transaksi dan skor (rumus PRD yang sama dengan halaman skor)
      let txQuery = supabase.from('transaksi_kas').select('*')
      if (firstProfile) txQuery = txQuery.eq('profil_id', firstProfile.id)
      const { data: txList } = await txQuery
      if (txList) {
        const typedTx = txList as Tables<'transaksi_kas'>[]
        totalTx = typedTx.length
        skor = calculateSkorPRD(typedTx).total
      }
    }
  } else {
    // Guest Demo fallback
    businessName = DEMO_PROFILES[0].nama_usaha
    userName = DEMO_PROFILES[0].nama_pemilik || 'Budi Santoso'
    totalTx = DEMO_TRANSACTIONS.length
    skor = calculateSkorPRD(DEMO_TRANSACTIONS, true).total
  }

  return (
    <AppShell
      businessName={businessName}
      totalTx={totalTx}
      skor={skor}
      userEmail={userEmail}
      userName={userName}
      isAdmin={isAdmin}
    >
      {children}
    </AppShell>
  )
}
