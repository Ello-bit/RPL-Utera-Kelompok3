'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Tables, TablesInsert } from '@/lib/database.types'
import { DEFAULT_LEGALITAS_DOCS, evaluateLegalitas } from '@/lib/legalitas'
import './legalitas.css'

type LegalitasDokumen = Tables<'legalitas_dokumen'>

export default function LegalitasPage() {
  const supabase = createClient()
  const [docs, setDocs] = useState<LegalitasDokumen[]>([])
  const [loading, setLoading] = useState(true)
  const [isGuest, setIsGuest] = useState(false)
  const [editingDoc, setEditingDoc] = useState<Partial<LegalitasDokumen> | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setIsGuest(true)
        setDocs([
          {
            id: 'doc-demo-nib',
            user_id: 'guest',
            profil_id: null,
            kategori: 'NIB',
            nama_dokumen: 'Nomor Induk Berusaha (NIB)',
            nomor_dokumen: '1234567890123',
            tanggal_terbit: '2025-02-15',
            masa_berlaku: null,
            file_url: 'https://oss.go.id',
            created_at: new Date().toISOString(),
          },
          {
            id: 'doc-demo-npwp',
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

      const { data, error } = await supabase
        .from('legalitas_dokumen')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching legalitas_dokumen:', error)
      } else if (data) {
        setDocs(data as LegalitasDokumen[])
      }
      setLoading(false)
    }

    loadData()
  }, [])

  const summary = evaluateLegalitas(docs)

  const handleOpenAdd = (kategori: string, nama: string) => {
    const existing = docs.find((d) => d.kategori === kategori)
    if (existing) {
      setEditingDoc(existing)
    } else {
      setEditingDoc({
        kategori,
        nama_dokumen: nama,
        nomor_dokumen: '',
        tanggal_terbit: new Date().toISOString().slice(0, 10),
        masa_berlaku: '',
        file_url: '',
      })
    }
    setIsModalOpen(true)
    setMessage(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDoc?.nomor_dokumen?.trim()) {
      alert('Nomor dokumen wajib diisi.')
      return
    }

    if (isGuest) {
      const updated: LegalitasDokumen = {
        id: editingDoc.id || 'doc_' + Date.now(),
        user_id: 'guest',
        profil_id: null,
        kategori: editingDoc.kategori || 'NIB',
        nama_dokumen: editingDoc.nama_dokumen || 'Dokumen',
        nomor_dokumen: editingDoc.nomor_dokumen,
        tanggal_terbit: editingDoc.tanggal_terbit || null,
        masa_berlaku: editingDoc.masa_berlaku || null,
        file_url: editingDoc.file_url || null,
        created_at: new Date().toISOString(),
      }
      setDocs([updated, ...docs.filter((d) => d.kategori !== updated.kategori)])
      setIsModalOpen(false)
      return
    }

    setSaving(true)
    try {
      if (editingDoc.id) {
        // UPDATE
        const { error } = await supabase
          .from('legalitas_dokumen')
          .update({
            nomor_dokumen: editingDoc.nomor_dokumen.trim(),
            tanggal_terbit: editingDoc.tanggal_terbit || null,
            masa_berlaku: editingDoc.masa_berlaku || null,
            file_url: editingDoc.file_url?.trim() || null,
          })
          .eq('id', editingDoc.id)

        if (error) throw error
        setDocs(
          docs.map((d) =>
            d.id === editingDoc.id
              ? ({ ...d, ...editingDoc } as LegalitasDokumen)
              : d
          )
        )
        setMessage({ type: 'success', text: 'Dokumen legalitas berhasil diperbarui!' })
      } else {
        // INSERT
        const payload: TablesInsert<'legalitas_dokumen'> = {
          kategori: editingDoc.kategori || 'NIB',
          nama_dokumen: editingDoc.nama_dokumen || 'Dokumen',
          nomor_dokumen: editingDoc.nomor_dokumen.trim(),
          tanggal_terbit: editingDoc.tanggal_terbit || null,
          masa_berlaku: editingDoc.masa_berlaku || null,
          file_url: editingDoc.file_url?.trim() || null,
        }

        const { data, error } = await supabase
          .from('legalitas_dokumen')
          .insert(payload)
          .select()
          .single()

        if (error) throw error
        setDocs([data as LegalitasDokumen, ...docs])
        setMessage({ type: 'success', text: 'Dokumen legalitas baru berhasil ditambahkan!' })
      }
      setIsModalOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan dokumen.'
      setMessage({ type: 'error', text: msg })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
            Legalitas & NIB
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Kelola dokumen legalitas resmi UMKM (NIB OSS, NPWP, SKU) sebagai prasyarat utama verifikasi bank.
          </p>
        </div>
      </div>

      {/* Message Feedback */}
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

      {/* Status Readiness Banner */}
      <div
        style={{
          background: summary.pct >= 75 ? '#ECFDF5' : '#FEF7EC',
          border: `1px solid ${summary.pct >= 75 ? '#A7F3D0' : '#FDE68A'}`,
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '28px',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: '24px',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: summary.pct >= 75 ? '#D1FAE5' : '#FEF3C7',
            color: summary.pct >= 75 ? '#059669' : '#D97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
          }}
        >
          <span className="material-symbols-rounded">
            {summary.pct >= 75 ? 'verified' : 'fact_check'}
          </span>
        </div>

        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: summary.pct >= 75 ? '#065F46' : '#92400E', marginBottom: '4px' }}>
            {summary.pct === 100
              ? 'Seluruh Dokumen Legalitas Lengkap'
              : `Kelengkapan Legalitas: ${summary.completed} dari ${summary.total} Dokumen Terverifikasi`}
          </h2>
          <p style={{ color: summary.pct >= 75 ? '#047857' : '#B45309', fontSize: '0.85rem' }}>
            NIB (Nomor Induk Berusaha) berbasis risiko OSS-RBA merupakan syarat mutlak pengajuan KUR di bank Himbara (BRI, BNI, Mandiri).
          </p>
        </div>

        <div style={{ textAlign: 'center', padding: '0 10px' }}>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: summary.pct >= 75 ? '#059669' : '#D97706' }}>
            {summary.pct}%
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Status Kesiapan</span>
        </div>
      </div>

      {/* Document Checklist Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {DEFAULT_LEGALITAS_DOCS.map((docDef) => {
          const uploaded = docs.find((d) => d.kategori === docDef.jenis)
          return (
            <div
              key={docDef.jenis}
              style={{
                background: '#fff',
                borderRadius: '14px',
                border: '1px solid var(--border-subtle)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      background: uploaded ? '#ECFDF5' : '#FEF2F2',
                      color: uploaded ? '#065F46' : '#991B1B',
                    }}
                  >
                    {uploaded ? '✓ Terdaftar' : 'Belum Terdaftar'}
                  </span>
                  {docDef.required && (
                    <span style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 600 }}>
                      * Wajib untuk KUR
                    </span>
                  )}
                </div>

                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
                  {docDef.judul}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginBottom: '16px' }}>
                  {docDef.deskripsi}
                </p>

                {uploaded ? (
                  <div style={{ padding: '12px', background: '#F8FAF9', borderRadius: '8px', marginBottom: '16px', fontSize: '0.8rem' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Nomor Registrasi:</div>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)', wordBreak: 'break-all' }}>
                      {uploaded.nomor_dokumen}
                    </strong>
                    {uploaded.tanggal_terbit && (
                      <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                        Terbit: {uploaded.tanggal_terbit}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '12px', background: '#FFFBEB', borderRadius: '8px', marginBottom: '16px', fontSize: '0.8rem', color: '#B45309' }}>
                    Belum ada nomor atau lampiran dokumen yang tersimpan.
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleOpenAdd(docDef.jenis, docDef.judul)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  background: uploaded ? '#F8FAF9' : 'var(--primary)',
                  color: uploaded ? 'var(--text-main)' : '#fff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                  {uploaded ? 'edit' : 'add'}
                </span>
                <span>{uploaded ? 'Perbarui Nomor Dokumen' : 'Daftarkan Nomor Dokumen'}</span>
              </button>
            </div>
          )
        })}
      </div>

      {/* Modal Dialog */}
      {isModalOpen && editingDoc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              maxWidth: '460px',
              width: '100%',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {editingDoc.nama_dokumen}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '4px' }}>
                  Nomor Dokumen / Sertifikat <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 1234567890123"
                  value={editingDoc.nomor_dokumen || ''}
                  onChange={(e) => setEditingDoc({ ...editingDoc, nomor_dokumen: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '4px' }}>
                  Tanggal Terbit Dokumen
                </label>
                <input
                  type="date"
                  value={editingDoc.tanggal_terbit || ''}
                  onChange={(e) => setEditingDoc({ ...editingDoc, tanggal_terbit: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '4px' }}>
                  Tautan File Berkas (Opsional)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={editingDoc.file_url || ''}
                  onChange={(e) => setEditingDoc({ ...editingDoc, file_url: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  {saving ? 'Menyimpan...' : 'Simpan Dokumen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

