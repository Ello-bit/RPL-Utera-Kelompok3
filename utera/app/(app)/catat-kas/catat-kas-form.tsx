'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Tables, TablesInsert } from '@/lib/database.types'
import { KAS_CATEGORIES, PAYMENT_METHODS } from '@/lib/kas'
import { parseNominal, todayLocal } from '@/lib/input'
import { getActiveProfilId, pickActiveProfile } from '@/lib/profil-aktif'
import { syncSkorSnapshot } from '@/lib/skor-sync'
import RupiahInput from '@/components/rupiah-input'
import './catat-kas-form.css'

type TransaksiKas = Tables<'transaksi_kas'>
type TipeKas = 'pemasukan' | 'pengeluaran'

/** id kartu formulir di halaman Buku Kas Warung (tujuan gulir tombol "Catat Kas") */
export const ID_KARTU_CATAT_KAS = 'catat-kas'

/** Gulir ke formulir catat kas di halaman Buku Kas Warung lalu fokus ke kolom jumlah. */
export function gulirKeCatatKas() {
  const kartu = document.getElementById(ID_KARTU_CATAT_KAS)
  if (!kartu) return false
  kartu.scrollIntoView({ behavior: 'smooth', block: 'start' })
  // Fokus setelah gulir selesai, tanpa menggulir ulang halaman
  window.setTimeout(() => {
    kartu.querySelector<HTMLInputElement>('input[data-nominal]')?.focus({ preventScroll: true })
  }, 400)
  return true
}

interface CatatKasFormProps {
  /** Transaksi yang sedang diubah. Kosong = catat transaksi baru. */
  editing?: TransaksiKas | null
  /** Id usaha aktif. Bila tidak diisi, diambil dari usaha aktif pengguna saat menyimpan. */
  profilId?: string | null
  /** Awalan id kolom, supaya tidak bentrok bila formulir tampil di dua tempat. */
  idPrefix?: string
  onSaved?: (tx: TransaksiKas, mode: 'baru' | 'ubah') => void
  onCancelEdit?: () => void
  /** Bila diisi, formulir edit menampilkan tombol "Hapus Transaksi" */
  onDelete?: () => void
}

/**
 * Formulir catat kas yang sama untuk halaman Buku Kas Warung dan pop-up "Catat Kas" di kanan atas.
 * Menyimpan ke tabel transaksi_kas, lalu menghitung ulang skor kelayakan (aturan PRD).
 * Untuk mengisi ulang dari transaksi lain, ganti `key` komponen ini.
 */
export default function CatatKasForm({
  editing = null,
  profilId,
  idPrefix = 'kas',
  onSaved,
  onCancelEdit,
  onDelete,
}: CatatKasFormProps) {
  const supabase = createClient()
  const router = useRouter()

  const [tipe, setTipe] = useState<TipeKas>((editing?.tipe as TipeKas) || 'pemasukan')
  const [nominal, setNominal] = useState(editing ? String(editing.nominal) : '')
  const [kategori, setKategori] = useState(editing?.kategori || KAS_CATEGORIES.pemasukan[0])
  const [tanggal, setTanggal] = useState(editing?.tanggal || todayLocal())
  const [keterangan, setKeterangan] = useState(editing?.keterangan || '')
  const [metode, setMetode] = useState(editing?.metode_pembayaran || 'Tunai')
  const [menyimpan, setMenyimpan] = useState(false)

  const gantiTipe = (t: TipeKas) => {
    setTipe(t)
    setKategori(KAS_CATEGORIES[t][0])
  }

  const kosongkan = () => {
    setTipe('pemasukan')
    setNominal('')
    setKategori(KAS_CATEGORIES.pemasukan[0])
    setTanggal(todayLocal())
    setKeterangan('')
    setMetode('Tunai')
  }

  async function cariProfilAktif(): Promise<string | null> {
    if (profilId !== undefined) return profilId
    const { data } = await supabase
      .from('profil_usaha')
      .select('id')
      .order('created_at', { ascending: false })
    return pickActiveProfile(data ?? [], getActiveProfilId())?.id ?? null
  }

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseNominal(nominal)
    if (parsed.error !== null) {
      alert(parsed.error)
      return
    }
    if (!tanggal) {
      alert('Tanggal wajib diisi.')
      return
    }
    // Transaksi yang belum terjadi tidak boleh dicatat (merusak skor & laporan)
    if (tanggal > todayLocal()) {
      alert('Tanggal transaksi tidak boleh melewati hari ini.')
      return
    }

    setMenyimpan(true)
    try {
      const isian = {
        tipe,
        nominal: parsed.value,
        kategori,
        tanggal,
        keterangan,
        metode_pembayaran: metode,
      }
      let hasil: TransaksiKas
      let usahaId: string | null
      if (editing) {
        const { data, error } = await supabase
          .from('transaksi_kas')
          .update(isian)
          .eq('id', editing.id)
          .select()
          .single()
        if (error) throw error
        hasil = data as TransaksiKas
        usahaId = hasil.profil_id
      } else {
        usahaId = await cariProfilAktif()
        const payload: TablesInsert<'transaksi_kas'> = { ...isian, profil_id: usahaId }
        const { data, error } = await supabase.from('transaksi_kas').insert(payload).select().single()
        if (error) throw error
        hasil = data as TransaksiKas
      }

      // PRD: setiap perubahan transaksi memicu hitung ulang skor, lalu skor disimpan.
      if (usahaId) {
        const err = await syncSkorSnapshot(supabase, usahaId)
        if (err) console.error('Gagal menyimpan skor kelayakan:', err)
      }
      router.refresh()

      if (!editing) kosongkan()
      onSaved?.(hasil, editing ? 'ubah' : 'baru')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menyimpan transaksi.')
    } finally {
      setMenyimpan(false)
    }
  }

  return (
    <div className="catat-kas-form">
      <div className="entry-card-header">
        <h2 className="entry-title-text">{editing ? 'Edit Transaksi Kas' : 'Catat Transaksi Kas'}</h2>
        <span className="entry-badge-live">{editing ? 'Sedang diubah' : 'Tersimpan otomatis'}</span>
      </div>

      <form onSubmit={simpan} className="entry-saas-form">
        {/* Jenis transaksi */}
        <div className="form-group-clean">
          <span className="form-label-clean">Jenis Transaksi</span>
          <div className="type-segmented-toggle" role="radiogroup" aria-label="Jenis transaksi">
            <button
              type="button"
              role="radio"
              aria-checked={tipe === 'pemasukan'}
              className={`type-pill-label type-pill-in ${tipe === 'pemasukan' ? 'is-active' : ''}`}
              onClick={() => gantiTipe('pemasukan')}
            >
              + Uang Masuk
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={tipe === 'pengeluaran'}
              className={`type-pill-label type-pill-out ${tipe === 'pengeluaran' ? 'is-active' : ''}`}
              onClick={() => gantiTipe('pengeluaran')}
            >
              - Uang Keluar
            </button>
          </div>
        </div>

        {/* Jumlah */}
        <div className="form-group-clean">
          <label className="form-label-clean" htmlFor={`${idPrefix}-nominal`}>
            Jumlah (Rp)
          </label>
          <div className="numeric-input-card">
            <span className="currency-prefix">Rp</span>
            <RupiahInput
              id={`${idPrefix}-nominal`}
              data-nominal
              className="numeric-amount-input"
              placeholder="0"
              required
              value={nominal}
              onValueChange={setNominal}
            />
          </div>
        </div>

        {/* Tanggal */}
        <div className="form-group-clean">
          <label className="form-label-clean" htmlFor={`${idPrefix}-tanggal`}>
            Tanggal
          </label>
          <div className="numeric-input-card">
            <input
              type="date"
              id={`${idPrefix}-tanggal`}
              className="date-input-clean"
              required
              max={todayLocal()}
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
            />
          </div>
        </div>

        {/* Kategori */}
        <div className="form-group-clean">
          <label className="form-label-clean" htmlFor={`${idPrefix}-kategori`}>
            Kategori
          </label>
          <select
            id={`${idPrefix}-kategori`}
            className="select-clean"
            value={kategori}
            onChange={(e) => setKategori(e.target.value)}
          >
            {KAS_CATEGORIES[tipe].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Metode pembayaran */}
        <div className="form-group-clean">
          <label className="form-label-clean" htmlFor={`${idPrefix}-metode`}>
            Metode Pembayaran
          </label>
          <select
            id={`${idPrefix}-metode`}
            className="select-clean"
            value={metode}
            onChange={(e) => setMetode(e.target.value)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Catatan */}
        <div className="form-group-clean">
          <label className="form-label-clean" htmlFor={`${idPrefix}-catatan`}>
            Catatan
          </label>
          <input
            type="text"
            id={`${idPrefix}-catatan`}
            className="text-input-clean"
            placeholder="Contoh: Belanja Biji Kopi Robusta"
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
          />
        </div>

        <div className="entry-cta-wrap">
          <button type="submit" disabled={menyimpan} className="btn btn-emerald-primary">
            <span className="material-symbols-rounded">
              {menyimpan ? 'hourglass_top' : editing ? 'check_circle' : 'add'}
            </span>
            <span>{menyimpan ? 'MENYIMPAN...' : editing ? 'PERBARUI TRANSAKSI' : 'SIMPAN TRANSAKSI KAS'}</span>
          </button>
          {editing && onCancelEdit && (
            <button type="button" className="btn btn-secondary-clean" onClick={onCancelEdit}>
              Batal Edit
            </button>
          )}
          {editing && onDelete && (
            <button type="button" className="btn btn-hapus-transaksi" onClick={onDelete}>
              <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                delete
              </span>
              Hapus Transaksi Ini
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
