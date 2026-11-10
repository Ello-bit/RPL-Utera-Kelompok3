'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DEMO_PROFILES } from '@/lib/demo-seed'
import { Tables } from '@/lib/database.types'

type ProfilUsaha = Tables<'profil_usaha'>

const SECTORS = [
  'Kuliner & F&B',
  'Perdagangan & Retail',
  'Jasa & Layanan',
  'Pertanian & Peternakan',
  'Konveksi & Fashion',
  'Kerajinan & Kriya',
  'Lainnya',
]

export default function ProfilUsahaPage() {
  const supabase = createClient()
  const [profiles, setProfiles] = useState<ProfilUsaha[]>([])
  const [activeProfile, setActiveProfile] = useState<Partial<ProfilUsaha>>({
    nama_usaha: '',
    nama_pemilik: '',
    jenis_usaha: 'Kuliner & F&B',
    tanggal_mulai_usaha: '',
    nomor_telepon: '',
    alamat_usaha: '',
    deskripsi_usaha: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isGuest, setIsGuest] = useState(false)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setIsGuest(true)
        setProfiles(DEMO_PROFILES)
        if (DEMO_PROFILES.length > 0) {
          setActiveProfile(DEMO_PROFILES[0])
        }
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('profil_usaha')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching profil_usaha:', error)
      } else if (data && data.length > 0) {
        setProfiles(data as ProfilUsaha[])
        setActiveProfile(data[0] as ProfilUsaha)
      } else {
        // User doesn't have a profile yet, initialize with default user metadata
        const defaultName = (user.user_metadata?.full_name as string) || ''
        setActiveProfile({
          nama_usaha: '',
          nama_pemilik: defaultName,
          jenis_usaha: 'Kuliner & F&B',
          tanggal_mulai_usaha: '',
          nomor_telepon: '',
          alamat_usaha: '',
          deskripsi_usaha: '',
        })
      }
      setLoading(false)
    }

    loadData()
  }, [])

  // Calculate completeness percentage (0-100%)
  const fields = [
    activeProfile.nama_usaha,
    activeProfile.nama_pemilik,
    activeProfile.jenis_usaha,
    activeProfile.tanggal_mulai_usaha,
    activeProfile.nomor_telepon,
    activeProfile.alamat_usaha,
    activeProfile.deskripsi_usaha,
  ]
  const filledCount = fields.filter((f) => f && String(f).trim().length > 0).length
  const completenessPct = Math.round((filledCount / fields.length) * 100)

  // Calculate business age for KUR eligibility (min 6 months)
  let kurEligible = false
  let kurAgeMonths = 0
  if (activeProfile.tanggal_mulai_usaha) {
    const start = new Date(activeProfile.tanggal_mulai_usaha)
    const now = new Date()
    kurAgeMonths =
      (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth())
    kurEligible = kurAgeMonths >= 6
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (!activeProfile.nama_usaha?.trim()) {
      setMessage({ type: 'error', text: 'Nama usaha wajib diisi.' })
      return
    }
    if (!activeProfile.nama_pemilik?.trim()) {
      setMessage({ type: 'error', text: 'Nama pemilik wajib diisi.' })
      return
    }

    if (isGuest) {
      setMessage({
        type: 'success',
        text: 'Mode Demo: Perubahan profil tersimpan sementara di memori.',
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        nama_usaha: activeProfile.nama_usaha.trim(),
        nama_pemilik: activeProfile.nama_pemilik.trim(),
        jenis_usaha: activeProfile.jenis_usaha || 'Kuliner & F&B',
        tanggal_mulai_usaha: activeProfile.tanggal_mulai_usaha || null,
        nomor_telepon: activeProfile.nomor_telepon?.trim() || null,
        alamat_usaha: activeProfile.alamat_usaha?.trim() || null,
        deskripsi_usaha: activeProfile.deskripsi_usaha?.trim() || null,
      }

      if (activeProfile.id) {
        // Update existing profile
        const { error } = await supabase
          .from('profil_usaha')
          .update(payload)
          .eq('id', activeProfile.id)

        if (error) throw error
        setMessage({ type: 'success', text: 'Profil usaha berhasil diperbarui!' })
      } else {
        // Insert new profile
        const { data, error } = await supabase
          .from('profil_usaha')
          .insert(payload)
          .select()
          .single()

        if (error) throw error
        const created = data as ProfilUsaha
        setProfiles([created, ...profiles])
        setActiveProfile(created)
        setMessage({ type: 'success', text: 'Profil usaha baru berhasil didaftarkan!' })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan profil.'
      setMessage({ type: 'error', text: msg })
    } finally {
      setSaving(false)
    }
  }

  const handleCreateNew = () => {
    setActiveProfile({
      nama_usaha: '',
      nama_pemilik: '',
      jenis_usaha: 'Kuliner & F&B',
      tanggal_mulai_usaha: '',
      nomor_telepon: '',
      alamat_usaha: '',
      deskripsi_usaha: '',
    })
    setMessage(null)
  }

  return (
    <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
            Profil Usaha
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Kelola identitas dan legalitas usaha Anda sebagai dasar kelayakan KUR dan laporan bank.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={handleCreateNew}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>add</span>
            Tambah Usaha
          </button>
        </div>
      </div>

      {/* Notice Message */}
      {message && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '8px',
            background: message.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            color: message.type === 'success' ? '#065F46' : '#991B1B',
            border: `1px solid ${message.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          <span className="material-symbols-rounded">
            {message.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{message.text}</span>
        </div>
      )}

      {/* Profile Overview Card */}
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          padding: '24px',
          marginBottom: '24px',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: '24px',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'var(--primary-soft)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.75rem',
            fontWeight: 800,
          }}
        >
          {activeProfile.nama_usaha ? activeProfile.nama_usaha.slice(0, 2).toUpperCase() : 'UT'}
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
            {activeProfile.nama_usaha || 'Nama Usaha Belum Diisi'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '8px' }}>
            Pemilik: {activeProfile.nama_pemilik || 'Belum diisi'} • {activeProfile.jenis_usaha || 'Sektor belum dipilih'}
          </p>
          {/* Progress Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, maxWidth: '240px', height: '8px', background: '#E6EDE9', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${completenessPct}%`,
                  height: '100%',
                  background: completenessPct >= 80 ? 'var(--emerald)' : 'var(--primary)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>
              Kelengkapan: {completenessPct}%
            </span>
          </div>
        </div>

        {/* Switcher if multiple profiles exist */}
        {profiles.length > 1 && (
          <div style={{ textAlign: 'right' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
              Ganti Usaha
            </label>
            <select
              value={activeProfile.id || ''}
              onChange={(e) => {
                const found = profiles.find((p) => p.id === e.target.value)
                if (found) setActiveProfile(found)
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.875rem',
                fontWeight: 600,
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama_usaha}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* KUR Eligibility Banner */}
      <div
        style={{
          background: kurEligible ? '#ECFDF5' : '#FEF7EC',
          border: `1px solid ${kurEligible ? '#A7F3D0' : '#FDE68A'}`,
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <span
          className="material-symbols-rounded"
          style={{ fontSize: '28px', color: kurEligible ? '#059669' : '#D97706' }}
        >
          {kurEligible ? 'verified' : 'info'}
        </span>
        <div style={{ flex: 1 }}>
          <strong style={{ display: 'block', color: kurEligible ? '#065F46' : '#92400E', fontSize: '0.9rem' }}>
            {kurEligible
              ? `Usaha Memenuhi Syarat Durasi Operasional KUR (${kurAgeMonths} bulan)`
              : 'Syarat Minimal Usaha Berjalan untuk KUR adalah 6 Bulan'}
          </strong>
          <small style={{ color: kurEligible ? '#047857' : '#B45309', fontSize: '0.8rem' }}>
            {kurEligible
              ? 'Bank mensyaratkan durasi usaha aktif minimal 6 bulan berturut-turut untuk mengajukan KUR Mikro / Super Mikro.'
              : 'Lengkapi tanggal mulai usaha Anda. Jika usaha telah berjalan lebih dari 6 bulan, status kelayakan akan otomatis aktif.'}
          </small>
        </div>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSave} style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '28px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-rounded" style={{ color: 'var(--primary)' }}>store</span>
          Informasi Usaha
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '6px' }}>
              Nama Usaha <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Kopi Nusantara"
              value={activeProfile.nama_usaha || ''}
              onChange={(e) => setActiveProfile({ ...activeProfile, nama_usaha: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '6px' }}>
              Nama Pemilik Usaha <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Sesuai KTP"
              value={activeProfile.nama_pemilik || ''}
              onChange={(e) => setActiveProfile({ ...activeProfile, nama_pemilik: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '6px' }}>
              Sektor / Jenis Usaha
            </label>
            <select
              value={activeProfile.jenis_usaha || 'Kuliner & F&B'}
              onChange={(e) => setActiveProfile({ ...activeProfile, jenis_usaha: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem', outline: 'none', background: '#fff' }}
            >
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '6px' }}>
              Tanggal Mulai Usaha
            </label>
            <input
              type="date"
              value={activeProfile.tanggal_mulai_usaha || ''}
              onChange={(e) => setActiveProfile({ ...activeProfile, tanggal_mulai_usaha: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '6px' }}>
              Nomor Telepon / WhatsApp
            </label>
            <input
              type="tel"
              placeholder="081234567890"
              value={activeProfile.nomor_telepon || ''}
              onChange={(e) => setActiveProfile({ ...activeProfile, nomor_telepon: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem', outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '6px' }}>
            Alamat Operasional Usaha
          </label>
          <textarea
            rows={2}
            placeholder="Jalan, No, Kelurahan, Kecamatan, Kota/Kabupaten"
            value={activeProfile.alamat_usaha || ''}
            onChange={(e) => setActiveProfile({ ...activeProfile, alamat_usaha: e.target.value })}
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem', outline: 'none', resize: 'vertical' }}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '6px' }}>
            Deskripsi Singkat Usaha (Untuk Narasi Proposal Bank)
          </label>
          <textarea
            rows={3}
            placeholder="Jelaskan produk utama, target pasar, atau model operasional usaha..."
            value={activeProfile.deskripsi_usaha || ''}
            onChange={(e) => setActiveProfile({ ...activeProfile, deskripsi_usaha: e.target.value })}
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem', outline: 'none', resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="submit"
            disabled={saving || loading}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
              {saving ? 'hourglass_top' : 'save'}
            </span>
            <span>{saving ? 'Menyimpan...' : 'Simpan Profil'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
