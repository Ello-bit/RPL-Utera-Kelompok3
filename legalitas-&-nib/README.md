# Dokumentasi Teknis Fitur Legalitas & NIB — UTERA

Dokumentasi arsitektur frontend, simulasi data, dan kontrak integrasi backend/database untuk modul **Legalitas & NIB** (Pilar Legalitas & Administrasi UMKM UTERA).

---

## 1. Arsitektur Modul

Modul dirancang dengan pemisahan tanggung jawab yang ketat (*Separation of Concerns*):

```
legalitas-&-nib/
├── index.html        # Struktur semantik HTML5, dialogs, & aksesibilitas
├── styles.css        # Desain visual (antislop-ui, Forest Pine #1F6B4F, responsive)
├── README.md         # Dokumentasi teknis & kontrak REST API backend
└── js/
    ├── models.js     # Konstanta, enum status, dan skema data
    ├── logic.js      # Pure functions: derivasi status, kalkulasi kedaluwarsa, validasi
    ├── mock-data.js  # Skenario pengujian UI (belum NIB, belum lengkap, lengkap, kedaluwarsa)
    ├── service.js    # Service layer asinkron (IndexedDB + LocalStorage)
    └── app.js        # Controller DOM, event handling, dan feedback interaktif
```

---

## 2. Pembedaan Status Legalitas

Modul membedakan 3 sumbu status secara eksplisit:

1. **Status Kelengkapan Legalitas Usaha (`legal_status`)**:
   - `belum_nib`: Belum ada NIB yang tercatat.
   - `belum_lengkap`: Ada dokumen dalam daftar yang berkasnya belum diunggah.
   - `lengkap`: Seluruh dokumen wajib/terdaftar sudah terunggah dan masih aktif.
   - `perlu_diperbarui`: Terdapat dokumen yang sudah kedaluwarsa atau mendekati jatuh tempo (<= 30 hari).

2. **Status Berkas per Dokumen (`doc_status`)**:
   - `belum_diunggah`: Slot dokumen terdaftar namun belum memiliki file.
   - `diunggah`: Berkas tersimpan dan masa berlaku masih aman.
   - `segera_berakhir`: Masa berlaku tersisa <= 30 hari.
   - `kedaluwarsa`: Masa berlaku telah melewati hari ini.

3. **Status Verifikasi Resmi (`verification_status`)**:
   - `belum_tersedia`: Menegaskan kepada pelaku UMKM bahwa UTERA berfungsi sebagai pendamping administrasi mandiri, bukan penerbit dan belum terintegrasi API dengan instansi penerbit (OSS / DJP / BPJPH). UTERA tidak menampilkan status "Terverifikasi" palsu.

---

## 3. Spesifikasi Kontrak Database & REST API

Ketika backend dan database relasional (PostgreSQL / MySQL) siap diintegrasikan, `service.js` dirancang langsung dapat dihubungkan ke endpoint berikut tanpa perlu merombak komponen UI:

### A. Skema Tabel Database

#### Tabel `business_nibs`
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | UUID / BIGINT PK | Identifikator unik |
| `business_id` | UUID FK | Relasi ke profil usaha |
| `nomor` | VARCHAR(13) NOT NULL | 13 digit angka NIB resmi OSS |
| `nama_usaha` | VARCHAR(100) NOT NULL | Nama usaha sesuai dokumen NIB |
| `penanggung_jawab`| VARCHAR(80) NULL | Nama penanggung jawab / pemilik |
| `kbli` | VARCHAR(120) NULL | Kode KBLI 5 digit & deskripsi kegiatan usaha |
| `tanggal_terbit` | DATE NOT NULL | Tanggal pengesahan NIB |
| `created_at` | TIMESTAMPTZ | Waktu dibuat |
| `updated_at` | TIMESTAMPTZ | Waktu perubahan terakhir |

#### Tabel `legal_documents`
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | UUID / BIGINT PK | Identifikator unik dokumen |
| `business_id` | UUID FK | Relasi ke profil usaha |
| `kategori` | VARCHAR(30) NOT NULL | `nib`, `npwp`, `halal`, `pirt`, `lainnya` |
| `nama` | VARCHAR(80) NOT NULL | Nama tampilan dokumen |
| `nomor` | VARCHAR(60) NULL | Nomor surat/sertifikat |
| `berlaku_hingga` | DATE NULL | Tanggal akhir masa berlaku (NULL jika seumur hidup) |
| `file_key` | VARCHAR(255) NULL | Path / key penyimpanan Object Storage (S3 / GCS) |
| `file_name` | VARCHAR(255) NULL | Nama asli berkas |
| `file_mime` | VARCHAR(100) NULL | `application/pdf`, `image/jpeg`, `image/png` |
| `file_size` | INT NULL | Ukuran berkas dalam bytes (Maks 2 MB) |
| `created_at` | TIMESTAMPTZ | Waktu dibuat |
| `updated_at` | TIMESTAMPTZ | Waktu diperbarui |

---

### B. Endpoints REST API

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/v1/legalitas` | Mengambil seluruh data NIB, daftar dokumen, dan ringkasan status |
| `PUT` | `/api/v1/legalitas/nib` | Menyimpan / memperbarui informasi NIB usaha |
| `POST` | `/api/v1/legalitas/dokumen` | Menambah kategori dokumen baru ke daftar |
| `PATCH` | `/api/v1/legalitas/dokumen/:id` | Mengubah metadata dokumen (nama custom, nomor, masa berlaku) |
| `POST` | `/api/v1/legalitas/dokumen/:id/berkas` | Mengunggah file berkas dokumen (`multipart/form-data`) |
| `GET` | `/api/v1/legalitas/dokumen/:id/berkas` | Mengunduh berkas / presigned URL untuk pratinjau |
| `DELETE` | `/api/v1/legalitas/dokumen/:id/berkas` | Menghapus berkas dokumen yang tersimpan |
| `DELETE` | `/api/v1/legalitas/dokumen/:id` | Menghapus dokumen dari daftar (kecuali dokumen NIB) |

---

## 4. Validasi Keamanan

1. **Format Nomor NIB**: Wajib tepat 13 digit angka (`/^\d{13}$/`).
2. **Format File**: Hanya menerima PDF, JPEG, dan PNG.
3. **Ukuran File**: Dibatasi maksimal 2 MB per berkas.
4. **Keamanan di Sisi Client**: Berkas disimpan di IndexedDB lokal browser pengguna saat offline/demo, mencegah kebocoran data antar pengguna.

