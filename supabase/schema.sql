-- ========================================================================
-- UTERA (Finansial UMKM) — Supabase Database Schema & RLS Policies
-- Target Database: PostgreSQL 15+ (Supabase Cloud)
-- Idempotent & Non-Destructive Migration Script
-- ========================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================================================
-- 2. TABEL: profil_usaha (Master Profil & Multi-Usaha UMKM)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.profil_usaha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  nama_usaha text NOT NULL,
  nama_pemilik text,
  jenis_usaha text,
  tanggal_mulai_usaha date,
  alamat_usaha text,
  nomor_telepon text,
  deskripsi_usaha text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Pastikan kolom user_id ada jika tabel sudah terbuat sebelumnya
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profil_usaha' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.profil_usaha 
      ADD COLUMN user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profil_usaha_user_id ON public.profil_usaha(user_id);

-- ========================================================================
-- 3. TABEL: transaksi_kas (Buku Kas Warung / Core Financial Ledger)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.transaksi_kas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  profil_id uuid REFERENCES public.profil_usaha(id) ON DELETE CASCADE,
  tipe text NOT NULL CHECK (tipe IN ('pemasukan', 'pengeluaran')),
  nominal numeric NOT NULL CHECK (nominal >= 0),
  kategori text NOT NULL,
  tanggal date NOT NULL DEFAULT CURRENT_DATE,
  keterangan text,
  metode_pembayaran text DEFAULT 'Tunai',
  created_at timestamptz DEFAULT now()
);

-- Pastikan kolom user_id dan profil_id ada jika tabel sudah terbuat sebelumnya
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transaksi_kas' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.transaksi_kas 
      ADD COLUMN user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transaksi_kas' AND column_name = 'profil_id'
  ) THEN
    ALTER TABLE public.transaksi_kas 
      ADD COLUMN profil_id uuid REFERENCES public.profil_usaha(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transaksi_kas_user_id ON public.transaksi_kas(user_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_kas_profil_id ON public.transaksi_kas(profil_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_kas_tanggal ON public.transaksi_kas(tanggal);

-- ========================================================================
-- 4. TABEL: legalitas_dokumen (NIB & Kelengkapan Berkas KUR - Pilar 4)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.legalitas_dokumen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  profil_id uuid REFERENCES public.profil_usaha(id) ON DELETE CASCADE,
  kategori text NOT NULL, -- 'nib', 'halal', 'pirt', 'bpom', 'lainnya'
  nama_dokumen text NOT NULL,
  nomor_dokumen text,
  tanggal_terbit date,
  masa_berlaku date,
  file_url text,
  created_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'legalitas_dokumen' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.legalitas_dokumen 
      ADD COLUMN user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'legalitas_dokumen' AND column_name = 'profil_id'
  ) THEN
    ALTER TABLE public.legalitas_dokumen 
      ADD COLUMN profil_id uuid REFERENCES public.profil_usaha(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_legalitas_dokumen_user_id ON public.legalitas_dokumen(user_id);
CREATE INDEX IF NOT EXISTS idx_legalitas_dokumen_profil_id ON public.legalitas_dokumen(profil_id);

-- ========================================================================
-- 5. TABEL: simulasi_kur (Simulasi KUR 2026 & Guardrail Cicilan 30% - Pilar 3)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.simulasi_kur (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  profil_id uuid REFERENCES public.profil_usaha(id) ON DELETE CASCADE,
  program text NOT NULL,            -- e.g. 'KUR Super Mikro', 'KUR Mikro BRI 6%', 'Koperasi Usaha'
  plafon numeric NOT NULL CHECK (plafon > 0),
  bunga_tahunan numeric NOT NULL CHECK (bunga_tahunan >= 0), -- e.g. 3.0, 6.0
  tenor_bulan integer NOT NULL CHECK (tenor_bulan > 0),
  angsuran_bulanan numeric NOT NULL CHECK (angsuran_bulanan >= 0),
  rasio_kas numeric,                -- Rasio persen terhadap laba bersih (e.g. 24.5%)
  status_guardrail text,            -- 'aman', 'waspada', 'melebihi'
  catatan text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_simulasi_kur_user_id ON public.simulasi_kur(user_id);
CREATE INDEX IF NOT EXISTS idx_simulasi_kur_profil_id ON public.simulasi_kur(profil_id);

-- ========================================================================
-- 6. TABEL: skor_kelayakan (Riwayat Skor Kesiapan Kredit Bank - Pilar 2)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.skor_kelayakan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  profil_id uuid REFERENCES public.profil_usaha(id) ON DELETE CASCADE,
  skor integer NOT NULL CHECK (skor >= 0 AND skor <= 100),
  kategori text NOT NULL,           -- 'Layak KUR Mikro', 'Cukup Layak', 'Perlu Peningkatan'
  omzet_bulanan numeric DEFAULT 0,
  laba_bersih numeric DEFAULT 0,
  margin_profit numeric DEFAULT 0,
  konsistensi_bulan integer DEFAULT 0,
  catatan text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skor_kelayakan_user_id ON public.skor_kelayakan(user_id);
CREATE INDEX IF NOT EXISTS idx_skor_kelayakan_profil_id ON public.skor_kelayakan(profil_id);

-- ========================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- Multi-tenant isolation: Pengguna hanya dapat mengakses dan mengelola datanya sendiri
-- ========================================================================

-- 7.1. Aktifkan RLS di semua tabel
ALTER TABLE public.profil_usaha ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaksi_kas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legalitas_dokumen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulasi_kur ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skor_kelayakan ENABLE ROW LEVEL SECURITY;

-- 7.2. Kebijakan profil_usaha
DROP POLICY IF EXISTS "Users can manage their own profil_usaha" ON public.profil_usaha;
CREATE POLICY "Users can manage their own profil_usaha"
  ON public.profil_usaha
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7.3. Kebijakan transaksi_kas
DROP POLICY IF EXISTS "Users can manage their own transaksi_kas" ON public.transaksi_kas;
CREATE POLICY "Users can manage their own transaksi_kas"
  ON public.transaksi_kas
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7.4. Kebijakan legalitas_dokumen
DROP POLICY IF EXISTS "Users can manage their own legalitas_dokumen" ON public.legalitas_dokumen;
CREATE POLICY "Users can manage their own legalitas_dokumen"
  ON public.legalitas_dokumen
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7.5. Kebijakan simulasi_kur
DROP POLICY IF EXISTS "Users can manage their own simulasi_kur" ON public.simulasi_kur;
CREATE POLICY "Users can manage their own simulasi_kur"
  ON public.simulasi_kur
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7.6. Kebijakan skor_kelayakan
DROP POLICY IF EXISTS "Users can manage their own skor_kelayakan" ON public.skor_kelayakan;
CREATE POLICY "Users can manage their own skor_kelayakan"
  ON public.skor_kelayakan
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ========================================================================
-- 8. TRIGGER: Auto update timestamp updated_at pada profil_usaha
-- ========================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_profil_usaha_updated_at ON public.profil_usaha;
CREATE TRIGGER trigger_profil_usaha_updated_at
  BEFORE UPDATE ON public.profil_usaha
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

