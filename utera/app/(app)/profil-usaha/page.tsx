'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getActiveProfilId, setActiveProfilId, pickActiveProfile } from '@/lib/profil-aktif'
import { calculateSkorPRD } from '@/lib/skor'
import { DEMO_PROFILES, DEMO_TRANSACTIONS } from '@/lib/demo-seed'
import { Tables, TablesInsert } from '@/lib/database.types'
import {
  VerificationRequest,
  fetchVerificationByProfil,
  submitVerificationRequest,
} from '@/lib/verification'
import './profil-usaha.css'

type ProfilUsaha = Tables<'profil_usaha'>
type LegalitasDokumen = Tables<'legalitas_dokumen'>

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
  const [legalDocs, setLegalDocs] = useState<LegalitasDokumen[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isGuest, setIsGuest] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // Verification states
  const [verifRecord, setVerifRecord] = useState<VerificationRequest | null>(null)
  const [isVerifModalOpen, setIsVerifModalOpen] = useState(false)
  const [verifType, setVerifType] = useState('Verifikasi Kredibilitas Lengkap (Siap KUR)')
  const [verifNotes, setVerifNotes] = useState('')
  const [submittingVerif, setSubmittingVerif] = useState(false)
  const [verifError, setVerifError] = useState<string | null>(null)
  const [userTotalTx, setUserTotalTx] = useState(0)
  const [userSkorPRD, setUserSkorPRD] = useState(0)

  // Legal document states
  const [hasNib, setHasNib] = useState(false)
  const [nomorNib, setNomorNib] = useState('')
  const [hasNpwp, setHasNpwp] = useState(false)
  const [nomorNpwp, setNomorNpwp] = useState('')
  const [hasSku, setHasSku] = useState(false)
  const [nomorSku, setNomorSku] = useState('')

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setIsGuest(true)
        setProfiles(DEMO_PROFILES)
        setUserTotalTx(DEMO_TRANSACTIONS.length)
        setUserSkorPRD(82)
        if (DEMO_PROFILES.length > 0) {
          setActiveProfile(DEMO_PROFILES[0])
          setHasNib(true)
          setNomorNib('1234567890123')
          setHasNpwp(true)
          setNomorNpwp('98.765.432.1-012.000')
        }
        setLoading(false)
        return
      }

      let loadedProfilId: string | null = null
      // 1. Fetch user's profiles
      const { data: profData } = await supabase
        .from('profil_usaha')
        .select('*')
        .order('created_at', { ascending: false })

      if (profData && profData.length > 0) {
        const typed = profData as ProfilUsaha[]
        setProfiles(typed)
        const picked = pickActiveProfile(typed, getActiveProfilId())!
        setActiveProfile(picked)
        loadedProfilId = picked.id
      } else {
        const fullName = (user.user_metadata?.full_name as string) || ''
        let initialNamaUsaha = ''
        let initialNamaPemilik = fullName
        if (fullName.includes('-')) {
          const parts = fullName.split('-').map((s) => s.trim())
          initialNamaPemilik = parts[0] || fullName
          initialNamaUsaha = parts[1] || ''
        }

        setActiveProfile({
          nama_usaha: initialNamaUsaha,
          nama_pemilik: initialNamaPemilik,
          jenis_usaha: 'Kuliner & F&B',
          tanggal_mulai_usaha: '',
          nomor_telepon: '',
          alamat_usaha: '',
          deskripsi_usaha: '',
        })
      }

      // 2. Fetch legal documents
      let docsQuery = supabase.from('legalitas_dokumen').select('*')
      if (loadedProfilId) docsQuery = docsQuery.eq('profil_id', loadedProfilId)
      const { data: docsData } = await docsQuery

      if (docsData) {
        const typedDocs = docsData as LegalitasDokumen[]
        setLegalDocs(typedDocs)
        typedDocs.forEach((d) => {
          if (d.kategori === 'NIB') {
            setHasNib(true)
            setNomorNib(d.nomor_dokumen || '')
          }
          if (d.kategori === 'NPWP') {
            setHasNpwp(true)
            setNomorNpwp(d.nomor_dokumen || '')
          }
          if (d.kategori === 'SKU') {
            setHasSku(true)
            setNomorSku(d.nomor_dokumen || '')
          }
        })
      }

      // 3. Fetch transactions for verification summary
      let txsQuery = supabase.from('transaksi_kas').select('*')
      if (loadedProfilId) txsQuery = txsQuery.eq('profil_id', loadedProfilId)
      const { data: txsData } = await txsQuery
      if (txsData) {
        setUserTotalTx(txsData.length)
        setUserSkorPRD(calculateSkorPRD(txsData as Tables<'transaksi_kas'>[]).total)
      }

      setLoading(false)
    }

    loadData()
  }, [])

  // Status verifikasi usaha aktif diambil dari database (tabel verifikasi_usaha)
  useEffect(() => {
    if (isGuest || !activeProfile.id) {
      setVerifRecord(null)
      return
    }
    let cancelled = false
    fetchVerificationByProfil(supabase, activeProfile.id).then((rec) => {
      if (!cancelled) setVerifRecord(rec)
    })
    return () => {
      cancelled = true
    }
  }, [activeProfile.id, isGuest])

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeProfile.nama_usaha || !activeProfile.nama_usaha.trim()) {
      showToast('error', 'Nama usaha wajib diisi terlebih dahulu sebelum mengajukan verifikasi.')
      return
    }
    if (isGuest) {
      showToast('error', 'Mode tamu: masuk atau daftar akun untuk mengajukan verifikasi.')
      return
    }

    setSubmittingVerif(true)
    setVerifError(null)
    try {
      const { record: newRec, error } = await submitVerificationRequest(supabase, {
        businessId: activeProfile.id || '',
        businessName: activeProfile.nama_usaha || 'Usaha Mandiri',
        ownerName: activeProfile.nama_pemilik || 'Pemilik Usaha',
        phoneNumber: activeProfile.nomor_telepon || '-',
        businessSector: activeProfile.jenis_usaha || 'Kuliner & F&B',
        applicationType: verifType,
        notes: verifNotes.trim() || 'Permohonan audit kredibilitas kelayakan kredit dan legalitas NIB.',
        hasNib,
        nomorNib: hasNib ? nomorNib : undefined,
        totalTransactions: userTotalTx,
        skorPRD: userSkorPRD,
      })

      if (error) {
        // Tampil di dalam modal (modal berada di atas toast) dan sebagai toast.
        setVerifError(error)
        showToast('error', 'Gagal mengirim pengajuan verifikasi: ' + error)
        return
      }
      setVerifRecord(newRec)
      setIsVerifModalOpen(false)
      setVerifNotes('')
      showToast('success', 'Pengajuan verifikasi terkirim. Status: Menunggu tinjauan admin.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan tak terduga.'
      setVerifError(msg)
      showToast('error', 'Gagal mengirim pengajuan verifikasi: ' + msg)
    } finally {
      setSubmittingVerif(false)
    }
  }

  // Calculate completeness score (7 profile fields + 2 legal docs)
  const fields = [
    activeProfile.nama_usaha,
    activeProfile.nama_pemilik,
    activeProfile.jenis_usaha,
    activeProfile.tanggal_mulai_usaha,
    activeProfile.nomor_telepon,
    activeProfile.alamat_usaha,
    activeProfile.deskripsi_usaha,
  ]
  const filledFields = fields.filter((f) => f && String(f).trim().length > 0).length
  const legalPoints = (hasNib && nomorNib ? 1 : 0) + (hasNpwp && nomorNpwp ? 1 : 0)
  const completenessPct = Math.min(100, Math.round(((filledFields + legalPoints) / (fields.length + 2)) * 100))

  // KUR Duration eligibility (min. 6 months)
  let kurStatus: 'eligible' | 'not-eligible' | 'no-data' = 'no-data'
  let kurAgeMonths = 0
  if (activeProfile.tanggal_mulai_usaha) {
    const start = new Date(activeProfile.tanggal_mulai_usaha)
    const now = new Date()
    kurAgeMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
    kurStatus = kurAgeMonths >= 6 ? 'eligible' : 'not-eligible'
  }

  const showToast = (type: 'success' | 'error' | 'warning', text: string) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 3500)
  }

  const handleSave = async () => {
    if (!activeProfile.nama_usaha?.trim()) {
      showToast('error', 'Nama usaha wajib diisi!')
      return
    }
    if (!activeProfile.nama_pemilik?.trim()) {
      showToast('error', 'Nama pemilik wajib diisi!')
      return
    }

    if (isGuest) {
      showToast('success', 'Mode Tamu: Perubahan profil tersimpan sementara di browser.')
      return
    }

    setSaving(true)
    try {
      const payload: TablesInsert<'profil_usaha'> = {
        nama_usaha: activeProfile.nama_usaha.trim(),
        nama_pemilik: activeProfile.nama_pemilik.trim(),
        jenis_usaha: activeProfile.jenis_usaha || 'Kuliner & F&B',
        tanggal_mulai_usaha: activeProfile.tanggal_mulai_usaha || null,
        nomor_telepon: activeProfile.nomor_telepon?.trim() || null,
        alamat_usaha: activeProfile.alamat_usaha?.trim() || null,
        deskripsi_usaha: activeProfile.deskripsi_usaha?.trim() || null,
      }

      let activeId = activeProfile.id

      if (activeId) {
        // UPDATE Profile
        const { error } = await supabase
          .from('profil_usaha')
          .update(payload)
          .eq('id', activeId)

        if (error) throw error
        showToast('success', 'Profil usaha berhasil disimpan!')
      } else {
        // INSERT Profile
        const { data, error } = await supabase
          .from('profil_usaha')
          .insert(payload)
          .select()
          .single()

        if (error) throw error
        const created = data as ProfilUsaha
        activeId = created.id
        setProfiles([created, ...profiles])
        setActiveProfile(created)
        setActiveProfilId(created.id)
        showToast('success', 'Profil usaha baru berhasil didaftarkan!')
      }

      // Sync Legalitas Dokumen
      const docsToUpsert = [
        { kategori: 'NIB', nama: 'Nomor Induk Berusaha (NIB)', has: hasNib, no: nomorNib },
        { kategori: 'NPWP', nama: 'NPWP Pemilik Usaha', has: hasNpwp, no: nomorNpwp },
        { kategori: 'SKU', nama: 'Surat Keterangan Usaha (SKU)', has: hasSku, no: nomorSku },
      ]

      for (const d of docsToUpsert) {
        const existing = legalDocs.find((doc) => doc.kategori === d.kategori)
        if (d.has && d.no.trim()) {
          if (existing) {
            await supabase
              .from('legalitas_dokumen')
              .update({ nomor_dokumen: d.no.trim() })
              .eq('id', existing.id)
          } else {
            await supabase.from('legalitas_dokumen').insert({
              kategori: d.kategori,
              nama_dokumen: d.nama,
              nomor_dokumen: d.no.trim(),
              profil_id: activeId,
            })
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan profil.'
      showToast('error', msg)
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
    setHasNib(false)
    setNomorNib('')
    setHasNpwp(false)
    setNomorNpwp('')
    setHasSku(false)
    setNomorSku('')
    showToast('warning', 'Silakan lengkapi formulir untuk usaha baru Anda.')
  }

  const handleDeleteProfile = async () => {
    if (!activeProfile.id) return

    if (isGuest) {
      setProfiles(profiles.filter((p) => p.id !== activeProfile.id))
      setIsDeleteModalOpen(false)
      showToast('success', 'Profil berhasil dihapus dari memori.')
      return
    }

    try {
      const { error } = await supabase
        .from('profil_usaha')
        .delete()
        .eq('id', activeProfile.id)

      if (error) throw error

      const remaining = profiles.filter((p) => p.id !== activeProfile.id)
      setProfiles(remaining)
      if (remaining.length > 0) {
        setActiveProfile(remaining[0])
        setActiveProfilId(remaining[0].id)
      } else {
        handleCreateNew()
      }
      setIsDeleteModalOpen(false)
      showToast('success', 'Profil usaha berhasil dihapus.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus profil.'
      showToast('error', msg)
    }
  }

  const initials = (activeProfile.nama_usaha || 'U')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="profile-page-viewport">
      {/* Toast Notification */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            <span className="material-symbols-rounded">
              {toast.type === 'success' ? 'check_circle' : toast.type === 'warning' ? 'warning' : 'error'}
            </span>
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* PAGE HEADER */}
      <div className="page-header">
        <div className="page-header-top">
          <div>
            <h1 className="page-title">Profil Usaha</h1>
            <p className="page-subtitle">Kelola identitas dan legalitas usaha Anda sebagai dasar semua fitur UTERA</p>
          </div>
          <span className="prd-badge">
            <span className="material-symbols-rounded" style={{ fontSize: '13px' }}>verified_user</span>
            F3 · F14 PRD UTERA
          </span>
        </div>

        {/* Kelengkapan Profil */}
        <div style={{ marginTop: '12px' }}>
          <div className="completeness-label">
            Kelengkapan Data Usaha: {completenessPct}%
          </div>
          <div className="completeness-bar-wrap">
            <div className="completeness-bar">
              <div className="completeness-fill" style={{ width: `${completenessPct}%` }}></div>
            </div>
            <div className="completeness-pct">{completenessPct}%</div>
          </div>
        </div>
      </div>

      {/* PROFILE HEADER CARD */}
      <div className="profile-header-card">
        <div className="profile-avatar-wrap">
          <div className="profile-avatar">{initials}</div>
          <div className="profile-avatar-edit" title="Ganti foto profil">
            <span className="material-symbols-rounded">edit</span>
          </div>
        </div>

        <div className="profile-header-info">
          <div className="profile-business-name">
            {activeProfile.nama_usaha || 'Nama Usaha Belum Diisi'}
          </div>
          <div className="profile-owner">
            {activeProfile.nama_pemilik ? `Pemilik: ${activeProfile.nama_pemilik}` : 'Nama pemilik belum diisi'}
          </div>
          <div className="profile-meta">
            <span className="meta-chip sector">
              <span className="material-symbols-rounded">category</span>
              <span>{activeProfile.jenis_usaha || 'Belum dipilih'}</span>
            </span>
            <span
              className={`meta-chip duration ${
                kurStatus === 'eligible' ? 'ok' : kurStatus === 'not-eligible' ? 'warn' : ''
              }`}
            >
              <span className="material-symbols-rounded">schedule</span>
              <span>
                {activeProfile.tanggal_mulai_usaha
                  ? `Berjalan ${kurAgeMonths} bulan`
                  : 'Tanggal mulai belum diisi'}
              </span>
            </span>

            <span
              className="meta-chip"
              style={{
                background:
                  verifRecord?.status === 'verified'
                    ? '#DCFCE7'
                    : verifRecord?.status === 'pending'
                    ? '#DBEAFE'
                    : verifRecord?.status === 'rejected'
                    ? '#FEE2E2'
                    : '#F5F5F4',
                color:
                  verifRecord?.status === 'verified'
                    ? '#15803D'
                    : verifRecord?.status === 'pending'
                    ? '#1D4ED8'
                    : verifRecord?.status === 'rejected'
                    ? '#B91C1C'
                    : '#57534E',
                borderColor: 'currentColor',
                fontWeight: 700,
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>
                {verifRecord?.status === 'verified'
                  ? 'verified'
                  : verifRecord?.status === 'pending'
                  ? 'hourglass_empty'
                  : verifRecord?.status === 'rejected'
                  ? 'error'
                  : 'shield'}
              </span>
              <span>
                {verifRecord?.status === 'verified'
                  ? 'Terverifikasi Kredibel'
                  : verifRecord?.status === 'pending'
                  ? 'Verifikasi Diproses'
                  : verifRecord?.status === 'rejected'
                  ? 'Perlu Revisi'
                  : 'Belum Terverifikasi'}
              </span>
            </span>
          </div>
        </div>

        {/* Multi-Profile Switcher */}
        <div className="profile-switcher-wrap">
          <div className="profile-switcher-label">Profil Aktif</div>
          <select
            className="profile-switcher"
            value={activeProfile.id || ''}
            onChange={(e) => {
              const selected = profiles.find((p) => p.id === e.target.value)
              if (selected) {
                setActiveProfilId(selected.id)
                window.location.reload()
              }
            }}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama_usaha}
              </option>
            ))}
          </select>
          <button type="button" className="btn-add-profile" onClick={handleCreateNew}>
            <span className="material-symbols-rounded">add</span>
            <span>Tambah Profil</span>
          </button>
        </div>
      </div>

      {/* VERIFIKASI KREDIBILITAS STATUS WIDGET */}
      <div
        className="verification-status-card"
        style={{
          background:
            verifRecord?.status === 'verified'
              ? 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)'
              : verifRecord?.status === 'pending'
              ? 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)'
              : verifRecord?.status === 'rejected'
              ? 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)'
              : 'linear-gradient(135deg, #FAFAF9 0%, #F5F5F4 100%)',
          border:
            verifRecord?.status === 'verified'
              ? '1.5px solid #86EFAC'
              : verifRecord?.status === 'pending'
              ? '1.5px solid #93C5FD'
              : verifRecord?.status === 'rejected'
              ? '1.5px solid #FCA5A5'
              : '1.5px solid #E7E5E4',
          borderRadius: '16px',
          padding: '22px 24px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', maxWidth: '640px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background:
                verifRecord?.status === 'verified'
                  ? '#16A34A'
                  : verifRecord?.status === 'pending'
                  ? '#2563EB'
                  : verifRecord?.status === 'rejected'
                  ? '#DC2626'
                  : '#78716C',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '28px' }}>
              {verifRecord?.status === 'verified'
                ? 'verified'
                : verifRecord?.status === 'pending'
                ? 'hourglass_top'
                : verifRecord?.status === 'rejected'
                ? 'cancel'
                : 'shield'}
            </span>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-heading, #0F2419)' }}>
                {verifRecord?.status === 'verified'
                  ? 'Mitra UMKM Terverifikasi Resmi UTERA'
                  : verifRecord?.status === 'pending'
                  ? 'Pengajuan Verifikasi Sedang Ditinjau Admin'
                  : verifRecord?.status === 'rejected'
                  ? 'Permohonan Memerlukan Perbaikan Berkas'
                  : 'Status Kredibilitas: Belum Diverifikasi'}
              </h3>
              <span
                style={{
                  fontSize: '0.725rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background:
                    verifRecord?.status === 'verified'
                      ? '#DCFCE7'
                      : verifRecord?.status === 'pending'
                      ? '#DBEAFE'
                      : verifRecord?.status === 'rejected'
                      ? '#FEE2E2'
                      : '#E7E5E4',
                  color:
                    verifRecord?.status === 'verified'
                      ? '#15803D'
                      : verifRecord?.status === 'pending'
                      ? '#1D4ED8'
                      : verifRecord?.status === 'rejected'
                      ? '#B91C1C'
                      : '#57534E',
                  border: '1px solid currentColor',
                }}
              >
                {verifRecord?.status === 'verified'
                  ? 'Lolos Audit Kredibel'
                  : verifRecord?.status === 'pending'
                  ? 'Sedang Diproses'
                  : verifRecord?.status === 'rejected'
                  ? 'Perlu Revisi'
                  : 'Belum Diajukan'}
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '0.85rem', color: '#4B5563', lineHeight: 1.5 }}>
              {verifRecord?.status === 'verified'
                ? `Usaha Anda telah lolos validasi Otoritas Pengawas UTERA dengan No. Sertifikat ${verifRecord.certificateNumber || 'UTERA-VERIF-RESMI'}. Profil dan pembukuan kas Anda diprioritaskan saat pengajuan KUR di bank mitra.${verifRecord.adminNote ? ` Catatan admin: "${verifRecord.adminNote}".` : ''}`
                : verifRecord?.status === 'pending'
                ? `Permohonan diajukan: ${verifRecord.submittedAt} (${verifRecord.applicationType}). Tim auditor pengawas sedang memverifikasi integritas pembukuan kas dan kelengkapan izin usaha Anda (Estimasi: 1x24 jam kerja).`
                : verifRecord?.status === 'rejected'
                ? `Pengajuan ditolak. Catatan admin: "${verifRecord.adminNote || 'Lengkapi dokumen NIB dan catatan kas harian'}". Silakan perbaiki data lalu ajukan kembali.`
                : 'Dapatkan tanda centang kredibel resmi dari Otoritas Pengawas UTERA agar usaha Anda diakui perbankan dan memenuhi syarat percepatan penyaluran KUR.'}
            </p>
          </div>
        </div>

        <div>
          {verifRecord?.status === 'verified' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803D', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>verified_user</span>
                Sertifikat Kredibel Aktif
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setIsVerifModalOpen(true)}
                style={{ fontSize: '0.8rem', fontWeight: 700, background: '#fff' }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>visibility</span>
                <span>Lihat Sertifikat</span>
              </button>
            </div>
          ) : verifRecord?.status === 'pending' ? (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setIsVerifModalOpen(true)}
              style={{ fontSize: '0.8rem', fontWeight: 700, background: '#fff', borderColor: '#93C5FD', color: '#1D4ED8' }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>assignment</span>
              <span>Rincian Pengajuan</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsVerifModalOpen(true)}
              id="btn-ajukan-verifikasi"
              style={{ fontSize: '0.875rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>verified</span>
              <span>{verifRecord?.status === 'rejected' ? 'Ajukan Ulang Verifikasi' : 'Ajukan Verifikasi ke Admin'}</span>
            </button>
          )}
        </div>
      </div>

      {/* KUR ELIGIBILITY WIDGET */}
      <div className={`kur-eligibility-widget ${kurStatus}`}>
        <div className="kur-elig-icon">
          <span className="material-symbols-rounded">
            {kurStatus === 'eligible' ? 'verified' : kurStatus === 'not-eligible' ? 'warning' : 'help'}
          </span>
        </div>
        <div className="kur-elig-info">
          <div className="kur-elig-title">
            {kurStatus === 'eligible'
              ? 'Memenuhi Syarat Durasi Operasional KUR'
              : kurStatus === 'not-eligible'
              ? `Belum Memenuhi Syarat Minimal 6 Bulan (Saat ini ${kurAgeMonths} bulan)`
              : 'Kelayakan KUR Belum Dapat Dihitung'}
          </div>
          <div className="kur-elig-desc">
            {kurStatus === 'eligible'
              ? 'Usaha Anda telah berjalan lebih dari 6 bulan, memenuhi syarat pengajuan KUR Mikro / Super Mikro di bank.'
              : kurStatus === 'not-eligible'
              ? 'Bank mensyaratkan usaha minimal beroperasi 6 bulan berturut-turut untuk dapat mengajukan KUR.'
              : 'Isi tanggal mulai usaha di bawah untuk memeriksa kesiapan durasi KUR Anda.'}
          </div>
        </div>
        {kurStatus === 'eligible' && (
          <Link href="/simulasi-kur" className="kur-elig-action">
            <span className="material-symbols-rounded">calculate</span>
            <span>Simulasi KUR</span>
          </Link>
        )}
      </div>

      {/* SECTION 1: DATA USAHA */}
      <div className="section-card">
        <div className="section-card-header">
          <div className="section-card-title">
            <span className="material-symbols-rounded">store</span>
            <div>
              <h3>Data Usaha</h3>
              <p>Informasi dasar identitas usaha Anda</p>
            </div>
          </div>
        </div>
        <div className="section-card-body">
          <div className="form-grid">
            {/* Nama Usaha */}
            <div className="form-group">
              <label className="form-label" htmlFor="nama_usaha">
                Nama Usaha <span className="required">*</span>
              </label>
              <input
                type="text"
                id="nama_usaha"
                className="form-control"
                placeholder="Contoh: Kopi Nusantara"
                maxLength={100}
                value={activeProfile.nama_usaha || ''}
                onChange={(e) => setActiveProfile({ ...activeProfile, nama_usaha: e.target.value })}
              />
              <span className="form-hint">Nama resmi usaha yang digunakan untuk dokumen bank</span>
            </div>

            {/* Nama Pemilik */}
            <div className="form-group">
              <label className="form-label" htmlFor="nama_pemilik">
                Nama Pemilik <span className="required">*</span>
              </label>
              <input
                type="text"
                id="nama_pemilik"
                className="form-control"
                placeholder="Sesuai KTP"
                maxLength={80}
                value={activeProfile.nama_pemilik || ''}
                onChange={(e) => setActiveProfile({ ...activeProfile, nama_pemilik: e.target.value })}
              />
              <span className="form-hint">Nama lengkap sesuai KTP pemilik usaha</span>
            </div>

            {/* Jenis Usaha */}
            <div className="form-group">
              <label className="form-label" htmlFor="jenis_usaha">
                Jenis / Sektor Usaha <span className="required">*</span>
              </label>
              <select
                id="jenis_usaha"
                className="form-control"
                value={activeProfile.jenis_usaha || 'Kuliner & F&B'}
                onChange={(e) => setActiveProfile({ ...activeProfile, jenis_usaha: e.target.value })}
              >
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="form-hint">Kategori utama kegiatan ekonomi usaha Anda</span>
            </div>

            {/* Tanggal Mulai Usaha */}
            <div className="form-group">
              <label className="form-label" htmlFor="tanggal_mulai_usaha">
                Tanggal Mulai Usaha <span className="required">*</span>
                <span className="label-hint">— kritis untuk KUR</span>
              </label>
              <input
                type="date"
                id="tanggal_mulai_usaha"
                className="form-control"
                value={activeProfile.tanggal_mulai_usaha || ''}
                onChange={(e) => setActiveProfile({ ...activeProfile, tanggal_mulai_usaha: e.target.value })}
              />
              <span className="form-hint">Usaha harus berjalan min. 6 bulan untuk mengajukan KUR</span>
            </div>

            {/* Nomor Telepon */}
            <div className="form-group">
              <label className="form-label" htmlFor="nomor_telepon">
                Nomor Telepon / WhatsApp
              </label>
              <div className="input-with-icon">
                <span className="material-symbols-rounded input-icon">phone</span>
                <input
                  type="tel"
                  id="nomor_telepon"
                  className="form-control"
                  placeholder="081234567890"
                  maxLength={20}
                  value={activeProfile.nomor_telepon || ''}
                  onChange={(e) => setActiveProfile({ ...activeProfile, nomor_telepon: e.target.value })}
                />
              </div>
              <span className="form-hint">Nomor yang dapat dihubungi oleh analis bank</span>
            </div>

            {/* Alamat Usaha */}
            <div className="form-group span-2">
              <label className="form-label" htmlFor="alamat_usaha">
                Alamat Usaha <span className="required">*</span>
              </label>
              <textarea
                id="alamat_usaha"
                className="form-control"
                placeholder="Jalan, RT/RW, Kelurahan, Kecamatan, Kota/Kabupaten, Provinsi"
                rows={2}
                maxLength={300}
                value={activeProfile.alamat_usaha || ''}
                onChange={(e) => setActiveProfile({ ...activeProfile, alamat_usaha: e.target.value })}
              />
              <span className="form-hint">Alamat lengkap lokasi operasional usaha</span>
            </div>

            {/* Deskripsi Usaha */}
            <div className="form-group span-2">
              <label className="form-label" htmlFor="deskripsi_usaha">
                Deskripsi Usaha
                <span className="label-hint">— untuk narasi proposal kredit</span>
              </label>
              <textarea
                id="deskripsi_usaha"
                className="form-control"
                placeholder="Jelaskan spesialisasi produk, target pembeli, dan aktivitas operasional warung Anda..."
                rows={3}
                maxLength={600}
                value={activeProfile.deskripsi_usaha || ''}
                onChange={(e) => setActiveProfile({ ...activeProfile, deskripsi_usaha: e.target.value })}
              />
              <span className="form-hint">Deskripsi singkat yang menggambarkan usaha Anda kepada pihak bank</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: STATUS LEGALITAS (F14) */}
      <div className="section-card">
        <div className="section-card-header">
          <div className="section-card-title">
            <span className="material-symbols-rounded">gavel</span>
            <div>
              <h3>Status Legalitas</h3>
              <p>F14 PRD — Dokumen legal yang mendukung pengajuan KUR</p>
            </div>
          </div>
        </div>
        <div className="section-card-body">
          <div className="legalitas-grid">
            {/* NIB */}
            <div className={`legalitas-item ${hasNib ? 'has-doc' : 'no-doc'}`}>
              <div className="legalitas-status-icon">
                <span className="material-symbols-rounded">
                  {hasNib ? 'check_circle' : 'pending'}
                </span>
              </div>
              <div className="legalitas-info">
                <div className="legalitas-name">
                  <span>Nomor Induk Berusaha (NIB)</span>
                  <span className={`legalitas-status-badge ${hasNib ? 'verified' : 'pending'}`}>
                    {hasNib ? 'Sudah Ada' : 'Belum Ada'}
                  </span>
                </div>
                <div className="legalitas-desc">
                  Dokumen wajib untuk pengajuan KUR di semua bank. Daftar gratis di OSS (oss.go.id).
                </div>
                {hasNib && (
                  <div className="legalitas-input-wrap">
                    <input
                      type="text"
                      className="legalitas-number-input"
                      placeholder="Masukkan nomor NIB (13 digit angka)"
                      maxLength={20}
                      value={nomorNib}
                      onChange={(e) => setNomorNib(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div className="legalitas-toggle-wrap">
                <label className="toggle-switch" title="Sudah punya NIB?">
                  <input
                    type="checkbox"
                    checked={hasNib}
                    onChange={(e) => setHasNib(e.target.checked)}
                  />
                  <div className="toggle-track"></div>
                  <div className="toggle-thumb"></div>
                </label>
                <span className="toggle-label">{hasNib ? 'Punya' : 'Tidak'}</span>
              </div>
            </div>

            {/* NPWP */}
            <div className={`legalitas-item ${hasNpwp ? 'has-doc' : 'no-doc'}`}>
              <div className="legalitas-status-icon">
                <span className="material-symbols-rounded">
                  {hasNpwp ? 'check_circle' : 'pending'}
                </span>
              </div>
              <div className="legalitas-info">
                <div className="legalitas-name">
                  <span>NPWP (Nomor Pokok Wajib Pajak)</span>
                  <span className={`legalitas-status-badge ${hasNpwp ? 'verified' : 'pending'}`}>
                    {hasNpwp ? 'Sudah Ada' : 'Belum Ada'}
                  </span>
                </div>
                <div className="legalitas-desc">
                  Diperlukan untuk pengajuan pinjaman di atas Rp 50 juta. Daftar di DJP Online (ereg.pajak.go.id).
                </div>
                {hasNpwp && (
                  <div className="legalitas-input-wrap">
                    <input
                      type="text"
                      className="legalitas-number-input"
                      placeholder="XX.XXX.XXX.X-XXX.XXX"
                      maxLength={25}
                      value={nomorNpwp}
                      onChange={(e) => setNomorNpwp(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div className="legalitas-toggle-wrap">
                <label className="toggle-switch" title="Sudah punya NPWP?">
                  <input
                    type="checkbox"
                    checked={hasNpwp}
                    onChange={(e) => setHasNpwp(e.target.checked)}
                  />
                  <div className="toggle-track"></div>
                  <div className="toggle-thumb"></div>
                </label>
                <span className="toggle-label">{hasNpwp ? 'Punya' : 'Tidak'}</span>
              </div>
            </div>

            {/* SKU / IUMK */}
            <div className={`legalitas-item ${hasSku ? 'has-doc' : 'no-doc'}`}>
              <div className="legalitas-status-icon">
                <span className="material-symbols-rounded">
                  {hasSku ? 'check_circle' : 'pending'}
                </span>
              </div>
              <div className="legalitas-info">
                <div className="legalitas-name">
                  <span>SKU / IUMK / Izin Usaha Lainnya</span>
                  <span className={`legalitas-status-badge ${hasSku ? 'verified' : 'pending'}`}>
                    {hasSku ? 'Sudah Ada' : 'Belum Ada'}
                  </span>
                </div>
                <div className="legalitas-desc">
                  Surat Keterangan Usaha dari kelurahan setempat untuk meningkatkan kepercayaan bank.
                </div>
                {hasSku && (
                  <div className="legalitas-input-wrap">
                    <input
                      type="text"
                      className="legalitas-number-input"
                      placeholder="Nomor SKU dari Kelurahan"
                      maxLength={40}
                      value={nomorSku}
                      onChange={(e) => setNomorSku(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div className="legalitas-toggle-wrap">
                <label className="toggle-switch" title="Sudah punya SKU?">
                  <input
                    type="checkbox"
                    checked={hasSku}
                    onChange={(e) => setHasSku(e.target.checked)}
                  />
                  <div className="toggle-track"></div>
                  <div className="toggle-thumb"></div>
                </label>
                <span className="toggle-label">{hasSku ? 'Punya' : 'Tidak'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="section-card">
        <div className="section-card-body">
          <div className="action-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || loading}
            >
              <span className="material-symbols-rounded">
                {saving ? 'hourglass_top' : 'save'}
              </span>
              <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
            </button>

            <button
              type="button"
              className="btn btn-gold"
              onClick={() => window.print()}
            >
              <span className="material-symbols-rounded">picture_as_pdf</span>
              <span>Ekspor Profil PDF</span>
            </button>

            <Link href="/simulasi-kur" className="btn btn-outline">
              <span className="material-symbols-rounded">calculate</span>
              <span>Ke Simulasi KUR</span>
            </Link>

            <Link href="/skor-kelayakan" className="btn btn-outline">
              <span className="material-symbols-rounded">bar_chart</span>
              <span>Cek Skor Kelayakan</span>
            </Link>

            {profiles.length > 1 && (
              <button
                type="button"
                className="btn btn-danger"
                style={{ marginLeft: 'auto' }}
                onClick={() => setIsDeleteModalOpen(true)}
              >
                <span className="material-symbols-rounded">delete</span>
                <span>Hapus Profil Ini</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      {isDeleteModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-icon">
              <span className="material-symbols-rounded">delete_forever</span>
            </div>
            <h3 className="modal-title">Hapus Profil Usaha?</h3>
            <p className="modal-desc">
              Profil usaha &quot;{activeProfile.nama_usaha}&quot; akan dihapus secara permanen dari database. Tindakan ini tidak dapat dibatalkan. Lanjutkan?
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteProfile}
              >
                <span className="material-symbols-rounded">delete</span>
                <span>Ya, Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VERIFICATION APPLICATION & CERTIFICATE MODAL */}
      {isVerifModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal-box" style={{ maxWidth: '580px', width: '92%' }}>
            {verifRecord?.status === 'verified' ? (
              /* VIEW: VERIFIED CERTIFICATE */
              <div>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: '#ECFDF5',
                      color: '#059669',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '12px',
                      border: '2px solid #A7F3D0',
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '36px' }}>verified</span>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-heading)' }}>
                    Sertifikat Kredibilitas UMKM
                  </h3>
                  <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Otoritas Pengawasan Platform UTERA Finansial
                  </p>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: '6px',
                      background: '#F1F5F9',
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      color: '#1E293B',
                      border: '1px solid #CBD5E1',
                    }}
                  >
                    No: {verifRecord.certificateNumber || 'UTERA-VERIF-2026-088'}
                  </span>
                </div>

                <div
                  style={{
                    background: '#F8FAF9',
                    border: '1px solid #E6EDE9',
                    borderRadius: '12px',
                    padding: '16px',
                    fontSize: '0.85rem',
                    marginBottom: '20px',
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Nama Usaha</span>
                      <strong style={{ color: 'var(--text-main)' }}>{activeProfile.nama_usaha}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Pemilik Usaha</span>
                      <strong style={{ color: 'var(--text-main)' }}>{activeProfile.nama_pemilik || '-'}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Legalitas NIB</span>
                      <strong style={{ color: '#059669' }}>{hasNib ? `Terdaftar (${nomorNib})` : 'Belum Ada'}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Tanggal Disahkan</span>
                      <strong style={{ color: 'var(--text-main)' }}>{verifRecord.reviewedAt || '2026-03-01'}</strong>
                    </div>
                  </div>
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #D1E7DC' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Auditor Pengawas:</span>
                    <strong style={{ color: '#1F6B4F' }}>{verifRecord.reviewedBy || 'Super Administrator UTERA'}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setIsVerifModalOpen(false)}
                  >
                    Tutup
                  </button>
                  <Link href="/laporan-siap-bank" className="btn btn-primary">
                    <span className="material-symbols-rounded">download</span>
                    <span>Cetak Bukti Siap Bank</span>
                  </Link>
                </div>
              </div>
            ) : verifRecord?.status === 'pending' ? (
              /* VIEW: PENDING DETAILS */
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      background: '#EFF6FF',
                      color: '#2563EB',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '26px' }}>hourglass_top</span>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-heading)' }}>
                      Rincian Pengajuan Verifikasi
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                      Status: Dalam Antrean Audit Otoritas UTERA
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    background: '#F8FAF9',
                    border: '1px solid #E6EDE9',
                    borderRadius: '12px',
                    padding: '16px',
                    fontSize: '0.85rem',
                    marginBottom: '20px',
                    lineHeight: 1.6,
                  }}
                >
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Jenis Pengajuan:</span>
                    <strong>{verifRecord.applicationType}</strong>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Waktu Dikirim:</span>
                    <span>{verifRecord.submittedAt}</span>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Catatan Pengajuan Anda:</span>
                    <p style={{ margin: '4px 0 0', background: '#FFFFFF', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', fontStyle: 'italic' }}>
                      &ldquo;{verifRecord.notes}&rdquo;
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '0.78rem', color: '#1E40AF', background: '#EFF6FF', padding: '10px 12px', borderRadius: '8px' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>info</span>
                    <span>Auditor sedang memvalidasi kesesuaian pembukuan kas warung Anda dengan standar SAK EMKM dan verifikasi NIB OSS. Hasil akan diberitahukan lewat notifikasi akun Anda.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setIsVerifModalOpen(false)}
                  >
                    Tutup
                  </button>
                </div>
              </div>
            ) : (
              /* VIEW: SUBMISSION FORM (UNVERIFIED / REJECTED) */
              <form onSubmit={handleSubmitVerification}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      background: '#ECFDF5',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '26px' }}>verified_user</span>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-heading)' }}>
                      Formulir Pengajuan Verifikasi Kredibilitas
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                      Ajukan audit pembukuan kas &amp; legalitas usaha ke Otoritas Pengawas UTERA
                    </p>
                  </div>
                </div>

                {/* Data Summary Card */}
                <div
                  style={{
                    background: '#F8FAF9',
                    border: '1px solid #E6EDE9',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    fontSize: '0.825rem',
                    marginBottom: '16px',
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: '8px', color: '#1F6B4F' }}>
                    Ringkasan Berkas yang Akan Diaudit:
                  </strong>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Nama Usaha: </span>
                      <strong>{activeProfile.nama_usaha || '(Wajib diisi di profil)'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Pemilik Usaha: </span>
                      <strong>{activeProfile.nama_pemilik || '-'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Legalitas NIB: </span>
                      <strong style={{ color: hasNib ? '#059669' : '#D97706' }}>
                        {hasNib ? `✓ Ada (${nomorNib})` : '○ Belum diisi'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Buku Kas: </span>
                      <strong>{userTotalTx} Transaksi ({userSkorPRD}/100 Poin)</strong>
                    </div>
                  </div>
                </div>

                {/* Jenis Pengajuan */}
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>
                    Pilih Jenis Fasilitas Verifikasi <span className="required">*</span>
                  </label>
                  <select
                    className="form-control"
                    value={verifType}
                    onChange={(e) => setVerifType(e.target.value)}
                    style={{ fontSize: '0.85rem', padding: '10px 12px' }}
                  >
                    <option value="Verifikasi Kredibilitas Lengkap (Siap KUR)">
                      Verifikasi Kredibilitas Lengkap (Siap KUR Mikro / Super Mikro)
                    </option>
                    <option value="Validasi Dokumen NIB & Legalitas OSS">
                      Validasi Dokumen NIB &amp; Legalitas OSS RBA
                    </option>
                    <option value="Audit Konsistensi Buku Kas Warung">
                      Audit Konsistensi Buku Kas Warung (SAK EMKM)
                    </option>
                  </select>
                </div>

                {/* Catatan / Pesan untuk Admin */}
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>
                    Catatan / Permohonan Khusus untuk Admin Pengawas
                  </label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Contoh: Kami telah aktif mencatat mutasi kas warung harian dan melengkapi NIB. Mohon audit kredibilitas untuk pengajuan fasilitas KUR ke Bank mitra."
                    value={verifNotes}
                    onChange={(e) => setVerifNotes(e.target.value)}
                    style={{ fontSize: '0.85rem', padding: '10px 12px' }}
                  />
                  <span className="form-hint" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Sertakan informasi tambahan yang relevan untuk mempercepat proses pemeriksaan admin.
                  </span>
                </div>

                <div
                  style={{
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '0.78rem',
                    color: '#15803D',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>shield</span>
                  <span>
                    Data Anda aman dan diaudit secara rahasia oleh Otoritas Pengawas UTERA sesuai standar audit kredit perbankan.
                  </span>
                </div>

                {verifError && (
                  <div role="alert" className="verif-inline-error">
                    <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>error</span>
                    <span>{verifError}</span>
                  </div>
                )}

                <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => { setVerifError(null); setIsVerifModalOpen(false) }}
                    disabled={submittingVerif}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submittingVerif || !activeProfile.nama_usaha?.trim()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                      {submittingVerif ? 'progress_activity' : 'send'}
                    </span>
                    <span>{submittingVerif ? 'Mengirimkan...' : 'Kirim Pengajuan Verifikasi'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
