-- ========================================================================
-- UTERA - Pengajuan verifikasi usaha + akses baca admin
-- Jalankan SETELAH hardening.sql, di Supabase Dashboard > SQL Editor. Idempotent.
--
-- Sebelumnya pengajuan verifikasi disimpan di localStorage browser, sehingga
-- admin di browser lain tidak pernah melihatnya. Tabel ini menggantikannya.
-- ========================================================================

-- 1. Penanda admin: hanya dari app_metadata (tidak bisa diubah pengguna sendiri)
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

-- 2. Tabel pengajuan verifikasi (satu baris per usaha)
CREATE TABLE IF NOT EXISTS public.verifikasi_usaha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  profil_id uuid NOT NULL UNIQUE REFERENCES public.profil_usaha(id) ON DELETE CASCADE,
  nama_usaha text NOT NULL,
  nama_pemilik text,
  nomor_telepon text,
  jenis_usaha text,
  jenis_pengajuan text NOT NULL,
  catatan text,
  punya_nib boolean NOT NULL DEFAULT false,
  nomor_nib text,
  total_transaksi integer NOT NULL DEFAULT 0,
  skor integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('unverified', 'pending', 'verified', 'rejected')),
  alasan_penolakan text,
  catatan_admin text,
  nomor_sertifikat text,
  ditinjau_oleh text,
  ditinjau_pada timestamptz,
  diajukan_pada timestamptz NOT NULL DEFAULT now()
);

-- Untuk tabel yang sudah terlanjur dibuat dari versi sebelumnya: catatan admin (sahkan/tolak)
ALTER TABLE public.verifikasi_usaha ADD COLUMN IF NOT EXISTS catatan_admin text;
UPDATE public.verifikasi_usaha SET catatan_admin = alasan_penolakan
  WHERE catatan_admin IS NULL AND alasan_penolakan IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_verifikasi_usaha_user_id ON public.verifikasi_usaha(user_id);
CREATE INDEX IF NOT EXISTS idx_verifikasi_usaha_status ON public.verifikasi_usaha(status);

ALTER TABLE public.verifikasi_usaha ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.verifikasi_usaha FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.verifikasi_usaha TO authenticated;

DROP POLICY IF EXISTS "pemilik baca" ON public.verifikasi_usaha;
DROP POLICY IF EXISTS "pemilik ajukan" ON public.verifikasi_usaha;
DROP POLICY IF EXISTS "pemilik ajukan ulang" ON public.verifikasi_usaha;
DROP POLICY IF EXISTS "admin baca" ON public.verifikasi_usaha;
DROP POLICY IF EXISTS "admin tinjau" ON public.verifikasi_usaha;

-- Pemilik usaha: lihat miliknya, ajukan/ajukan ulang hanya dengan status 'pending'
-- (tidak bisa mengesahkan dirinya sendiri atau mengisi nomor sertifikat).
CREATE POLICY "pemilik baca" ON public.verifikasi_usaha FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "pemilik ajukan" ON public.verifikasi_usaha FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending'
              AND nomor_sertifikat IS NULL AND ditinjau_oleh IS NULL AND catatan_admin IS NULL);
-- Satu pengajuan aktif per usaha (UNIQUE profil_id): baris lama hanya boleh ditimpa pemilik
-- bila statusnya 'rejected' (ditolak admin). Selama 'pending' atau 'verified', pengajuan
-- ulang ditolak oleh database. Pemilik tidak bisa mengisi catatan admin.
CREATE POLICY "pemilik ajukan ulang" ON public.verifikasi_usaha FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'rejected')
  WITH CHECK (user_id = auth.uid() AND status = 'pending'
              AND nomor_sertifikat IS NULL AND ditinjau_oleh IS NULL AND catatan_admin IS NULL);

-- Admin: lihat semua pengajuan dan memutuskan hanya dua hal: sahkan ('verified') atau
-- tolak ('rejected'), dan hanya untuk pengajuan yang masih 'pending'. Keputusan yang sudah
-- diambil tidak bisa diubah admin; pemilik yang ditolak mengajukan ulang sendiri.
CREATE POLICY "admin baca" ON public.verifikasi_usaha FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "admin tinjau" ON public.verifikasi_usaha FOR UPDATE TO authenticated
  USING (public.is_admin() AND status = 'pending')
  WITH CHECK (public.is_admin() AND status IN ('verified', 'rejected'));

-- profil_id harus milik pengaju (fungsi dibuat ulang di sini bila hardening.sql belum dijalankan)
CREATE OR REPLACE FUNCTION public.check_profil_owner() RETURNS trigger AS $$
BEGIN
  IF NEW.profil_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profil_usaha p WHERE p.id = NEW.profil_id AND p.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'profil_id bukan milik pengguna';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_profil_owner ON public.verifikasi_usaha;
CREATE TRIGGER trg_check_profil_owner BEFORE INSERT OR UPDATE ON public.verifikasi_usaha
  FOR EACH ROW EXECUTE FUNCTION public.check_profil_owner();

-- 3. Admin boleh MEMBACA data usaha semua pengguna (PRD F18: memantau data pengguna).
--    Hanya SELECT; admin tidak bisa mengubah atau menghapus data usaha orang lain.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profil_usaha','transaksi_kas','legalitas_dokumen','simulasi_kur','skor_kelayakan'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "admin baca" ON public.%I', t);
    EXECUTE format('CREATE POLICY "admin baca" ON public.%I FOR SELECT TO authenticated USING (public.is_admin())', t);
  END LOOP;
END $$;
