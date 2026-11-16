-- ========================================================================
-- UTERA - Pengajuan pinjaman koperasi (PRD F13)
-- Jalankan di Supabase Dashboard > SQL Editor, SETELAH verifikasi.sql. Aman dijalankan ulang.
--
-- Aturan PRD: pengajuan koperasi hanya disimpan jika cicilan sesuai arus kas.
-- Aplikasi sudah menolaknya di layar; database ikut menjaganya lewat CHECK
-- (rasio_kas <= 30) supaya aturan tetap berlaku walau dipanggil dari luar aplikasi.
-- ========================================================================

-- 1. Penanda admin dan pemeriksa pemilik usaha (dibuat ulang bila belum ada)
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

CREATE OR REPLACE FUNCTION public.check_profil_owner() RETURNS trigger AS $$
BEGIN
  IF NEW.profil_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profil_usaha p WHERE p.id = NEW.profil_id AND p.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'profil_id bukan milik pengguna';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- 2. Tabel pengajuan pinjaman koperasi
CREATE TABLE IF NOT EXISTS public.pengajuan_koperasi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  profil_id uuid REFERENCES public.profil_usaha(id) ON DELETE CASCADE,
  nama_koperasi text NOT NULL CHECK (length(trim(nama_koperasi)) BETWEEN 3 AND 80),
  tujuan text NOT NULL CHECK (length(trim(tujuan)) > 0),
  plafon numeric NOT NULL CHECK (plafon BETWEEN 1000000 AND 500000000),
  tenor_bulan integer NOT NULL CHECK (tenor_bulan BETWEEN 3 AND 60),
  jasa_tahunan numeric NOT NULL CHECK (jasa_tahunan BETWEEN 0.1 AND 60), -- persen per tahun
  metode text NOT NULL CHECK (metode IN ('flat', 'menurun')),
  cicilan_awal numeric NOT NULL CHECK (cicilan_awal >= 0),
  cicilan_akhir numeric NOT NULL CHECK (cicilan_akhir >= 0),
  total_jasa numeric NOT NULL CHECK (total_jasa >= 0),
  rasio_kas numeric NOT NULL CHECK (rasio_kas >= 0 AND rasio_kas <= 30), -- cicilan awal / laba bulanan (%)
  status_guardrail text NOT NULL CHECK (status_guardrail IN ('aman', 'waspada')),
  status text NOT NULL DEFAULT 'direncanakan'
    CHECK (status IN ('direncanakan', 'diajukan', 'disetujui', 'ditolak')),
  catatan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pengajuan_koperasi_user_id ON public.pengajuan_koperasi(user_id);
CREATE INDEX IF NOT EXISTS idx_pengajuan_koperasi_profil_id ON public.pengajuan_koperasi(profil_id);

-- 3. Aturan akses: pemilik mengelola miliknya sendiri; admin hanya membaca
ALTER TABLE public.pengajuan_koperasi ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pengajuan_koperasi FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pengajuan_koperasi TO authenticated;

DROP POLICY IF EXISTS "pemilik baca" ON public.pengajuan_koperasi;
DROP POLICY IF EXISTS "pemilik tambah" ON public.pengajuan_koperasi;
DROP POLICY IF EXISTS "pemilik ubah" ON public.pengajuan_koperasi;
DROP POLICY IF EXISTS "pemilik hapus" ON public.pengajuan_koperasi;
DROP POLICY IF EXISTS "admin baca" ON public.pengajuan_koperasi;

CREATE POLICY "pemilik baca" ON public.pengajuan_koperasi FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "pemilik tambah" ON public.pengajuan_koperasi FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "pemilik ubah" ON public.pengajuan_koperasi FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "pemilik hapus" ON public.pengajuan_koperasi FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "admin baca" ON public.pengajuan_koperasi FOR SELECT TO authenticated
  USING (public.is_admin());

-- 4. Usaha yang dipilih harus milik pengguna yang sama
DROP TRIGGER IF EXISTS trg_check_profil_owner ON public.pengajuan_koperasi;
CREATE TRIGGER trg_check_profil_owner BEFORE INSERT OR UPDATE ON public.pengajuan_koperasi
  FOR EACH ROW EXECUTE FUNCTION public.check_profil_owner();

-- 5. Setelah lolos pengecekan arus kas, angka pengajuan tidak boleh diubah diam-diam.
--    Pemilik hanya boleh mengubah status dan catatan (mis. dari "direncanakan" ke "diajukan").
CREATE OR REPLACE FUNCTION public.pengajuan_koperasi_batasi_ubah() RETURNS trigger AS $$
BEGIN
  IF (NEW.user_id, NEW.profil_id, NEW.nama_koperasi, NEW.tujuan, NEW.plafon, NEW.tenor_bulan,
      NEW.jasa_tahunan, NEW.metode, NEW.cicilan_awal, NEW.cicilan_akhir, NEW.total_jasa,
      NEW.rasio_kas, NEW.status_guardrail)
     IS DISTINCT FROM
     (OLD.user_id, OLD.profil_id, OLD.nama_koperasi, OLD.tujuan, OLD.plafon, OLD.tenor_bulan,
      OLD.jasa_tahunan, OLD.metode, OLD.cicilan_awal, OLD.cicilan_akhir, OLD.total_jasa,
      OLD.rasio_kas, OLD.status_guardrail)
  THEN
    RAISE EXCEPTION 'Hanya status dan catatan pengajuan yang boleh diubah';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pengajuan_koperasi_batasi_ubah ON public.pengajuan_koperasi;
CREATE TRIGGER trg_pengajuan_koperasi_batasi_ubah BEFORE UPDATE ON public.pengajuan_koperasi
  FOR EACH ROW EXECUTE FUNCTION public.pengajuan_koperasi_batasi_ubah();

-- Muat ulang skema API agar tabel baru langsung terbaca aplikasi
NOTIFY pgrst, 'reload schema';
