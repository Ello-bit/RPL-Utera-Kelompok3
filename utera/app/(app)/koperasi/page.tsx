'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import BannerKasKosong from '../banner-kas-kosong'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/database.types'
import { formatRupiah } from '@/lib/kas'
import { calculateSkorPRD, rataLabaBulanan } from '@/lib/skor'
import { getActiveProfilId, pickActiveProfile } from '@/lib/profil-aktif'
import {
  BATAS_KOPERASI,
  LABEL_STATUS,
  METODE_JASA,
  STATUS_PENGAJUAN,
  TUJUAN_PINJAMAN,
  evaluasiPengajuan,
  hitungKoperasi,
  parseJasa,
  plafonMaksimalAman,
  validasiPengajuan,
  type MetodeJasa,
  bandingkanPengajuan,
  type Pemenang,
  type RingkasPengajuan,
  type StatusPengajuan,
} from '@/lib/koperasi'
import PlafonInput from '../plafon-input'
import KonfirmasiHapus from '../catat-kas/konfirmasi-hapus'
import './koperasi.css'

type TransaksiKas = Tables<'transaksi_kas'>
type Pengajuan = Tables<'pengajuan_koperasi'>

const PILIHAN_TENOR = [6, 12, 18, 24, 36, 48, 60]

/** Ubah satu baris riwayat menjadi bentuk yang dipakai perbandingan */
function ringkas(p: Pengajuan, label: string): RingkasPengajuan {
  return {
    label,
    plafon: Number(p.plafon),
    tenor: p.tenor_bulan,
    jasaPersen: Number(p.jasa_tahunan),
    metode: p.metode === 'menurun' ? 'menurun' : 'flat',
    cicilanAwal: Number(p.cicilan_awal),
    cicilanAkhir: Number(p.cicilan_akhir),
    totalJasa: Number(p.total_jasa),
    rasioKas: Number(p.rasio_kas),
  }
}

const rupiahBertanda = (n: number) => (n === 0 ? 'Rp 0' : (n < 0 ? '− ' : '+ ') + formatRupiah(Math.abs(n)))

const tanggalPendek = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

export default function KoperasiPage() {
  const supabase = createClient()

  // Data usaha
  const [transactions, setTransactions] = useState<TransaksiKas[]>([])
  const [profilId, setProfilId] = useState<string | null>(null)
  const [dataSiap, setDataSiap] = useState(false)

  // Riwayat pengajuan
  const [riwayat, setRiwayat] = useState<Pengajuan[]>([])
  const [riwayatSiap, setRiwayatSiap] = useState(false)
  const [tabelBelumAda, setTabelBelumAda] = useState(false)
  const [riwayatError, setRiwayatError] = useState<string | null>(null)

  // Isian
  const [namaKoperasi, setNamaKoperasi] = useState('')
  const [tujuan, setTujuan] = useState<string>(TUJUAN_PINJAMAN[0])
  const [plafon, setPlafon] = useState(20_000_000)
  const [tenor, setTenor] = useState(24)
  const [jasaTeks, setJasaTeks] = useState('9')
  const [metode, setMetode] = useState<MetodeJasa>('flat')
  const [catatan, setCatatan] = useState('')

  const [tampilSalah, setTampilSalah] = useState(false)
  const [menyimpan, setMenyimpan] = useState(false)
  const [toast, setToast] = useState<{ teks: string; gagal?: boolean } | null>(null)
  const [hapusTarget, setHapusTarget] = useState<Pengajuan | null>(null)
  // Id pengajuan yang dicentang "Bandingkan" (paling banyak dua)
  const [dipilih, setDipilih] = useState<string[]>([])
  const [menghapus, setMenghapus] = useState(false)

  const tampilkanToast = (teks: string, gagal = false) => {
    setToast({ teks, gagal })
    window.setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    async function muat() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      // Halaman ini hanya untuk pengguna login (dijaga middleware)
      if (!user) {
        setDataSiap(true)
        setRiwayatSiap(true)
        return
      }

      const { data: profs } = await supabase
        .from('profil_usaha')
        .select('id')
        .order('created_at', { ascending: false })
      const aktif = pickActiveProfile(profs ?? [], getActiveProfilId())
      setProfilId(aktif?.id ?? null)

      let txQuery = supabase.from('transaksi_kas').select('*')
      if (aktif) txQuery = txQuery.eq('profil_id', aktif.id)
      const { data: tx } = await txQuery
      setTransactions((tx ?? []) as TransaksiKas[])
      setDataSiap(true)

      let rQuery = supabase.from('pengajuan_koperasi').select('*').order('created_at', { ascending: false })
      if (aktif) rQuery = rQuery.eq('profil_id', aktif.id)
      const { data: rows, error } = await rQuery
      if (error) {
        // Tabel belum dibuat di Supabase (supabase/koperasi.sql belum dijalankan)
        if (error.code === '42P01' || /does not exist|schema cache/i.test(error.message)) setTabelBelumAda(true)
        else setRiwayatError(error.message)
      } else {
        setRiwayat((rows ?? []) as Pengajuan[])
      }
      setRiwayatSiap(true)
    }
    muat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Laba bulanan: rata-rata laba bersih dari bulan yang tercatat, maksimal 6 bulan terakhir
  const laba = useMemo(() => Math.max(0, rataLabaBulanan(calculateSkorPRD(transactions))), [transactions])

  const jasa = useMemo(() => parseJasa(jasaTeks), [jasaTeks])
  const hasil = useMemo(
    () => hitungKoperasi(plafon, jasa.value ?? 0, tenor, metode),
    [plafon, jasa.value, tenor, metode]
  )
  const evaluasi = useMemo(() => evaluasiPengajuan(hasil.cicilanAwal, laba), [hasil.cicilanAwal, laba])
  const batasAman = Math.round(laba * 0.3)
  const maksAman = useMemo(() => plafonMaksimalAman(laba, jasa.value ?? 0, tenor), [laba, jasa.value, tenor])

  const daftarSalah = useMemo(() => {
    const salah = validasiPengajuan({
      namaKoperasi,
      tujuan,
      plafon,
      tenor,
      jasaPersen: jasa.value ?? 0,
    })
    // Pesan jasa dari parseJasa lebih jelas daripada pesan umum
    const tanpaJasa = salah.filter((s) => !s.startsWith('Jasa per tahun'))
    return jasa.error ? [...tanpaJasa, jasa.error] : tanpaJasa
  }, [namaKoperasi, tujuan, plafon, tenor, jasa])

  const labelStatus =
    evaluasi.guard.statusText === 'Kondisi Aman'
      ? 'Aman'
      : evaluasi.guard.statusText === 'Batas Waspada'
        ? 'Waspada'
        : 'Melebihi batas'
  const kelasStatus =
    evaluasi.guard.statusText === 'Kondisi Aman'
      ? 'kop-badge aman'
      : evaluasi.guard.statusText === 'Batas Waspada'
        ? 'kop-badge waspada'
        : 'kop-badge lewat'

  async function simpan() {
    setTampilSalah(true)
    if (daftarSalah.length > 0 || jasa.value === null) return
    if (!evaluasi.boleh) return

    setMenyimpan(true)
    const rasio = Math.round(evaluasi.guard.ratio * 10) / 10
    const { data, error } = await supabase
      .from('pengajuan_koperasi')
      .insert({
        profil_id: profilId,
        nama_koperasi: namaKoperasi.trim(),
        tujuan,
        plafon,
        tenor_bulan: tenor,
        jasa_tahunan: jasa.value,
        metode,
        cicilan_awal: hasil.cicilanAwal,
        cicilan_akhir: hasil.cicilanAkhir,
        total_jasa: hasil.totalJasa,
        rasio_kas: rasio,
        status_guardrail: rasio <= 25 ? 'aman' : 'waspada',
        catatan: catatan.trim() || null,
      })
      .select()
      .single()
    setMenyimpan(false)

    if (error) {
      if (error.code === '42P01' || /does not exist|schema cache/i.test(error.message)) setTabelBelumAda(true)
      tampilkanToast('Gagal menyimpan pengajuan: ' + error.message, true)
      return
    }
    setRiwayat((prev) => [data as Pengajuan, ...prev])
    setTampilSalah(false)
    setNamaKoperasi('')
    setCatatan('')
    tampilkanToast('Pengajuan berhasil disimpan.')
  }

  async function ubahStatus(p: Pengajuan, status: StatusPengajuan) {
    const { data, error } = await supabase
      .from('pengajuan_koperasi')
      .update({ status })
      .eq('id', p.id)
      .select('id')
    if (error || !data || data.length === 0) {
      tampilkanToast('Gagal mengubah status' + (error ? ': ' + error.message : '.'), true)
      return
    }
    setRiwayat((prev) => prev.map((r) => (r.id === p.id ? { ...r, status } : r)))
    tampilkanToast('Status diubah menjadi "' + LABEL_STATUS[status] + '".')
  }

  async function konfirmasiHapus() {
    if (!hapusTarget) return
    setMenghapus(true)
    // .select('id') memastikan ada baris yang benar-benar terhapus (RLS bisa menghapus 0 baris tanpa galat)
    const { data, error } = await supabase.from('pengajuan_koperasi').delete().eq('id', hapusTarget.id).select('id')
    setMenghapus(false)
    if (error || !data || data.length === 0) {
      tampilkanToast('Gagal menghapus' + (error ? ': ' + error.message : '.'), true)
      return
    }
    setRiwayat((prev) => prev.filter((r) => r.id !== hapusTarget.id))
    setDipilih((prev) => prev.filter((id) => id !== hapusTarget.id))
    setHapusTarget(null)
    tampilkanToast('Pengajuan berhasil dihapus.')
  }

  const pilihBanding = (id: string) =>
    setDipilih((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 2 ? prev : [...prev, id]))

  // Dua pengajuan yang dicentang, urut sesuai pilihan (A lalu B)
  const pasangan = useMemo(() => {
    if (dipilih.length !== 2) return null
    const a = riwayat.find((p) => p.id === dipilih[0])
    const b = riwayat.find((p) => p.id === dipilih[1])
    if (!a || !b) return null
    const sama = a.nama_koperasi.trim().toLowerCase() === b.nama_koperasi.trim().toLowerCase()
    const labelA = sama ? a.nama_koperasi + ' (A)' : a.nama_koperasi
    const labelB = sama ? b.nama_koperasi + ' (B)' : b.nama_koperasi
    return { a, b, labelA, labelB, banding: bandingkanPengajuan(ringkas(a, labelA), ringkas(b, labelB)) }
  }, [dipilih, riwayat])

  const tidakAdaKas = dataSiap && transactions.length === 0

  return (
    <div className="dashboard-scroll-wrap" aria-busy={!dataSiap}>
      {toast && (
        <div
          className="catat-kas-toast"
          role="status"
          style={toast.gagal ? { background: 'var(--terracotta)' } : undefined}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
            {toast.gagal ? 'error' : 'check_circle'}
          </span>
          {toast.teks}
        </div>
      )}

      {hapusTarget && (
        <KonfirmasiHapus
          tx={{
            tanggal: tanggalPendek(hapusTarget.created_at),
            keterangan: hapusTarget.nama_koperasi,
            kategori: hapusTarget.tujuan,
            nominal: hapusTarget.plafon,
            tipe: 'pemasukan',
          }}
          judul="Hapus pengajuan ini?"
          pesan="Pengajuan akan dihapus permanen dan tidak bisa dikembalikan."
          nilai={formatRupiah(Number(hapusTarget.plafon))}
          menghapus={menghapus}
          onBatal={() => setHapusTarget(null)}
          onHapus={konfirmasiHapus}
        />
      )}

      <div className="dash-header-row">
        <div>
          <h1 className="dash-heading">Pinjaman Koperasi</h1>
          <p className="dash-subheading">
            Hitung cicilan koperasi, cek keamanannya untuk kas, lalu simpan rencana pengajuan.
          </p>
        </div>
      </div>

      {tidakAdaKas && <BannerKasKosong keterangan="Kalkulator tetap bisa dicoba." />}

      <div className="kop-grid">
        {/* ---------------- Isian ---------------- */}
        <section className="dash-panel kop-form">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Data Pinjaman</h2>
              <p className="panel-subtitle">Isi sesuai tawaran koperasi. Hasil hitungan langsung muncul.</p>
            </div>
          </div>

          <div className="kop-field">
            <label htmlFor="kop-nama">Nama koperasi</label>
            <input
              id="kop-nama"
              type="text"
              maxLength={80}
              placeholder="Contoh: Koperasi Sejahtera Bersama"
              value={namaKoperasi}
              onChange={(e) => setNamaKoperasi(e.target.value)}
            />
          </div>

          <div className="kop-field">
            <label htmlFor="kop-tujuan">Tujuan pinjaman</label>
            <select id="kop-tujuan" value={tujuan} onChange={(e) => setTujuan(e.target.value)}>
              {TUJUAN_PINJAMAN.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="kop-field">
            <label htmlFor="kop-plafon">Jumlah pinjaman</label>
            <div className="kop-rupiah">
              <span>Rp</span>
              <PlafonInput
                id="kop-plafon"
                value={plafon}
                min={BATAS_KOPERASI.minPlafon}
                max={BATAS_KOPERASI.maxPlafon}
                onChange={setPlafon}
              />
            </div>
            <small>Antara Rp 1.000.000 dan Rp 500.000.000</small>
          </div>

          <div className="kop-dua">
            <div className="kop-field">
              <label htmlFor="kop-tenor">Jangka waktu</label>
              <select id="kop-tenor" value={tenor} onChange={(e) => setTenor(Number(e.target.value))}>
                {PILIHAN_TENOR.map((t) => (
                  <option key={t} value={t}>
                    {t} bulan
                  </option>
                ))}
              </select>
            </div>

            <div className="kop-field">
              <label htmlFor="kop-jasa">Jasa per tahun</label>
              <div className="kop-rupiah kop-persen">
                <input
                  id="kop-jasa"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={jasaTeks}
                  aria-invalid={jasa.error !== null}
                  onChange={(e) => setJasaTeks(e.target.value)}
                />
                <span>%</span>
              </div>
              {jasa.error && <small className="kop-salah">{jasa.error}</small>}
            </div>
          </div>

          <div className="kop-field">
            <span className="kop-label">Cara menghitung jasa</span>
            <div className="kop-metode" role="radiogroup" aria-label="Cara menghitung jasa">
              {(Object.keys(METODE_JASA) as MetodeJasa[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={metode === m}
                  className={metode === m ? 'aktif' : ''}
                  onClick={() => setMetode(m)}
                >
                  <strong>{METODE_JASA[m].nama}</strong>
                  <span>{METODE_JASA[m].penjelasan}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="kop-field">
            <label htmlFor="kop-catatan">Catatan (boleh dikosongkan)</label>
            <input
              id="kop-catatan"
              type="text"
              maxLength={160}
              placeholder="Contoh: bertemu petugas koperasi hari Senin"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
            />
          </div>
        </section>

        {/* ---------------- Hasil ---------------- */}
        <section className="dash-panel kop-hasil">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Hasil Hitungan</h2>
              <p className="panel-subtitle">Jasa {jasa.value ?? '-'}% per tahun, cara {METODE_JASA[metode].nama.toLowerCase()}</p>
            </div>
            {dataSiap && laba > 0 && jasa.value !== null && <span className={kelasStatus}>{labelStatus}</span>}
          </div>

          <div className="kop-cicilan">
            <span>Cicilan per bulan{metode === 'menurun' ? ' (bulan pertama)' : ''}</span>
            <strong>{formatRupiah(hasil.cicilanAwal)}</strong>
            {metode === 'menurun' && hasil.cicilanAkhir !== hasil.cicilanAwal && (
              <small>Makin kecil tiap bulan, sampai {formatRupiah(hasil.cicilanAkhir)} di bulan terakhir.</small>
            )}
          </div>

          <dl className="kop-rincian">
            <div>
              <dt>Total jasa (bunga)</dt>
              <dd>{formatRupiah(hasil.totalJasa)}</dd>
            </div>
            <div>
              <dt>Total yang dibayar</dt>
              <dd>{formatRupiah(hasil.totalBayar)}</dd>
            </div>
            <div>
              <dt>Batas aman cicilan (30% laba)</dt>
              <dd>{dataSiap ? (laba > 0 ? formatRupiah(batasAman) : '-') : '…'}</dd>
            </div>
            <div>
              <dt>Cicilan dibanding laba</dt>
              <dd>{dataSiap && laba > 0 ? evaluasi.guard.ratio.toFixed(1) + '%' : '-'}</dd>
            </div>
          </dl>

          {dataSiap && evaluasi.alasan === 'melebihi-batas' && (
            <div className="kop-peringatan" role="alert">
              <span className="material-symbols-rounded">warning</span>
              <div>
                <strong>Cicilan ini melebihi batas aman</strong>
                <p>
                  Cicilan {formatRupiah(hasil.cicilanAwal)} melebihi {formatRupiah(batasAman)} (30% laba bulanan). Pengajuan tidak bisa disimpan.
                  {maksAman >= BATAS_KOPERASI.minPlafon
                    ? ` Pinjaman maksimal yang masih aman sekitar ${formatRupiah(maksAman)}, atau perpanjang jangka waktu.`
                    : ' Perpanjang jangka waktu atau kecilkan pinjaman.'}
                </p>
              </div>
            </div>
          )}

          {dataSiap && evaluasi.alasan === 'belum-ada-kas' && (
            <div className="kop-peringatan netral" role="status">
              <span className="material-symbols-rounded">info</span>
              <div>
                <strong>Batas aman belum bisa dihitung</strong>
                <p>
                  Belum ada laba di catatan kas, jadi pengajuan belum bisa disimpan.
                </p>
              </div>
            </div>
          )}

          {tampilSalah && daftarSalah.length > 0 && (
            <ul className="kop-daftar-salah" role="alert">
              {daftarSalah.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}

          <button
            type="button"
            className="btn btn-primary kop-simpan"
            disabled={menyimpan || !dataSiap || !evaluasi.boleh}
            onClick={simpan}
          >
            <span className="kop-ikon">
              <span className="material-symbols-rounded">{menyimpan ? 'hourglass_top' : 'save'}</span>
            </span>
            {menyimpan ? 'Menyimpan…' : 'Simpan Pengajuan'}
          </button>
          {!evaluasi.boleh && dataSiap && (
            <p className="kop-bantu">
              {evaluasi.alasan === 'melebihi-batas'
                ? 'Tombol aktif lagi setelah cicilan masuk batas aman.'
                : 'Tombol aktif setelah ada catatan kas dengan laba positif.'}
            </p>
          )}
          <Link href="/guardrail#section-perbandingan" className="kop-tautan">
            Bandingkan koperasi dengan KUR dan kredit lain →
          </Link>
        </section>
      </div>

      {/* ---------------- Riwayat ---------------- */}
      <section className="dash-panel kop-riwayat">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Riwayat Pengajuan</h2>
            <p className="panel-subtitle">Ubah statusnya sesuai perkembangan di koperasi.</p>
          </div>
        </div>

        {tabelBelumAda && (
          <div className="kop-peringatan netral" role="status">
            <span className="material-symbols-rounded">database</span>
            <div>
              <strong>Tabel pengajuan belum dibuat</strong>
              <p>
                Jalankan file <code>supabase/koperasi.sql</code> di Supabase Dashboard &gt; SQL Editor, lalu muat ulang
                halaman ini.
              </p>
            </div>
          </div>
        )}
        {riwayatError && <p className="kop-salah">Gagal memuat riwayat: {riwayatError}</p>}

        {!tabelBelumAda && !riwayatError && !riwayatSiap && <p className="kop-bantu">Memuat riwayat…</p>}

        {!tabelBelumAda && !riwayatError && riwayatSiap && riwayat.length === 0 && (
          <div className="kop-kosong">
            <span className="material-symbols-rounded">handshake</span>
            <p>Belum ada pengajuan tersimpan.</p>
          </div>
        )}

        {riwayat.length === 1 && (
          <p className="kop-petunjuk-banding">
            <span className="kop-ikon">
              <span className="material-symbols-rounded">compare_arrows</span>
            </span>
            Simpan satu pengajuan lagi untuk bisa membandingkan keduanya.
          </p>
        )}

        {riwayat.length >= 2 && (
          <p className="kop-petunjuk-banding">
            <span className="kop-ikon">
              <span className="material-symbols-rounded">compare_arrows</span>
            </span>
            {dipilih.length === 0 && 'Centang "Bandingkan" pada dua pengajuan.'}
            {dipilih.length === 1 && 'Satu dipilih. Centang satu pengajuan lagi untuk membandingkan.'}
            {dipilih.length === 2 && 'Dua pengajuan dibandingkan di bawah ini.'}
          </p>
        )}

        {pasangan && (
          <div className="kop-banding" id="kop-perbandingan">
            <div className="kop-banding-kepala">
              <h3>Perbandingan Pengajuan</h3>
              <button type="button" onClick={() => setDipilih([])}>
                Tutup perbandingan
              </button>
            </div>

            <div className="kop-banding-gulir">
              <table>
                <thead>
                  <tr>
                    <th>Aspek</th>
                    <th>{pasangan.labelA}</th>
                    <th>{pasangan.labelB}</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      { label: 'Tujuan', a: pasangan.a.tujuan, b: pasangan.b.tujuan },
                      { label: 'Jumlah pinjaman', a: formatRupiah(Number(pasangan.a.plafon)), b: formatRupiah(Number(pasangan.b.plafon)) },
                      { label: 'Jangka waktu', a: pasangan.a.tenor_bulan + ' bulan', b: pasangan.b.tenor_bulan + ' bulan' },
                      { label: 'Jasa per tahun', a: Number(pasangan.a.jasa_tahunan) + '%', b: Number(pasangan.b.jasa_tahunan) + '%' },
                      {
                        label: 'Cara hitung jasa',
                        a: pasangan.a.metode === 'flat' ? 'Flat' : 'Menurun',
                        b: pasangan.b.metode === 'flat' ? 'Flat' : 'Menurun',
                      },
                      {
                        label: 'Cicilan per bulan',
                        a: formatRupiah(Number(pasangan.a.cicilan_awal)),
                        b: formatRupiah(Number(pasangan.b.cicilan_awal)),
                        menang: pasangan.banding.samaPlafon ? pasangan.banding.pemenang.cicilan : undefined,
                        tanda: 'Lebih ringan',
                      },
                      {
                        label: 'Cicilan bulan terakhir',
                        a: formatRupiah(Number(pasangan.a.cicilan_akhir)),
                        b: formatRupiah(Number(pasangan.b.cicilan_akhir)),
                      },
                      {
                        label: 'Total jasa',
                        a: formatRupiah(Number(pasangan.a.total_jasa)),
                        b: formatRupiah(Number(pasangan.b.total_jasa)),
                        menang: pasangan.banding.samaPlafon ? pasangan.banding.pemenang.totalJasa : undefined,
                        tanda: 'Lebih hemat',
                      },
                      {
                        label: 'Total yang dibayar',
                        a: formatRupiah(pasangan.banding.totalBayar.a),
                        b: formatRupiah(pasangan.banding.totalBayar.b),
                      },
                      {
                        label: 'Jasa per Rp 1 juta pinjaman',
                        a: formatRupiah(pasangan.banding.jasaPerJuta.a),
                        b: formatRupiah(pasangan.banding.jasaPerJuta.b),
                        menang: pasangan.banding.pemenang.jasaPerJuta,
                        tanda: 'Lebih hemat',
                      },
                      {
                        label: 'Cicilan dibanding laba',
                        a: Number(pasangan.a.rasio_kas).toFixed(1) + '%',
                        b: Number(pasangan.b.rasio_kas).toFixed(1) + '%',
                        menang: pasangan.banding.samaPlafon ? pasangan.banding.pemenang.rasio : undefined,
                        tanda: 'Lebih aman',
                      },
                    ] as { label: string; a: string; b: string; menang?: Pemenang; tanda?: string }[]
                  ).map((baris) => (
                    <tr key={baris.label}>
                      <th scope="row">{baris.label}</th>
                      {(['a', 'b'] as const).map((sisi) => (
                        <td key={sisi} className={baris.menang === sisi ? 'menang' : undefined}>
                          {baris[sisi]}
                          {baris.menang === sisi && <span className="kop-menang">{baris.tanda}</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="kop-selisih">
              <div>
                <dt>Selisih cicilan per bulan (A − B)</dt>
                <dd>{rupiahBertanda(pasangan.banding.selisihCicilanAwal)}</dd>
              </div>
              <div>
                <dt>Selisih total jasa (A − B)</dt>
                <dd>{rupiahBertanda(pasangan.banding.selisihTotalJasa)}</dd>
              </div>
            </dl>

            <p className="kop-kesimpulan">
              <strong>Kesimpulan:</strong> {pasangan.banding.kesimpulan}
            </p>
            <p className="kop-catatan-banding">
              {pasangan.banding.samaPlafon
                ? 'A adalah pengajuan yang dicentang pertama.'
                : 'Jumlah pinjaman berbeda, jadi yang dibandingkan adalah jasa per Rp 1 juta. A adalah yang dicentang pertama.'}
            </p>
          </div>
        )}

        {riwayat.length > 0 && (
          <div className="kop-kartu-grid">
            {riwayat.map((r) => (
              <article key={r.id} className={'kop-kartu' + (dipilih.includes(r.id) ? ' dipilih' : '')}>
                <header>
                  <div>
                    <strong>{r.nama_koperasi}</strong>
                    <span>{r.tujuan}</span>
                  </div>
                  <select
                    className={'kop-status ' + r.status}
                    value={r.status}
                    aria-label={'Status pengajuan ' + r.nama_koperasi}
                    onChange={(e) => ubahStatus(r, e.target.value as StatusPengajuan)}
                  >
                    {STATUS_PENGAJUAN.map((s) => (
                      <option key={s} value={s}>
                        {LABEL_STATUS[s]}
                      </option>
                    ))}
                  </select>
                </header>

                <dl>
                  <div>
                    <dt>Pinjaman</dt>
                    <dd>
                      {formatRupiah(Number(r.plafon))} · {r.tenor_bulan} bulan
                    </dd>
                  </div>
                  <div>
                    <dt>Jasa</dt>
                    <dd>
                      {Number(r.jasa_tahunan)}% per tahun ({r.metode === 'flat' ? 'flat' : 'menurun'})
                    </dd>
                  </div>
                  <div>
                    <dt>Cicilan</dt>
                    <dd>
                      {formatRupiah(Number(r.cicilan_awal))}
                      {Number(r.cicilan_akhir) !== Number(r.cicilan_awal) && ` → ${formatRupiah(Number(r.cicilan_akhir))}`} per
                      bulan
                    </dd>
                  </div>
                  <div>
                    <dt>Total jasa</dt>
                    <dd>{formatRupiah(Number(r.total_jasa))}</dd>
                  </div>
                </dl>

                {r.catatan && <p className="kop-kartu-catatan">{r.catatan}</p>}

                <footer>
                  <span>
                    {tanggalPendek(r.created_at)} · {Number(r.rasio_kas).toFixed(1)}% dari laba
                  </span>
                  <div className="kop-aksi-kartu">
                    {riwayat.length >= 2 && (
                      <label
                        className="kop-pilih"
                        title={!dipilih.includes(r.id) && dipilih.length >= 2 ? 'Sudah dua pengajuan dipilih' : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={dipilih.includes(r.id)}
                          disabled={!dipilih.includes(r.id) && dipilih.length >= 2}
                          onChange={() => pilihBanding(r.id)}
                        />
                        Bandingkan
                      </label>
                    )}
                    <button type="button" className="kop-hapus" onClick={() => setHapusTarget(r)}>
                      <span className="kop-ikon">
                        <span className="material-symbols-rounded">delete</span>
                      </span>
                      Hapus
                    </button>
                  </div>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
