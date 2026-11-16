# Laporan Case Testing UTERA

Tanggal: 10 Nov 2026 · Acuan: `PRD UTERA (UMKM Sejahtera).md` dan `Task.md` · Kode: `utera/` (Next.js 16 + Supabase)

## Ringkasan

- **Temuan paling serius: RLS tidak efektif di database live.** Request `SELECT` dengan anon key tanpa login mengembalikan baris milik pengguna dari `profil_usaha`, `transaksi_kas`, dan `legalitas_dokumen`. Ini bertentangan dengan Test 1A di `Task.md` ("kelima tabel mengembalikan `[]`"). Siapa pun yang punya URL dan anon key (keduanya terkirim ke browser) bisa membaca data pengguna. **Belum diperbaiki di database; Anda perlu menjalankan `supabase/hardening.sql`** (lihat bagian "Tindakan untuk Anda").
- 51 test otomatis (Vitest) ditambahkan; sebelum perbaikan 8 dari 30 test awal gagal, sekarang semuanya lulus. `tsc` 0 error, `next build` berhasil. `eslint` masih 11 error (sudah ada sebelum perubahan; jumlahnya tidak bertambah).
- Uji E2E yang butuh login (CRUD, isolasi antar akun, multi-profil) **belum dijalankan**: perlu akun uji dari Anda.
- Fitur PRD yang belum ada sama sekali: F7 (PDF), F8, F9, F10, F12/F13 (halaman koperasi), F15, F17, F18.

## Test otomatis (logika PRD)

Jalankan: `npm test` di folder `utera`.

| ID | Yang diuji | Sebelum | Sesudah |
| --- | --- | --- | --- |
| SKOR-01..03,05..07 | Rumus skor 30/25/25/20, kategori, tren, margin | Lulus | Lulus |
| SKOR-04 | Tren turun = R_baru/R_lama | **Gagal** (rasio 1, bulan kosong diabaikan) | Lulus |
| SKOR-08 | Jendela 6 bulan kalender, bulan lama tidak dihitung | **Gagal** | Lulus |
| SKOR-09 | Peringatan data < 6 bulan (PRD) | **Gagal** (tidak ada) | Lulus |
| SNAP-01 | Snapshot `skor_kelayakan` (jumlah bulan, rata-rata omzet) | Lulus setelah fungsi baru | Lulus |
| KUR-01..04 | Anuitas (Rp10jt, 6%, 12 bln = Rp860.664) | Lulus | Lulus |
| GR-01..04 | Batas 30% (tepat 30% aman, 30,01% melebihi) | Lulus | Lulus |
| GR-05,06 | Dasar guardrail = rata-rata laba bulanan | Fungsi belum ada | Lulus |
| TIER-01..04 | Jenis KUR sesuai tabel PRD (6%, plafon, tenor) | **Gagal** (Super Mikro 3%, Mikro sampai 100jt, tanpa tenor) | Lulus |
| KAS-01..06 | Ringkasan, bulanan, kategori, format Rupiah | Lulus | Lulus |
| LEG-01..03 | Status legalitas | LEG-03 **Gagal** (150%) | Lulus |
| LEG-04..07 | Reminder masa berlaku (F16) | Fungsi belum ada | Lulus |
| AUTH-01..05 | Admin hanya dari `app_metadata`, redirect aman | Fungsi belum ada | Lulus |
| INP-01..06 | Nominal (negatif, desimal), tanggal lokal, CSV | Fungsi belum ada | Lulus |
| PA-01..03 | Pemilihan profil aktif | Fungsi belum ada | Lulus |

## Uji integrasi database (anon key, tanpa login)

| ID | Skenario | Hasil |
| --- | --- | --- |
| DB-01 | SELECT 5 tabel dengan anon key | **GAGAL**: 3 tabel mengembalikan data pengguna (HTTP 200); `simulasi_kur` dan `skor_kelayakan` kosong karena memang belum ada baris |
| DB-02 | INSERT anon ke `profil_usaha` | Ditolak oleh `NOT NULL user_id`, **bukan oleh RLS**. Penulisan oleh anon belum terbukti terblokir |
| DB-03 | Kolom `database.types.ts` vs `schema.sql` | Lulus (audit kode) |

## Uji di browser (tanpa login)

| ID | Skenario | Hasil |
| --- | --- | --- |
| E2E-04a | Tamu membuka `/admin` | Sebelum: halaman terbuka. Sesudah: diarahkan ke `/auth?mode=login&redirect=/admin`. Lulus |
| E2E-04b | Tamu membuka `/skor-kelayakan` (mode demo) | Lulus: skor 83 sama di sidebar dan halaman (sebelumnya rumus berbeda) |
| GR-UI | Guardrail demo | Lulus: dasar laba Rp14.087.500 = rata-rata 4 bulan demo; tenor Mikro hanya 36/48/60 |

## Hasil audit per modul (kode vs PRD)

Status: ✅ sesuai · 🔧 diperbaiki · ⚠️ ada di daftar belum selesai · ❌ fitur belum ada.

| Fitur PRD | Temuan | Status |
| --- | --- | --- |
| F1/F2 Auth | `signUp`/`signIn` via Supabase; tamu tidak diarahkan dari rute app (mode demo disengaja per `Task.md`); parameter `redirect` tidak divalidasi | 🔧 redirect divalidasi; mode demo dipertahankan |
| F18 Admin / peran | Admin = email mengandung "admin" atau `user_metadata.role` (bisa diisi sendiri); `/admin` terbuka untuk semua; email dan password admin tertulis di halaman | 🔧 admin hanya dari `app_metadata.role`, `/admin` dijaga middleware, kredensial dihapus dari halaman. ⚠️ Password itu sudah terlanjur ada di kode: **ganti password akun admin**. Data admin masih mock; lihat "Belum selesai" |
| F3 Profil | CRUD tersimpan ke `profil_usaha`; profil aktif tidak dibagi antar halaman | 🔧 profil aktif disimpan di cookie dan dipakai semua halaman |
| F4 Transaksi | Query tidak difilter `profil_id` (data antar usaha tercampur); `-5000` diam-diam jadi `5000`; `1.5` jadi `15`; tanggal default UTC; edit menimpa `profil_id`; CSV rusak oleh `#`/koma | 🔧 semua diperbaiki |
| F5 Dashboard | Skor memakai rumus berbeda (`50 + margin*45`); angka cicilan hardcode; modal tidak reset kategori saat tipe diganti | 🔧 skor dan guardrail memakai rumus PRD; modal reset kategori. ⚠️ angka cicilan contoh, grafik proyeksi, dan pilih periode masih hardcode |
| F6 Skor | Rumus benar tetapi jendela bukan 6 bulan kalender; simpan transaksi tidak menghitung ulang/menyimpan skor; snapshot salah isi | 🔧 jendela kalender, peringatan data kurang, snapshot benar, skor tersimpan otomatis tiap transaksi disimpan/dihapus |
| F7 Laporan PDF | Hanya `window.print()`; CSS cetak menarget class yang tidak ada | ❌ PDF belum ada; ⚠️ CSS cetak belum diperbaiki |
| F8 Cek kelayakan KUR | Tidak ada; kartu "Memenuhi" di Simulasi KUR berupa teks tetap | ❌ |
| F9 Checklist KUR, F10 Planner | Tidak ada (Planner 60/30/10 tetap, tidak tersimpan) | ❌ |
| F11 Laporan pengajuan | Data nyata dari profil, kas, legalitas; profil palsu dicetak bila profil kosong; semua dokumen bertanda ✓ | 🔧 profil kosong tidak lagi diisi data palsu; ✓ hanya untuk dokumen terisi; difilter per usaha |
| F12/F13 Koperasi | Hanya opsi 9% di halaman Guardrail; tidak ada form pengajuan/tabel | ❌ (simulasi dasar ada) |
| Aturan: cicilan ≤ 30% rata-rata laba 6 bulan | Memakai laba seluruh waktu; hardcode Rp18.450.000 untuk tamu; simpan tidak diblokir | 🔧 dasar rata-rata bulanan, tanpa angka bawaan, simpan diblokir bila > 30% |
| Jenis KUR | Super Mikro 3%, Mikro sampai 100jt, Kecil 7%, tenor bebas, 3 definisi berbeda | 🔧 satu sumber (`lib/kur.ts`) sesuai PRD |
| Penyimpanan simulasi | `bunga_tahunan` pecahan (0.06), status berupa teks tampilan, `profil_id` kosong | 🔧 persen (6), `aman`/`waspada`/`melebihi`, `profil_id` terisi. ⚠️ `simulasi_kur` belum pernah dibaca di UI (riwayat tidak tampil) |
| F14 Status legalitas | Persentase bisa 150% karena baris duplikat; validasi nomor tanpa `return`; `profil_id` kosong | 🔧 |
| F15 Panduan/checklist per jenis usaha | Daftar tetap 4 dokumen, tanpa halal/BPOM/PIRT | ❌ |
| F16 Reminder | `masa_berlaku` tidak ada input dan tidak ada reminder | 🔧 input tanggal dan penanda "segera habis (≤30 hari)" / "kedaluwarsa" di kartu dokumen |
| F17 Perbandingan | Tabel statis | ❌ |
| NFR Security: data per pengguna | RLS tidak efektif di DB live | ⚠️ perlu `supabase/hardening.sql` |
| Data integrity | Data bisnis (verifikasi, notifikasi) di `localStorage` | ⚠️ belum dipindah ke database |

## Perubahan kode

- Baru: `lib/auth.ts`, `lib/profil-aktif.ts`, `lib/input.ts`, `lib/skor-sync.ts`, `vitest.config.ts`, `tests/*.test.ts`, `supabase/hardening.sql`, `.claude/launch.json` (di folder induk, untuk preview).
- Diubah: `lib/skor.ts`, `lib/kur.ts`, `lib/legalitas.ts`, `middleware.ts`, `app/(app)/layout.tsx`, `buku-kas`, `dashboard`, `skor-kelayakan`, `guardrail`, `simulasi-kur`, `legalitas`, `profil-usaha`, `laporan-siap-bank`, `admin`, `app/auth/page.tsx`, `sidebar.tsx`, `topbar.tsx`.
- `package.json`: tambah `vitest`, naikkan `@types/node` ke `^22` (diperlukan vitest), script `test`.
- Belum ada commit.

## Tindakan untuk Anda

1. **Segera**: buka Supabase Dashboard → SQL Editor, jalankan `supabase/hardening.sql` (idempotent). Lalu jalankan ulang cek anon (harus `[]`). Kemungkinan penyebab: skrip RLS di `schema.sql` belum benar-benar dijalankan, atau ada policy terbuka. Query diagnosis ada di bagian atas file itu.
2. Ganti password akun admin lama (sudah pernah tertulis di kode), lalu jadikan admin lewat `app_metadata`:
   `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email = 'admin123@utera.id';`
   Tanpa ini, tidak ada akun yang bisa membuka `/admin`.
3. Buat 2 akun uji (A dan B) dan login di browser pane agar uji E2E berikut bisa dijalankan.

## Belum diuji / belum selesai

- E2E dengan login: AUTH, PROF (E2E-03), KAS CRUD (E2E-01), isolasi A/B (E2E-02), SKOR tersimpan otomatis, simpan simulasi KUR, legalitas, laporan.
- E2E-05 (deploy Vercel) dan 6.3 di `Task.md`.
- Dashboard masih membuat profil otomatis saat dikunjungi tanpa profil (`dashboard/page.tsx`), dengan fallback `id: 'user-default'`.
- Halaman Profil Usaha masih bisa membuat baris `legalitas_dokumen` ganda saat disimpan berulang.
- CSS cetak laporan belum dicocokkan dengan DOM; tidak ada PDF sungguhan.
- Verifikasi usaha, notifikasi, dan seluruh data admin masih `localStorage`/mock; pemantauan lintas pengguna oleh admin tidak mungkin dengan RLS sekarang (butuh policy admin atau fungsi server).
- Middleware masih bernama `middleware.ts`; Next 16 menyarankan `proxy.ts`.
