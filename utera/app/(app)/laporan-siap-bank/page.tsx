'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getActiveProfilId, pickActiveProfile } from '@/lib/profil-aktif'
import { DEMO_PROFILES, DEMO_TRANSACTIONS } from '@/lib/demo-seed'
import { Tables } from '@/lib/database.types'
import { calculateKasSummary, getMonthlyBreakdown, formatRupiah } from '@/lib/kas'
import { calculateSkorPRD } from '@/lib/skor'
import { evaluateLegalitas } from '@/lib/legalitas'
import './laporan.css'

type ProfilUsaha = Tables<'profil_usaha'>
type TransaksiKas = Tables<'transaksi_kas'>
type LegalitasDokumen = Tables<'legalitas_dokumen'>

export default function LaporanSiapBankPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<ProfilUsaha | null>(null)
  const [transactions, setTransactions] = useState<TransaksiKas[]>([])
  const [legalDocs, setLegalDocs] = useState<LegalitasDokumen[]>([])
  const [loading, setLoading] = useState(true)
  const [isGuest, setIsGuest] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'preview'>('preview')

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setIsGuest(true)
        setProfile(DEMO_PROFILES[0])
        setTransactions(DEMO_TRANSACTIONS)
        setLegalDocs([
          {
            id: 'doc-nib',
            user_id: 'guest',
            profil_id: null,
            kategori: 'NIB',
            nama_dokumen: 'Nomor Induk Berusaha (NIB)',
            nomor_dokumen: '1234567890123',
            tanggal_terbit: '2025-02-15',
            masa_berlaku: null,
            file_url: null,
            created_at: new Date().toISOString(),
          },
          {
            id: 'doc-npwp',
            user_id: 'guest',
            profil_id: null,
            kategori: 'NPWP',
            nama_dokumen: 'NPWP Pemilik Usaha',
            nomor_dokumen: '98.765.432.1-012.000',
            tanggal_terbit: '2024-05-10',
            masa_berlaku: null,
            file_url: null,
            created_at: new Date().toISOString(),
          },
        ])
        setLoading(false)
        return
      }

      // Fetch Profile
      const { data: profs } = await supabase
        .from('profil_usaha')
        .select('*')
        .order('created_at', { ascending: false })

      let activeProfilId: string | null = null
      if (profs && profs.length > 0) {
        const picked = pickActiveProfile(profs, getActiveProfilId())!
        activeProfilId = picked.id
        setProfile(picked as ProfilUsaha)
      } else {
        const fullName = (user.user_metadata?.full_name as string) || ''
        let initialNamaUsaha = 'Usaha Mandiri'
        let initialNamaPemilik = 'Pemilik Usaha'
        if (fullName.includes('-')) {
          const parts = fullName.split('-').map((s) => s.trim())
          initialNamaPemilik = parts[0] || 'Pemilik Usaha'
          initialNamaUsaha = parts[1] || 'Usaha Mandiri'
        } else if (fullName) {
          initialNamaPemilik = fullName
          initialNamaUsaha = `Usaha ${fullName}`
        }

        setProfile({
          id: 'temp',
          user_id: user.id,
          nama_usaha: initialNamaUsaha,
          nama_pemilik: initialNamaPemilik,
          jenis_usaha: 'Kuliner & F&B',
          tanggal_mulai_usaha: null,
          alamat_usaha: null,
          nomor_telepon: null,
          deskripsi_usaha: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }

      // Fetch Transactions
      let txQuery = supabase.from('transaksi_kas').select('*')
      if (activeProfilId) txQuery = txQuery.eq('profil_id', activeProfilId)
      const { data: txs } = await txQuery.order('tanggal', { ascending: false })

      if (txs) setTransactions(txs as TransaksiKas[])

      // Fetch Legalitas
      let docsQuery = supabase.from('legalitas_dokumen').select('*')
      if (activeProfilId) docsQuery = docsQuery.eq('profil_id', activeProfilId)
      const { data: docs } = await docsQuery

      if (docs) setLegalDocs(docs as LegalitasDokumen[])

      setLoading(false)
    }

    loadData()
  }, [])

  const kasSummary = calculateKasSummary(transactions)
  const skor = calculateSkorPRD(transactions, isGuest)
  const legalitas = evaluateLegalitas(legalDocs)
  const monthly = getMonthlyBreakdown(transactions, 6)

  const handlePrint = () => {
    window.print()
  }

  return (
    <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto' }}>
      {/* Header Controls */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
            Laporan Siap Bank
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Kompilasi formal profil usaha, arus kas riil, skor kelayakan KUR, dan status legalitas untuk analis bank.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handlePrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '8px',
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>print</span>
            <span>Cetak / Ekspor PDF</span>
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('preview')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'preview' ? 'var(--primary)' : '#fff',
            color: activeTab === 'preview' ? '#fff' : 'var(--text-body)',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>description</span>
          <span>Pratinjau Dokumen A4</span>
        </button>
        <button
          onClick={() => setActiveTab('dashboard')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'dashboard' ? 'var(--primary)' : '#fff',
            color: activeTab === 'dashboard' ? '#fff' : 'var(--text-body)',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>dashboard</span>
          <span>Ringkasan 4 Pilar</span>
        </button>
      </div>

      {/* View: Tab Dashboard */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '28px' }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Pilar 1: Profil Usaha
            </span>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '6px' }}>
              {profile?.nama_usaha || 'Belum diisi'}
            </div>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Pemilik: {profile?.nama_pemilik || '-'}
            </small>
          </div>

          <div style={{ background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Pilar 2: Total Omzet Terverifikasi
            </span>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10B981', marginTop: '6px' }}>
              {formatRupiah(kasSummary.totalIncome)}
            </div>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Laba Bersih: {formatRupiah(kasSummary.netProfit)}
            </small>
          </div>

          <div style={{ background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Pilar 3: Skor Kelayakan Bank
            </span>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)', marginTop: '6px' }}>
              {skor.total} / 100 ({skor.badgeLabel})
            </div>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Kategori: {skor.category}
            </small>
          </div>

          <div style={{ background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Pilar 4: Status Legalitas
            </span>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: legalitas.pct >= 75 ? '#10B981' : '#C98A1B', marginTop: '6px' }}>
              {legalitas.pct}% Lengkap
            </div>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              {legalitas.completed} dari {legalitas.total} berkas
            </small>
          </div>
        </div>
      )}

      {/* View: Document A4 Printable Sheet */}
      <div
        id="printable-report"
        style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          padding: '48px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        }}
      >
        {/* Report Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--primary)', paddingBottom: '20px', marginBottom: '28px' }}>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '1px', textTransform: 'uppercase' }}>
              UTERA FINANCIAL REPORT
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
              LAPORAN KELAYAKAN USAHA &amp; ARUS KAS
            </div>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Dokumen resmi kesiapan kredit perbankan mitra (Standar PRD UTERA)
            </small>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tanggal Diterbitkan:</div>
            <strong style={{ fontSize: '0.85rem' }}>
              {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </strong>
          </div>
        </div>

        {/* Section 1: Profil Usaha */}
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
            1. Identitas Usaha &amp; Pemilik
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Nama Usaha: </span>
              <strong>{profile?.nama_usaha || '-'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Nama Pemilik: </span>
              <strong>{profile?.nama_pemilik || '-'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Sektor Usaha: </span>
              <strong>{profile?.jenis_usaha || '-'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Tanggal Mulai: </span>
              <strong>{profile?.tanggal_mulai_usaha || '-'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Nomor Telepon: </span>
              <strong>{profile?.nomor_telepon || '-'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Alamat: </span>
              <strong>{profile?.alamat_usaha || '-'}</strong>
            </div>
          </div>
        </div>

        {/* Section 2: Ringkasan Arus Kas */}
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
            2. Ringkasan Finansial Kasir Warung
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '16px' }}>
            <div style={{ padding: '12px', background: '#F8FAF9', borderRadius: '8px' }}>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Total Omzet:</small>
              <div style={{ fontWeight: 800, color: '#10B981', fontSize: '1.05rem', marginTop: '2px' }}>
                {formatRupiah(kasSummary.totalIncome)}
              </div>
            </div>
            <div style={{ padding: '12px', background: '#F8FAF9', borderRadius: '8px' }}>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Total Beban Biaya:</small>
              <div style={{ fontWeight: 800, color: '#B5532F', fontSize: '1.05rem', marginTop: '2px' }}>
                {formatRupiah(kasSummary.totalExpense)}
              </div>
            </div>
            <div style={{ padding: '12px', background: '#F8FAF9', borderRadius: '8px' }}>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Laba Bersih Riil:</small>
              <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.05rem', marginTop: '2px' }}>
                {formatRupiah(kasSummary.netProfit)}
              </div>
            </div>
            <div style={{ padding: '12px', background: '#F8FAF9', borderRadius: '8px' }}>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Margin Keuntungan:</small>
              <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1.05rem', marginTop: '2px' }}>
                {kasSummary.marginPct}%
              </div>
            </div>
          </div>

          {/* Monthly Table */}
          {monthly.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F1F5F3', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '8px 12px' }}>Bulan</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Pemasukan</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Pengeluaran</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Laba Bersih</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m) => (
                  <tr key={m.key} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{m.label}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#10B981' }}>{formatRupiah(m.pemasukan)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#B5532F' }}>{formatRupiah(m.pengeluaran)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{formatRupiah(m.labaBersih)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Section 3: Skor Kelayakan & Legalitas */}
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
            3. Rekomendasi Kelayakan Bank &amp; Dokumen
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '0.85rem' }}>
            <div style={{ padding: '16px', background: '#F8FAF9', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Skor Kelayakan Kredit UTERA:</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary)', margin: '4px 0' }}>
                {skor.total} / 100 ({skor.badgeLabel})
              </div>
              <p style={{ color: 'var(--text-body)', fontSize: '0.8rem', lineHeight: 1.4 }}>
                Berdasarkan konsistensi pencatatan {skor.k1.score}/30 poin dan tren omzet {skor.k2.score}/25 poin.
              </p>
            </div>

            <div style={{ padding: '16px', background: '#F8FAF9', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status Legalitas Dokumen:</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: legalitas.pct >= 75 ? '#10B981' : '#C98A1B', margin: '4px 0' }}>
                {legalitas.pct}% Terverifikasi
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', fontSize: '0.8rem' }}>
                {legalDocs.map((d) => (
                  <li key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    {d.nomor_dokumen || d.file_url ? (
                      <span style={{ color: '#10B981' }} aria-label="Lengkap">✓</span>
                    ) : (
                      <span style={{ color: '#B5532F' }} aria-label="Belum lengkap">✗</span>
                    )}
                    <span>{d.nama_dokumen}: {d.nomor_dokumen || '-'}</span>
                  </li>
                ))}
                {legalDocs.length === 0 && (
                  <li style={{ color: 'var(--text-muted)' }}>Belum ada berkas terunggah.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

