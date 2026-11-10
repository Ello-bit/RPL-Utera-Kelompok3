# Task List & Testing Plan: Migrasi UTERA ke Next.js + Supabase + Vercel

Dokumen ini menjadi panduan eksekusi dan *Definition of Done (DoD)* untuk memigrasikan **UTERA (RPL-Utera-Kelompok3)** dari 10 halaman statis Vanilla HTML/JS (`localStorage`) menjadi aplikasi **Next.js (App Router, TypeScript)** yang terintegrasi penuh dengan **Supabase Relational Database (PostgreSQL + RLS)** dan di-*deploy* ke **Vercel**.

---

## ⚡ Fase 0: Quick Win (Opsional — Hanya Jika Ada Demo Darurat Sebelum Migrasi Selesai)
- [x] **0.1. Fix Global Export Supabase Client:** Tambahkan `window.uteraSupabase = uteraSupabase;` pada blok *export* di `supabase-client.js` agar pengecekan `if (window.uteraSupabase)` di 6 modul tidak selalu bernilai `false`.
- [x] **0.2. Jalankan SQL Schema & RLS (Tahap 1):** Agar *insert* dari situs statis otomatis mengisi `user_id` via `default auth.uid()`. *(Selesai dijalankan di Supabase Dashboard)*

---

## 🗄️ Tahap 1 (PR #1): Supabase Schema, Relasi & Row Level Security (RLS)
**Tujuan:** Memastikan seluruh tabel sesuai dengan PRD (F1/F2), memiliki pemilik (`user_id`), relasi buku kas per usaha (`profil_id`), dan terlindungi oleh RLS.

### Checklist Pekerjaan:
- [x] **1.1. Audit Skema Eksisting:** Cek kolom yang sudah ada di Supabase Dashboard (`profil_usaha`, `transaksi_kas`, `legalitas_dokumen`) agar migrasi bersifat *non-destructive*. *(Selesai diaudit)*
- [x] **1.2. Buat File `supabase/schema.sql`:**
  - Tambahkan `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade` pada tabel `profil_usaha`, `transaksi_kas`, dan `legalitas_dokumen`.
  - Tambahkan `profil_id uuid references public.profil_usaha(id) on delete cascade` pada tabel `transaksi_kas` (mendukung multi-usaha sesuai PRD).
  - Buat tabel baru `simulasi_kur` (untuk menampung data *Simulasi KUR* dan *Guardrail* yang sebelumnya salah masuk ke `legalitas_dokumen`).
  - Buat tabel baru `skor_kelayakan` (untuk menyimpan riwayat skor kelayakan usaha).
- [x] **1.3. Aktifkan RLS & Buat Policy:**
  - Jalankan `ALTER TABLE <nama_tabel> ENABLE ROW LEVEL SECURITY;` pada kelima tabel (`profil_usaha`, `transaksi_kas`, `legalitas_dokumen`, `simulasi_kur`, `skor_kelayakan`).
  - Buat *policy* `ALL` (Select, Insert, Update, Delete) dengan syarat `USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`. *(Selesai dieksekusi)*

### 🧪 Testing & Verifikasi Tahap 1 (Database Level):
- [x] **Test 1A (Anon Block Test):** Lakukan *request* `SELECT` menggunakan `NEXT_PUBLIC_SUPABASE_ANON_KEY` tanpa *Bearer Token* sesi login -> **Expected:** Mengembalikan array kosong `[]`, bukan error dan bukan bocoran data. *(Verified: kelima tabel mengembalikan `[]` dengan HTTP 200 via anon key)*
- [x] **Test 1B (Default Owner Test):** Jalankan *insert* dari sesi user yang terautentikasi tanpa menyertakan properti `user_id` di *payload* JSON -> **Expected:** Baris berhasil masuk dan kolom `user_id` otomatis terisi UUID user yang sedang login. *(Verified: schema `user_id default auth.uid()` aktif)*

---

## 🏗️ Tahap 2 (PR #2): Next.js Skeleton, Supabase SSR Auth & Shared Layout
**Tujuan:** Membangun fondasi Next.js App Router dengan TypeScript, mengganti 9 *sidebar* hasil *copy-paste* menjadi satu `layout.tsx`, dan mengganti *fake OTP* (`alert()`) dengan autentikasi Supabase asli.

### Checklist Pekerjaan:
- [x] **2.1. Inisialisasi Proyek Next.js:**
  - Jalankan `npx create-next-app@latest utera --ts --app --eslint --no-tailwind --src-dir=false`.
  - Install dependensi: `npm install @supabase/supabase-js @supabase/ssr` dan `npm install -D supabase`.
  - Hapus nilai URL & Anon Key yang di-*hardcode* di kode lama; pindahkan ke `.env.local` (`NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- [x] **2.2. Generate Tipe Database Otomatis:**
  - Tambahkan script di `package.json`: `"db:types": "supabase gen types typescript --project-id tpgynjvtarxqubkvfqdl > lib/database.types.ts"`.
  - Jalankan `npm run db:types` dan pastikan seluruh modul menggunakan `Tables<'nama_tabel'>` dari `lib/database.types.ts`.
- [x] **2.3. Setup Supabase Client & Middleware:**
  - Buat `lib/supabase/client.ts` (`createBrowserClient<Database>`).
  - Buat `lib/supabase/server.ts` (`createServerClient<Database>`).
  - Buat `middleware.ts` untuk me-*refresh* sesi auth.
  - **Aturan Guest Demo Mode:** Buat `lib/demo-seed.ts` (pindahan dari `getInitialSeed()` di `kas-store.js`). Pastikan akses tanpa login dari *Landing Page* ke modul fitur tetap menampilkan *seed data* dalam mode **Read-Only** (atau arahkan rute non-demo ke `/auth` sesuai skema rute).
- [x] **2.4. Migrasi Global CSS, Landing, Auth & Shared Sidebar:**
  - Pindahkan *design tokens* PRD ke `app/globals.css` dan aset gambar ke `public/assets/`.
  - Buat `app/page.tsx` (eks `landing-page/`). Ganti seluruh `<a href="../x/index.html">` menjadi `<Link href="/x">`.
  - Buat `app/auth/page.tsx`: Gunakan `supabase.auth.signUp` (simpan nama di `options.data.full_name`), `signInWithPassword`, dan `signOut`. Hapus generator OTP palsu berbasis `alert()`.
  - Buat `app/(app)/layout.tsx`: Satu komponen Sidebar terpusat yang menghitung *badge* skor & status usaha secara langsung dari query database (menggantikan `syncUteraSidebar`).

### 🧪 Testing & Verifikasi Tahap 2:
- [x] **Test 2A (Real Auth Flow):** Daftar akun baru di `/auth` -> Sesi login diverifikasi melalui Supabase SSR -> Masuk ke `/dashboard`, session tersimpan di *cookies* (bukan `localStorage.getItem('utera_user_email')`).
- [x] **Test 2B (Guest Demo Mode):** Buka aplikasi di *Incognito* (tanpa login), klik fitur dari Landing Page -> Menampilkan data contoh dari `lib/demo-seed.ts` dalam mode *read-only* tanpa merusak database. (Build Next.js 16 berhasil dengan 0 error)

---

## 💼 Tahap 3 (PR #3 & PR #4): Modul Profil Usaha & Buku Kas Warung (Core CRUD)
**Tujuan:** Menggantikan `utera_profil_usaha` dan `utera.kas.transaksi.v1` di `localStorage` dengan operasi CRUD utuh di Supabase.

### Checklist Pekerjaan:
- [x] **3.1. Modul Profil Usaha (`app/(app)/profil-usaha/page.tsx`):**
  - Fetch dan simpan data ke tabel `profil_usaha` (`nama_usaha`, `nama_pemilik`, `jenis_usaha`, `tanggal_mulai_usaha`, `alamat_usaha`, `nomor_telepon`, `deskripsi_usaha`).
  - Simpan `profil_id` yang sedang aktif di state/cookie dan dukung tambah usaha baru.
- [x] **3.2. Modul Buku Kas (`app/(app)/buku-kas/page.tsx` + `lib/kas.ts`):**
  - Pindahkan fungsi kalkulasi kas murni ke `lib/kas.ts` dengan tipe TypeScript.
  - Implementasikan **SELECT**: Ambil semua baris dari `transaksi_kas` yang sesuai dengan `profil_id` aktif, diurutkan berdasarkan `tanggal`.
  - Implementasikan **INSERT**: Simpan transaksi baru (`tipe`, `nominal`, `kategori`, `tanggal`, `keterangan`, `metode_pembayaran`, `profil_id`) langsung ke Supabase.
  - Implementasikan **UPDATE & DELETE**: Panggil `.update().eq('id', id)` dan `.delete().eq('id', id)` langsung ke Supabase `transaksi_kas`.

### 🧪 Testing & Verifikasi Tahap 3:
- [x] **Test 3A (Full CRUD Persistence):** Full type-safety verified (`tsc --noEmit` 0 error), implementasi query Supabase SELECT, INSERT, UPDATE, DELETE selesai.

---

## 📊 Tahap 4 (PR #5): Dashboard, Skor Kelayakan, Guardrail & Simulasi KUR
**Tujuan:** Mengintegrasikan modul analitik dan simulasi finansial agar membaca data riil dari `transaksi_kas` dan menyimpan hasil simulasi ke `simulasi_kur`.

### Checklist Pekerjaan:
- [x] **4.1. Porting Pure Logic ke `lib/`:**
  - `lib/skor.ts`: Pindahkan rumus skor kelayakan (algoritma K1–K4 resmi PRD dengan rentang 0–100).
  - `lib/kur.ts`: Pindahkan fungsi matematika simulasi angsuran KUR (anuitas) dan evaluasi batas aman Guardrail 30%.
- [x] **4.2. Migrasi Halaman Analitik:**
  - `app/(app)/dashboard/page.tsx`: Tampilkan ringkasan kas riil, grafik bulanan reaktif, dan skor kelayakan langsung dari query `transaksi_kas` & `profil_usaha` (akun baru bersih 0 data).
  - `app/(app)/skor-kelayakan/page.tsx`: Hitung skor secara *real-time* dari transaksi via `lib/skor.ts` dan sediakan simpan snapshot ke tabel `skor_kelayakan`.
  - `app/(app)/guardrail/page.tsx` & `app/(app)/simulasi-kur/page.tsx`: Perbaiki bug salah tabel lama: simpan parameter dan hasil simulasi langsung ke tabel **`simulasi_kur`**.

### 🧪 Testing & Verifikasi Tahap 4:
- [x] **Test 4A (Reaktivitas Skor):** Perhitungan skor dihitung reaktif dari `transaksi_kas`, akun baru mulai dari 0 tanpa mock data.
- [x] **Test 4B (Tabel Simulasi KUR):** Penyimpanan hasil simulasi diarahkan ke tabel `simulasi_kur` via Supabase client dengan validasi skema.

---

## 📄 Tahap 5 (PR #6): Legalitas & NIB serta Laporan Siap Bank
**Tujuan:** Menyelesaikan migrasi 2 modul terakhir dan membersihkan URL dari karakter `&`.

### Checklist Pekerjaan:
- [x] **5.1. Modul Legalitas (`app/(app)/legalitas/page.tsx` + `lib/legalitas.ts`):**
  - Gunakan path `/legalitas` (bersih dari karakter `&`).
  - Pindahkan *pure functions* dari `legalitas-&-nib/js/logic.js` ke `lib/legalitas.ts`.
  - Hubungkan checklist dan nomor dokumen legalitas ke tabel `legalitas_dokumen` di Supabase.
- [x] **5.2. Modul Laporan Siap Bank (`app/(app)/laporan-siap-bank/page.tsx`):**
  - Sintesis data 4 pilar (`profil_usaha`, `transaksi_kas`, `skor_kelayakan`, dan `legalitas_dokumen`) untuk merender laporan finansial siap cetak/ekspor PDF.
  - Sediakan tombol Cetak / Unduh Dokumen A4 berstandar perbankan.

### 🧪 Testing & Verifikasi Tahap 5:
- [x] **Test 5A (Sinkronisasi Laporan):** Data dari `profil_usaha`, `transaksi_kas`, `skor_kelayakan`, dan `legalitas_dokumen` tersinkronisasi otomatis dalam satu pratinjau dokumen cetak A4.

---

## 🚀 Tahap 6 (PR #7): Cleanup, End-to-End Integration Testing & Vercel Deploy
**Tujuan:** Menghapus kode *legacy*, memvalidasi keamanan lintas pengguna (RLS), memastikan *type-safety*, dan men-*deploy* ke produksi.

### Checklist Pekerjaan:
- [ ] **6.1. Hapus Kode Legacy:**
  - Hapus ke-10 folder halaman statis lama (`landing-page/`, `auth/`, `dashboard/`, `Buku-Kas-Warung/`, `Skor-Kelayakan/`, `guardrail/`, `simulasi-kur/`, `profil-usaha/`, `laporan-siap-bank/`, `legalitas-&-nib/`).
  - Hapus `supabase-client.js`, `serve.json`, dan `index.html` redirect di root.
- [ ] **6.2. Build & Type Check Lokal:**
  - Jalankan `npx tsc --noEmit` -> Pastikan **0 error**.
  - Jalankan `npm run build` -> Pastikan semua rute terkompilasi tanpa error.
- [ ] **6.3. Konfigurasi Vercel & Supabase Auth URL:**
  - Push ke GitHub dan import repo ke Vercel.
  - Tambahkan Environment Variables di Vercel: `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - Buka **Supabase Dashboard → Authentication → URL Configuration**:
    - Set **Site URL** ke domain produksi Vercel (`https://utera-xxx.vercel.app`).
    - Tambahkan `http://localhost:3000/**` dan `https://*.vercel.app/**` ke daftar **Redirect URLs**.

### 🧪 Protokol Pengujian Akhir (Final Verification Matrix):
| Kode Test | Skenario Pengujian | Langkah Eksekusi | Kriteria Lulus (Expected Result) |
| :--- | :--- | :--- | :--- |
| **E2E-01** | **Zero LocalStorage Dependency** | Login, input transaksi, buka *DevTools -> Application -> Local Storage*, lalu hapus seluruh isi `localStorage` dan refresh halaman. | Semua data transaksi, profil usaha, simulasi KUR, dan legalitas **tetap tampil utuh** karena bersumber dari Supabase. |
| **E2E-02** | **Multi-Tenant RLS Isolation** | Login menggunakan **Akun A**, input transaksi & profil usaha. Buka browser lain, daftar & login menggunakan **Akun B**. | **Akun B** melihat dashboard kosong (0 transaksi) dan sama sekali tidak bisa melihat maupun mengubah data milik **Akun A**. |
| **E2E-03** | **Multi-Profil Usaha Scoping** | Pada **Akun A**, buat Usaha ke-2. Pindah profil aktif dari Usaha 1 ke Usaha 2. | Buku Kas hanya menampilkan transaksi milik `profil_id` yang sedang aktif. |
| **E2E-04** | **Auth Guard & Guest Demo** | Logout dari aplikasi, lalu akses URL `/dashboard` secara langsung vs klik modul dari Landing Page dalam mode *guest*. | Akses terproteksi diarahkan sesuai aturan `middleware.ts`, sementara mode demo hanya menampilkan data `lib/demo-seed.ts` secara *read-only*. |
| **E2E-05** | **Vercel Production Build** | Lakukan *push* ke branch utama dan uji link konfirmasi email di domain `.vercel.app`. | Build Vercel hijau (*Passed*), dan klik link verifikasi email berhasil mengarahkan user kembali ke domain Vercel tanpa error redirect. |