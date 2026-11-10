# Uji integrasi Supabase

Menguji database sungguhan: RLS tanpa login, CRUD akun A, skor tersimpan otomatis,
simulasi KUR, legalitas, dan isolasi data akun A terhadap akun B.
Semua data uji ditandai `UJI-INTEGRASI ...` dan dihapus lagi setelah selesai.

## Persiapan (sekali)

1. Buat dua akun biasa di aplikasi (bukan admin), misalnya lewat `/auth?mode=register`.
2. Buat file `utera/.env.test.local` (tidak ikut di-commit) berisi:

```
TEST_A_EMAIL=email-akun-a
TEST_A_PASSWORD=password-akun-a
TEST_B_EMAIL=email-akun-b
TEST_B_PASSWORD=password-akun-b
```

Tanpa akun B, uji isolasi dilewati. Tanpa akun A, hanya uji anon yang jalan.

## Menjalankan

```
npm run test:integration
```

## Uji admin (opsional)

Tambahkan akun admin (yang sudah diberi `app_metadata.role = admin`) ke `.env.test.local`:

```
TEST_ADMIN_EMAIL=email-admin
TEST_ADMIN_PASSWORD=password-admin
```

Uji verifikasi butuh tabel dari `supabase/verifikasi.sql` sudah dijalankan.
