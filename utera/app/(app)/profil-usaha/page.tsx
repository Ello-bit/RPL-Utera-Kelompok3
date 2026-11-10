'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { DEMO_PROFILES } from '@/lib/demo-seed'
import { Tables, TablesInsert } from '@/lib/database.types'
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

      // 1. Fetch user's profiles
      const { data: profData } = await supabase
        .from('profil_usaha')
        .select('*')
        .order('created_at', { ascending: false })

      if (profData && profData.length > 0) {
        const typed = profData as ProfilUsaha[]
        setProfiles(typed)
        setActiveProfile(typed[0])
      } else {
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

      // 2. Fetch legal documents
      const { data: docsData } = await supabase
        .from('legalitas_dokumen')
        .select('*')

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

      setLoading(false)
    }

    loadData()
  }, [])

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
              if (selected) setActiveProfile(selected)
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
    </div>
  )
}
