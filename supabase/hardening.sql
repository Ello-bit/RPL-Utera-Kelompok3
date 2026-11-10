-- ========================================================================
-- UTERA - Hardening RLS (jalankan di Supabase Dashboard > SQL Editor)
-- Temuan uji: SELECT dengan anon key tanpa login mengembalikan baris milik
-- pengguna (profil_usaha, transaksi_kas, legalitas_dokumen). Artinya RLS
-- tidak aktif atau ada policy yang mengizinkan role anon di database live.
-- Skrip ini idempotent.
-- ========================================================================

-- 0. DIAGNOSTIK (lihat hasilnya dulu, boleh dijalankan terpisah)
-- select tablename, rowsecurity from pg_tables
--   where schemaname = 'public'
--   and tablename in ('profil_usaha','transaksi_kas','legalitas_dokumen','simulasi_kur','skor_kelayakan');
-- select tablename, policyname, roles, cmd, qual from pg_policies where schemaname = 'public';

-- 1. Hapus SEMUA policy lama pada 5 tabel (termasuk yang terbuka untuk anon/public)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profil_usaha','transaksi_kas','legalitas_dokumen','simulasi_kur','skor_kelayakan')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 2. Pastikan RLS aktif
ALTER TABLE public.profil_usaha      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaksi_kas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legalitas_dokumen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulasi_kur      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skor_kelayakan    ENABLE ROW LEVEL SECURITY;

-- 3. Cabut hak akses role anon (lapisan kedua)
REVOKE ALL ON public.profil_usaha, public.transaksi_kas, public.legalitas_dokumen,
              public.simulasi_kur, public.skor_kelayakan FROM anon;

-- 4. Policy pemilik data (hanya role authenticated)
CREATE POLICY "own rows" ON public.profil_usaha FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own rows" ON public.transaksi_kas FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own rows" ON public.legalitas_dokumen FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own rows" ON public.simulasi_kur FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own rows" ON public.skor_kelayakan FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Integritas: profil_id harus milik user yang sama (cegah tulis ke usaha orang lain)
CREATE OR REPLACE FUNCTION public.check_profil_owner() RETURNS trigger AS $$
BEGIN
  IF NEW.profil_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profil_usaha p WHERE p.id = NEW.profil_id AND p.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'profil_id bukan milik pengguna';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transaksi_kas','legalitas_dokumen','simulasi_kur','skor_kelayakan'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_check_profil_owner ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_check_profil_owner BEFORE INSERT OR UPDATE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.check_profil_owner()', t);
  END LOOP;
END $$;

-- 6. Validasi nominal transaksi di level DB (nominal > 0)
ALTER TABLE public.transaksi_kas DROP CONSTRAINT IF EXISTS transaksi_kas_nominal_check;
ALTER TABLE public.transaksi_kas ADD CONSTRAINT transaksi_kas_nominal_check CHECK (nominal > 0);
