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

  if (user) {
    // 1. Fetch live profil usaha
    const { data: profiles } = await supabase
      .from('profil_usaha')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)

    const firstProfile = profiles && profiles[0] ? (profiles[0] as Tables<'profil_usaha'>) : null
    if (firstProfile) {
      businessName = firstProfile.nama_usaha
      if (firstProfile.nama_pemilik) userName = firstProfile.nama_pemilik
    }

    // 2. Fetch live transactions to calculate count and PRD score
    const { data: txList } = await supabase
      .from('transaksi_kas')
      .select('*')

    if (txList) {
      const typedTx = txList as Tables<'transaksi_kas'>[]
      totalTx = typedTx.length
      if (totalTx > 0) {
        let inc = 0
        let exp = 0
        typedTx.forEach((t) => {
          if (t.tipe === 'pemasukan') inc += Number(t.nominal)
          else exp += Number(t.nominal)
        })
        if (inc > 0) {
          const margin = (inc - exp) / inc
          skor = Math.min(96, Math.max(40, Math.round(50 + margin * 45)))
        } else {
          skor = 50
        }
      }
    }
  } else {
    // Guest Demo fallback
    businessName = DEMO_PROFILES[0].nama_usaha
    userName = DEMO_PROFILES[0].nama_pemilik || 'Budi Santoso'
    totalTx = DEMO_TRANSACTIONS.length
    let inc = 0
    let exp = 0
    DEMO_TRANSACTIONS.forEach((t) => {
      if (t.tipe === 'pemasukan') inc += t.nominal
      else exp += t.nominal
    })
    const margin = (inc - exp) / inc
    skor = Math.min(96, Math.max(40, Math.round(50 + margin * 45)))
  }

  return (
    <AppShell
      businessName={businessName}
      totalTx={totalTx}
      skor={skor}
      userEmail={userEmail}
      userName={userName}
    >
      {children}
    </AppShell>
  )
}
