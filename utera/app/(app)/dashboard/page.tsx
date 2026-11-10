import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DEMO_TRANSACTIONS, DEMO_PROFILES } from '@/lib/demo-seed'
import { Tables } from '@/lib/database.types'
import { calculateKasSummary, getMonthlyBreakdown, getCategoryDistribution, formatRupiah } from '@/lib/kas'
import { calculateSkorPRD } from '@/lib/skor'
import { evaluateGuardrail } from '@/lib/kur'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let transactions: Tables<'transaksi_kas'>[] = []
  let profileName = 'Kopi Nusantara'
  let businessRole = 'Pemilik Usaha'
  const isGuest = !user

  if (user) {
    const { data: profs } = await supabase
      .from('profil_usaha')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)

    const firstProf = profs && profs[0] ? (profs[0] as Tables<'profil_usaha'>) : null
    if (firstProf) {
      profileName = firstProf.nama_usaha
      if (firstProf.jenis_usaha) businessRole = firstProf.jenis_usaha
    } else if (user.user_metadata?.full_name) {
      profileName = `Usaha ${user.user_metadata.full_name}`
    } else {
      profileName = 'Usaha Baru'
    }

    const { data: txList } = await supabase
      .from('transaksi_kas')
      .select('*')
      .order('tanggal', { ascending: false })

    if (txList) transactions = txList as Tables<'transaksi_kas'>[]
  } else {
    profileName = DEMO_PROFILES[0].nama_usaha
    businessRole = DEMO_PROFILES[0].jenis_usaha || 'UMKM Kuliner'
    transactions = DEMO_TRANSACTIONS
  }

  // Calculate kas summary
  const kasSummary = calculateKasSummary(transactions)
  // Calculate score PRD
  const skorResult = calculateSkorPRD(transactions, isGuest)
  // Calculate guardrail (30% of profit)
  const guardrail = evaluateGuardrail(2_216_000, kasSummary.netProfit)
  // Monthly breakdown for chart
  const monthlyData = getMonthlyBreakdown(transactions, 5)
  // Distribution by category
  const categories = getCategoryDistribution(transactions, 'pemasukan')
  // Top 5 recent transactions
  const recentTransactions = transactions.slice(0, 5)

  // Max value for monthly chart scaling
  const maxMonthlyVal = Math.max(
    ...monthlyData.map((m) => Math.max(m.pemasukan, m.pengeluaran)),
    1
  )

  return (
    <>
      {/* Top Sticky App Bar */}
      <header className="top-bar">
        <div className="top-bar-left">
          <div className="search-box">
            <span className="material-symbols-rounded">search</span>
            <input
              type="text"
              placeholder="Cari transaksi kas, kategori, atau fitur..."
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.875rem' }}
            />
          </div>
        </div>
        <div className="top-bar-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/buku-kas" className="btn btn-primary btn-sm">
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>add</span>
            <span>Catat Kas</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              className="user-avatar-circle"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.875rem',
              }}
            >
              {profileName.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <strong style={{ fontSize: '0.85rem' }}>{profileName}</strong>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{businessRole}</small>
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard Workspace */}
      <main className="dashboard-content" style={{ padding: '28px' }}>
        <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
              Dashboard Finansial
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Pantau arus kas riil warung harian, indikator kelayakan KUR, dan guardrail beban cicilan.
            </p>
          </div>
          {isGuest && (
            <span
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                background: '#FEF3CD',
                color: '#92400E',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: '1px solid #FDE68A',
              }}
            >
              Mode Tamu (Read-Only)
            </span>
          )}
        </div>

        {/* 4 Primary Metric Cards */}
        <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '28px' }}>
          <div className="metric-card" style={{ background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Saldo Kas Operasional
            </span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: kasSummary.saldoKas >= 0 ? 'var(--text-main)' : '#DC2626', margin: '8px 0 4px' }}>
              {formatRupiah(kasSummary.saldoKas)}
            </div>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Saldo riil kasir & rekening kas saat ini
            </small>
          </div>

          <div className="metric-card" style={{ background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Pemasukan (Omzet)
            </span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10B981', margin: '8px 0 4px' }}>
              {formatRupiah(kasSummary.totalIncome)}
            </div>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Total omzet dari {kasSummary.count} transaksi kas
            </small>
          </div>

          <div className="metric-card" style={{ background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Pengeluaran Biaya & Kulakan
            </span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#B5532F', margin: '8px 0 4px' }}>
              {formatRupiah(kasSummary.totalExpense)}
            </div>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Belanja bahan baku, sewa, listrik & gaji
            </small>
          </div>

          <div className="metric-card" style={{ background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Skor Kelayakan Bank (PRD)
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: skorResult.badgeBg,
                  color: skorResult.badgeColor,
                }}
              >
                {skorResult.badgeLabel}
              </span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', margin: '8px 0 4px' }}>
              {skorResult.total}
              <small style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>/100</small>
            </div>
            <Link href="/skor-kelayakan" style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span>Buka Analisis Skor</span>
              <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>arrow_forward</span>
            </Link>
          </div>
        </div>

        {/* Middle Section: Cashflow Chart & Guardrail Card */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '28px' }}>
          {/* Cashflow Chart Card */}
          <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                  Grafik Arus Kas Bulanan
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Perbandingan pemasukan, pengeluaran, dan laba bersih
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#1F6B4F' }} />
                  Pemasukan
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#D1E7DC' }} />
                  Pengeluaran
                </span>
              </div>
            </div>

            {monthlyData.length === 0 ? (
              <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '36px', color: 'var(--text-light)', display: 'block', marginBottom: '8px' }}>
                  bar_chart
                </span>
                Belum ada data bulanan. Catat transaksi untuk menampilkan grafik.
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '180px', paddingTop: '20px', borderBottom: '1px solid var(--border-subtle)' }}>
                {monthlyData.map((m) => {
                  const hIn = Math.round((m.pemasukan / maxMonthlyVal) * 130)
                  const hOut = Math.round((m.pengeluaran / maxMonthlyVal) * 130)
                  return (
                    <div key={m.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '130px' }}>
                        <div
                          title={`Pemasukan: ${formatRupiah(m.pemasukan)}`}
                          style={{
                            width: '24px',
                            height: `${Math.max(6, hIn)}px`,
                            background: '#1F6B4F',
                            borderRadius: '4px 4px 0 0',
                            transition: 'height 0.3s ease',
                          }}
                        />
                        <div
                          title={`Pengeluaran: ${formatRupiah(m.pengeluaran)}`}
                          style={{
                            width: '24px',
                            height: `${Math.max(6, hOut)}px`,
                            background: '#D1E7DC',
                            borderRadius: '4px 4px 0 0',
                            transition: 'height 0.3s ease',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {m.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Margin Laba Usaha:{' '}
                <strong style={{ color: kasSummary.marginPct >= 20 ? '#10B981' : '#B5532F' }}>
                  {kasSummary.marginPct}%
                </strong>
              </span>
              <Link href="/buku-kas" style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>
                Kelola di Buku Kas →
              </Link>
            </div>
          </div>

          {/* Guardrail 30% Card */}
          <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                  Guardrail Cicilan 30%
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Batas aman angsuran kredit kas UMKM
                </p>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '12px',
                  background: guardrail.isSafe ? '#ECFDF5' : '#FEF2F2',
                  color: guardrail.color,
                }}
              >
                {guardrail.statusText}
              </span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}>
                Kapasitas Cicilan Maksimal
              </small>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                {formatRupiah(guardrail.guardrailLimit)}
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)' }}> / bln</span>
              </div>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                30% dari laba bersih ({formatRupiah(kasSummary.netProfit)})
              </small>
            </div>

            {/* Simulated Loan Examples */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#F8FAF9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.85rem' }}>Simulasi KUR BRI 6%</strong>
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Plafon Rp 50 Juta • Tenor 24 Bln</small>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>Rp 2.216.000/bln</strong>
                  <small style={{ display: 'block', color: '#10B981', fontSize: '0.7rem', fontWeight: 600 }}>
                    ✓ Masuk Batas Kas
                  </small>
                </div>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#F8FAF9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.85rem' }}>Pinjaman Koperasi Usaha</strong>
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Plafon Rp 25 Juta • Tenor 12 Bln</small>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>Rp 2.291.000/bln</strong>
                  <small style={{ display: 'block', color: '#10B981', fontSize: '0.7rem', fontWeight: 600 }}>
                    ✓ Masuk Batas Kas
                  </small>
                </div>
              </div>
            </div>

            <Link
              href="/guardrail"
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-body)',
                fontWeight: 600,
                fontSize: '0.825rem',
                textDecoration: 'none',
              }}
            >
              Buka Simulator Guardrail Lengkap
            </Link>
          </div>
        </div>

        {/* Bottom Section: Recent Transactions & Category Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          {/* Recent Transactions Card */}
          <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                  Buku Kas: Transaksi Terakhir
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Catatan kasir yang terhubung langsung ke laporan keuangan
                </p>
              </div>
              <Link href="/buku-kas" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                + Catat Baru
              </Link>
            </div>

            {recentTransactions.length === 0 ? (
              <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                Belum ada transaksi tercatat.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 0' }}>Tanggal</th>
                    <th style={{ padding: '10px 0' }}>Keterangan</th>
                    <th style={{ padding: '10px 0' }}>Kategori</th>
                    <th style={{ padding: '10px 0', textAlign: 'right' }}>Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((tx) => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px 0', fontWeight: 600 }}>{tx.tanggal}</td>
                      <td style={{ padding: '12px 0' }}>{tx.keterangan || '-'}</td>
                      <td style={{ padding: '12px 0' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            background: tx.tipe === 'pemasukan' ? '#ECFDF5' : '#FEF2F2',
                            color: tx.tipe === 'pemasukan' ? '#065F46' : '#991B1B',
                          }}
                        >
                          {tx.kategori}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '12px 0',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: tx.tipe === 'pemasukan' ? '#10B981' : '#B5532F',
                        }}
                      >
                        {tx.tipe === 'pemasukan' ? '+ ' : '- '}
                        {formatRupiah(Number(tx.nominal))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Distribution by Category */}
          <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
              Distribusi Pemasukan
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '16px' }}>
              Sumber omzet per kategori produk
            </p>

            {categories.length === 0 ? (
              <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Belum ada data kategori.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {categories.map((c) => (
                  <div key={c.category}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600 }}>{c.category}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{c.pct}%</span>
                    </div>
                    <div style={{ height: '6px', background: '#F1F5F3', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${c.pct}%`,
                          height: '100%',
                          background: 'var(--primary)',
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
