-- ========================================================================
-- UTERA - Foto profil usaha
-- Jalankan di Supabase Dashboard > SQL Editor. Aman dijalankan ulang (idempotent).
--
-- Foto disimpan di Supabase Storage (bucket "foto-usaha"), alamatnya di kolom
-- profil_usaha.foto_url. Setiap pengguna hanya bisa mengunggah/mengganti/menghapus
-- foto di folder miliknya sendiri: foto-usaha/<id pengguna>/...
-- ========================================================================

-- 1. Kolom alamat foto di profil usaha
ALTER TABLE public.profil_usaha ADD COLUMN IF NOT EXISTS foto_url text;

-- 2. Bucket penyimpanan foto.
--    public = true: foto bisa ditampilkan lewat alamatnya (foto usaha bukan data rahasia).
--    Batas 2 MB dan hanya JPG/PNG/WebP, dicek juga oleh Supabase di server.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('foto-usaha', 'foto-usaha', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Aturan akses: hanya pemilik folder yang boleh menulis
--    "lihat milik sendiri" WAJIB ada: Supabase hanya bisa menghapus/mengganti file yang
--    boleh dilihat pengguna. Tanpa ini, hapus foto lama gagal diam-diam dan file menumpuk.
DROP POLICY IF EXISTS "foto usaha: lihat milik sendiri" ON storage.objects;
DROP POLICY IF EXISTS "foto usaha: unggah milik sendiri" ON storage.objects;
DROP POLICY IF EXISTS "foto usaha: ganti milik sendiri" ON storage.objects;
DROP POLICY IF EXISTS "foto usaha: hapus milik sendiri" ON storage.objects;

CREATE POLICY "foto usaha: lihat milik sendiri" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'foto-usaha' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "foto usaha: unggah milik sendiri" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'foto-usaha' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "foto usaha: ganti milik sendiri" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'foto-usaha' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "foto usaha: hapus milik sendiri" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'foto-usaha' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Muat ulang skema API agar kolom foto_url langsung terbaca aplikasi
NOTIFY pgrst, 'reload schema';
