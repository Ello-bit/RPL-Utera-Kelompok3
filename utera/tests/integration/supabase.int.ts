import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import { syncSkorSnapshot } from '../../lib/skor-sync'
import { todayLocal } from '../../lib/input'
import {
  fetchAllVerifications,
  fetchVerificationByProfil,
  submitVerificationRequest,
  reviewVerification,
} from '../../lib/verification'

// Jalankan: npm run test:integration (lihat tests/integration/README.md)
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const A = { email: process.env.TEST_A_EMAIL, password: process.env.TEST_A_PASSWORD }
const B = { email: process.env.TEST_B_EMAIL, password: process.env.TEST_B_PASSWORD }
const ADMIN = { email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD }

const MARKER = `UJI-INTEGRASI ${new Date().toISOString()}`

function newClient(): SupabaseClient<Database> {
  return createClient<Database>(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function login(c: SupabaseClient<Database>, cred: { email?: string; password?: string }) {
  const { data, error } = await c.auth.signInWithPassword({
    email: cred.email!,
    password: cred.password!,
  })
  if (error) throw new Error(`Login gagal untuk ${cred.email}: ${error.message}`)
  return data.user
}

const hasA = Boolean(A.email && A.password)
const hasB = Boolean(B.email && B.password)
const hasAdmin = Boolean(ADMIN.email && ADMIN.password)

describe('DB-01 akses tanpa login (anon)', () => {
  const anon = newClient()
  const tables = ['profil_usaha', 'transaksi_kas', 'legalitas_dokumen', 'simulasi_kur', 'skor_kelayakan'] as const

  for (const t of tables) {
    it(`anon tidak bisa membaca ${t}`, async () => {
      const { data, error } = await anon.from(t).select('id').limit(1)
      // Lulus bila ditolak (error) atau kosong; gagal bila ada baris yang bocor.
      expect(error !== null || (data ?? []).length === 0).toBe(true)
    })
  }

  it('anon tidak bisa menulis profil_usaha', async () => {
    const { error } = await anon.from('profil_usaha').insert({ nama_usaha: MARKER })
    expect(error).not.toBeNull()
  })
})

describe.skipIf(!hasA)('Akun A: CRUD dan integrasi antar modul', () => {
  const a = newClient()
  let userAId = ''
  let profilId = ''
  let txId = ''

  beforeAll(async () => {
    userAId = (await login(a, A)).id
  })

  afterAll(async () => {
    // Bersihkan: hapus profil uji (cascade ke transaksi, legalitas, simulasi, skor).
    if (profilId) await a.from('profil_usaha').delete().eq('id', profilId)
    await a.auth.signOut()
  })

  it('AUTH-A login berhasil dan sesi valid', async () => {
    const { data } = await a.auth.getUser()
    expect(data.user?.id).toBe(userAId)
  })

  it('PROF-01 buat profil usaha, user_id terisi otomatis', async () => {
    const { data, error } = await a
      .from('profil_usaha')
      .insert({ nama_usaha: MARKER, nama_pemilik: 'Penguji', jenis_usaha: 'Uji' })
      .select()
      .single()
    expect(error).toBeNull()
    expect(data!.user_id).toBe(userAId)
    profilId = data!.id
  })

  it('PROF-02 ubah profil usaha', async () => {
    const { data, error } = await a
      .from('profil_usaha')
      .update({ alamat_usaha: 'Alamat uji' })
      .eq('id', profilId)
      .select()
      .single()
    expect(error).toBeNull()
    expect(data!.alamat_usaha).toBe('Alamat uji')
  })

  it('KAS-C tambah transaksi dengan profil_id', async () => {
    const { data, error } = await a
      .from('transaksi_kas')
      .insert({
        tipe: 'pemasukan',
        nominal: 2_500_000,
        kategori: 'Penjualan',
        tanggal: todayLocal(),
        keterangan: MARKER,
        profil_id: profilId,
      })
      .select()
      .single()
    expect(error).toBeNull()
    expect(data!.user_id).toBe(userAId)
    expect(data!.profil_id).toBe(profilId)
    txId = data!.id
  })

  it('KAS-R transaksi terbaca bila difilter per profil', async () => {
    const { data, error } = await a.from('transaksi_kas').select('*').eq('profil_id', profilId)
    expect(error).toBeNull()
    expect(data!.map((t) => t.id)).toContain(txId)
  })

  it('KAS-U ubah transaksi', async () => {
    const { data, error } = await a
      .from('transaksi_kas')
      .update({ nominal: 3_000_000 })
      .eq('id', txId)
      .select()
      .single()
    expect(error).toBeNull()
    expect(Number(data!.nominal)).toBe(3_000_000)
  })

  it('KAS-V database menolak nominal 0 dan negatif', async () => {
    for (const nominal of [0, -5000]) {
      const { error } = await a.from('transaksi_kas').insert({
        tipe: 'pemasukan',
        nominal,
        kategori: 'Penjualan',
        tanggal: todayLocal(),
        profil_id: profilId,
      })
      expect(error, `nominal ${nominal} seharusnya ditolak`).not.toBeNull()
    }
  })

  it('SKOR-DB transaksi tersimpan memicu snapshot skor_kelayakan', async () => {
    const err = await syncSkorSnapshot(a, profilId)
    expect(err).toBeNull()
    const { data } = await a
      .from('skor_kelayakan')
      .select('*')
      .eq('profil_id', profilId)
      .order('created_at', { ascending: false })
      .limit(1)
    expect(data!.length).toBe(1)
    expect(data![0].skor).toBeGreaterThanOrEqual(0)
    expect(data![0].konsistensi_bulan).toBe(1)
  })

  it('SKOR-DB2 sinkron kedua di hari yang sama memperbarui, bukan menambah', async () => {
    await syncSkorSnapshot(a, profilId)
    const { data } = await a.from('skor_kelayakan').select('id').eq('profil_id', profilId)
    expect(data!.length).toBe(1)
  })

  it('KUR-DB simpan simulasi_kur dengan nilai baku', async () => {
    const { data, error } = await a
      .from('simulasi_kur')
      .insert({
        program: 'KUR Mikro (uji)',
        plafon: 30_000_000,
        bunga_tahunan: 6,
        tenor_bulan: 36,
        angsuran_bulanan: 912_658,
        rasio_kas: 10,
        status_guardrail: 'aman',
        profil_id: profilId,
      })
      .select()
      .single()
    expect(error).toBeNull()
    expect(data!.user_id).toBe(userAId)
  })

  it('LEG-DB simpan dokumen legalitas dengan masa berlaku', async () => {
    const { data, error } = await a
      .from('legalitas_dokumen')
      .insert({
        kategori: 'NIB',
        nama_dokumen: 'NIB (uji)',
        nomor_dokumen: '0000000000000',
        masa_berlaku: '2030-01-01',
        profil_id: profilId,
      })
      .select()
      .single()
    expect(error).toBeNull()
    expect(data!.masa_berlaku).toBe('2030-01-01')
  })

  it('VER-01 ajukan verifikasi tersimpan di database dengan status pending', async () => {
    const { record, error } = await submitVerificationRequest(a, {
      businessId: profilId,
      businessName: MARKER,
      ownerName: 'Penguji',
      phoneNumber: '-',
      businessSector: 'Uji',
      applicationType: 'Verifikasi Kredibilitas Lengkap (Siap KUR)',
      notes: MARKER,
      hasNib: true,
      nomorNib: '0000000000000',
      totalTransactions: 1,
      skorPRD: 10,
    })
    expect(error).toBeNull()
    expect(record!.status).toBe('pending')
    const again = await fetchVerificationByProfil(a, profilId)
    expect(again?.status).toBe('pending')
  })

  it('VER-02 pemilik tidak bisa mengesahkan verifikasinya sendiri', async () => {
    const { error } = await reviewVerification(a, profilId, 'verified', {
      certificateNumber: 'PALSU',
    })
    expect(error).not.toBeNull()
    expect((await fetchVerificationByProfil(a, profilId))?.status).toBe('pending')
  })

  const pengajuan = (notes: string) => ({
    businessId: profilId,
    businessName: MARKER,
    ownerName: 'Penguji',
    phoneNumber: '-',
    businessSector: 'Uji',
    applicationType: 'Verifikasi Kredibilitas Lengkap (Siap KUR)',
    notes,
    hasNib: false,
    totalTransactions: 1,
    skorPRD: 10,
  })

  it('VER-03 selagi pending, mengajukan lagi ditolak (satu pengajuan per usaha)', async () => {
    const { record, error } = await submitVerificationRequest(a, pengajuan('pengajuan kedua'))
    expect(record).toBeNull()
    expect(error).not.toBeNull()
    const { data } = await a.from('verifikasi_usaha').select('id').eq('profil_id', profilId)
    expect(data!.length).toBe(1)
  })

  it('VER-04 database juga menolak pengajuan ulang langsung (tanpa lewat aplikasi)', async () => {
    const { data } = await a
      .from('verifikasi_usaha')
      .update({ catatan: 'diubah paksa' })
      .eq('profil_id', profilId)
      .select()
    expect(data ?? []).toEqual([])
  })

  describe.skipIf(!hasAdmin)('VER-ADMIN admin melihat dan meninjau pengajuan', () => {
    const admin = newClient()

    beforeAll(async () => {
      await login(admin, ADMIN)
    })

    afterAll(async () => {
      await admin.auth.signOut()
    })

    it('admin melihat pengajuan akun A', async () => {
      const { data, error } = await fetchAllVerifications(admin)
      expect(error).toBeNull()
      expect(data.map((v) => v.businessId)).toContain(profilId)
    })

    it('admin bisa membaca profil usaha akun A (pemantauan)', async () => {
      const { data } = await admin.from('profil_usaha').select('id').eq('id', profilId)
      expect(data!.length).toBe(1)
    })

    it('admin menolak, lalu pemilik boleh mengajukan ulang (status kembali pending)', async () => {
      const rej = await reviewVerification(admin, profilId, 'rejected', {
        note: 'Uji: berkas kurang',
      })
      expect(rej.error).toBeNull()
      const seen = await fetchVerificationByProfil(a, profilId)
      expect(seen?.status).toBe('rejected')
      expect(seen?.adminNote).toBe('Uji: berkas kurang') // pemilik melihat catatan penolakan

      const again = await submitVerificationRequest(a, pengajuan('pengajuan ulang setelah ditolak'))
      expect(again.error).toBeNull()
      expect(again.record!.status).toBe('pending')
      expect(again.record!.adminNote).toBeUndefined() // catatan lama dibersihkan
    })

    it('admin mengesahkan dengan catatan, pemilik melihat status dan catatannya', async () => {
      const { error } = await reviewVerification(admin, profilId, 'verified', {
        note: 'Uji: pembukuan rapi',
        certificateNumber: 'UTERA-VERIF-UJI',
      })
      expect(error).toBeNull()
      const rec = await fetchVerificationByProfil(a, profilId)
      expect(rec?.status).toBe('verified')
      expect(rec?.certificateNumber).toBe('UTERA-VERIF-UJI')
      expect(rec?.adminNote).toBe('Uji: pembukuan rapi')
    })

    it('keputusan yang sudah diambil tidak bisa diubah lagi oleh admin', async () => {
      const { error } = await reviewVerification(admin, profilId, 'rejected', { note: 'ubah pikiran' })
      expect(error).not.toBeNull()
      expect((await fetchVerificationByProfil(a, profilId))?.status).toBe('verified')
    })

    it('setelah terverifikasi, pemilik tidak bisa mengajukan lagi', async () => {
      const { record, error } = await submitVerificationRequest(a, pengajuan('setelah verified'))
      expect(record).toBeNull()
      expect(error).not.toBeNull()
    })

    it('admin tidak bisa mengubah transaksi akun A', async () => {
      const { data } = await admin.from('transaksi_kas').update({ nominal: 1 }).eq('id', txId).select()
      expect(data ?? []).toEqual([])
    })
  })

  describe.skipIf(!hasB)('E2E-02 isolasi: akun B terhadap data akun A', () => {
    const b = newClient()

    beforeAll(async () => {
      const userB = await login(b, B)
      expect(userB.id).not.toBe(userAId)
    })

    afterAll(async () => {
      await b.auth.signOut()
    })

    it('B tidak bisa membaca profil, transaksi, skor, simulasi, legalitas milik A', async () => {
      const checks = await Promise.all([
        b.from('profil_usaha').select('id').eq('id', profilId),
        b.from('transaksi_kas').select('id').eq('id', txId),
        b.from('skor_kelayakan').select('id').eq('profil_id', profilId),
        b.from('simulasi_kur').select('id').eq('profil_id', profilId),
        b.from('legalitas_dokumen').select('id').eq('profil_id', profilId),
      ])
      for (const r of checks) expect(r.data ?? []).toEqual([])
    })

    it('B tidak bisa melihat atau menyetujui pengajuan verifikasi A', async () => {
      const { data } = await fetchAllVerifications(b)
      expect(data.map((v) => v.businessId)).not.toContain(profilId)
      const { error } = await reviewVerification(b, profilId, 'verified')
      expect(error).not.toBeNull()
    })

    it('B tidak bisa mengubah transaksi A', async () => {
      const { data } = await b.from('transaksi_kas').update({ nominal: 1 }).eq('id', txId).select()
      expect(data ?? []).toEqual([])
      const { data: still } = await a.from('transaksi_kas').select('nominal').eq('id', txId).single()
      expect(Number(still!.nominal)).toBe(3_000_000)
    })

    it('B tidak bisa menghapus transaksi A', async () => {
      await b.from('transaksi_kas').delete().eq('id', txId)
      const { data } = await a.from('transaksi_kas').select('id').eq('id', txId)
      expect(data!.length).toBe(1)
    })

    it('B tidak bisa menulis transaksi ke usaha milik A (profil_id A)', async () => {
      const { error } = await b.from('transaksi_kas').insert({
        tipe: 'pemasukan',
        nominal: 1000,
        kategori: 'Penjualan',
        tanggal: todayLocal(),
        profil_id: profilId,
      })
      expect(error).not.toBeNull()
    })

    it('B tidak bisa menyamar sebagai A lewat user_id', async () => {
      const { error } = await b.from('profil_usaha').insert({ nama_usaha: MARKER, user_id: userAId })
      expect(error).not.toBeNull()
    })
  })

  it('KAS-D hapus transaksi', async () => {
    const { error } = await a.from('transaksi_kas').delete().eq('id', txId)
    expect(error).toBeNull()
    const { data } = await a.from('transaksi_kas').select('id').eq('id', txId)
    expect(data).toEqual([])
  })
})
