# PRD UTERA (UMKM Sejahtera)

Oct 26, 2026 · @Bryan

## Ringkasan Produk

UTERA (UMKM Sejahtera) adalah platform pendamping UMKM yang menjadikan pencatatan keuangan sebagai satu fondasi data usaha, lalu memakai ulang data itu untuk menilai kelayakan usaha, menyiapkan KUR dan pinjaman koperasi, mengurus legalitas, dan membandingkan pembiayaan.

Nilai utama produk:

- **Satu sumber data:** transaksi yang dicatat sekali dipakai oleh semua modul, sehingga pelaku UMKM tidak menginput ulang.
- **Bukti kelayakan yang terdokumentasi:** riwayat keuangan konsisten menjadi dasar skor kelayakan dan laporan pengajuan.
- **Keputusan pembiayaan yang realistis:** simulasi cicilan dibandingkan dengan kemampuan bayar riil usaha.
- **Desain modular:** fitur baru dapat ditambah tanpa mengganggu modul yang sudah ada.

Batasan penting: fitur simulasi dan perbandingan pembiayaan hanya bahan pertimbangan, bukan keputusan persetujuan kredit.

## Latar Belakang dan Problem Statement

Akar masalahnya: pelaku UMKM tidak punya fondasi data usaha yang terintegrasi dan bisa dipakai ulang, sehingga usaha yang sehat tetap sulit membuktikan kelayakannya kepada bank atau koperasi.

**Kondisi saat ini**

- Pencatatan keuangan manual, tidak konsisten, atau tidak ada sama sekali.
- Data keuangan belum terintegrasi, jadi belum bisa langsung dipakai untuk penilaian usaha dan pembiayaan.
- Pengajuan pembiayaan menuntut persiapan data dan dokumen yang berulang.
- Informasi legalitas dan sertifikasi (NIB lewat OSS, halal, BPOM, PIRT) tersebar dan dikelola terpisah.
- Pilihan pembiayaan (KUR vs koperasi) belum bisa dibandingkan terhadap kemampuan bayar.

**Dampak bagi UMKM**

- Akses pembiayaan terhambat karena riwayat keuangan tidak meyakinkan.
- Legalitas tidak terurus dan sertifikasi terlewat, yang bisa membatasi akses pasar.
- Risiko keputusan finansial keliru, misalnya nominal pinjaman atau cicilan yang tidak realistis.
- Beban administratif berulang karena data diinput ulang untuk setiap kebutuhan.

**Problem statement**

Bagaimana membantu pelaku UMKM mendigitalisasi pencatatan keuangan sebagai fondasi data terintegrasi, yang dipakai ulang untuk penilaian kelayakan, persiapan KUR dan pinjaman koperasi, legalitas, serta simulasi pembiayaan, tanpa duplikasi input dan beban administratif berulang?

## Tujuan dan Metrik Keberhasilan

Lima tujuan pengembangan berasal dari dokumen asli; kolom indikator adalah usulan yang belum punya angka target dan perlu disepakati tim.

| Tujuan | Indikator keberhasilan (usulan) |
| --- | --- |
| Membangun fondasi data usaha lewat digitalisasi pencatatan keuangan | Jumlah pengguna aktif yang mencatat transaksi secara rutin |
| Menjadi platform pendamping UMKM yang mencakup lima pilar | Persentase pengguna yang memakai lebih dari satu pilar |
| Desain modular untuk fitur baru | Modul baru dapat ditambah tanpa mengubah modul yang ada |
| Mengurangi duplikasi input dan beban administratif | Pengguna tidak perlu menginput ulang data usaha antarmodul |
| Membantu keputusan finansial lewat skor kelayakan dan simulasi kemampuan bayar | Jumlah pengguna yang membuat laporan KUR atau simulasi koperasi |

## Target Pengguna dan Stakeholder

Pengguna utama UTERA adalah pelaku UMKM yang belum tentu berlatar belakang teknis, sehingga antarmuka harus sederhana. Admin menjadi aktor pendukung.

| Pihak | Peran | Interaksi dengan sistem |
| --- | --- | --- |
| Pelaku UMKM | Pengguna utama | Mencatat transaksi, melihat dashboard dan skor, menyiapkan KUR dan pinjaman koperasi, mengelola legalitas |
| Admin | Aktor pendukung | Mengelola konten panduan legalitas dan sertifikasi, memantau data pengguna |
| Bank atau lembaga keuangan | Pihak eksternal | Menerima laporan pengajuan KUR yang diunduh pengguna |
| Koperasi | Pihak eksternal | Terkait simulasi dan pengajuan pinjaman koperasi |
| Lembaga legalitas dan sertifikasi | Pihak eksternal | Sumber informasi legalitas dan sertifikasi (halal, BPOM, PIRT) |

Pihak eksternal tidak memakai sistem secara langsung pada rancangan saat ini; mereka hanya terkait lewat dokumen dan informasi yang disiapkan pengguna.

## Ruang Lingkup

Versi pertama mencakup lima pilar dengan data keuangan sebagai fondasi bersama.

**Termasuk (in-scope)**

- Autentikasi: registrasi, login, logout, dan profil usaha.
- Manajemen Keuangan: CRUD transaksi, dashboard pemasukan, pengeluaran, laba bersih, dan skor kelayakan usaha.
- KUR: cek kelayakan, checklist dokumen, KUR Planner, dan laporan pengajuan.
- Peminjaman Koperasi: simulasi cicilan dan penyimpanan data pengajuan.
- Legalitas Usaha: panduan bertahap, checklist dokumen per jenis usaha, info sertifikasi, status legalitas, dan reminder kedaluwarsa.
- Simulasi Pembiayaan: perbandingan hasil simulasi koperasi dalam bentuk tabel.
- Administrasi: pengelolaan konten legalitas dan sertifikasi, serta pemantauan data pengguna.

**Tidak termasuk (out-of-scope)**

- Keputusan persetujuan kredit; simulasi hanya bahan pertimbangan (dinyatakan di dokumen).
- Integrasi langsung ke sistem bank atau koperasi. Dokumen tidak menyebutnya, jadi diasumsikan di luar lingkup; pengguna mengunduh laporan lalu mengajukannya sendiri.

* Simulasi cicilan KUR untuk sementara; perbandingan hanya mencakup simulasi koperasi.

## Fitur dan Kebutuhan Fungsional

Daftar ini menggabungkan 14 functional requirement dan 18 use case dari dokumen. Prioritas (Must, Should, Could) adalah usulan untuk didiskusikan. Baris bertanda \* muncul di use case tetapi belum ada di functional requirement.

| ID | Modul | Kebutuhan | Prioritas |
| --- | --- | --- | --- |
| F1 | Autentikasi | Registrasi akun UMKM, data tersimpan di database | Must |
| F2 | Autentikasi | Login dan logout dengan cek username dan password ke database | Must |
| F3 | Profil | Pengguna mengedit data profil usaha | Must |
| F4 | Keuangan | Tambah, ubah, hapus, dan lihat riwayat transaksi (CRUD) | Must |
| F5 | Keuangan | Dashboard pemasukan, pengeluaran, dan laba bersih per periode | Must |
| F6 | Keuangan | Hitung dan simpan skor kelayakan usaha dari data transaksi | Must |
| F7\* | Keuangan | Hasilkan laporan keuangan dalam PDF | Must |
| F8 | KUR | Cek kelayakan KUR dan simpan hasilnya agar bisa dilihat kembali | Must |
| F9 | KUR | Checklist dokumen pengajuan dengan status sudah atau belum per pengguna | Must |
| F10 | KUR | KUR Planner: susun dan simpan rencana penggunaan dana | Should |
| F11 | KUR | Susun laporan pengajuan dari profil, kondisi keuangan, dan skor | Should |
| F12 | Koperasi | Simulasi cicilan dari nominal, tenor, dan bunga atau jasa | Must |
| F13 | Koperasi | Simpan data pengajuan pinjaman setelah analisis kemampuan bayar | Should |
| F14 | Legalitas | Catat status legalitas usaha per akun (sudah atau belum dimiliki) | Should |
| F15\* | Legalitas | Panduan legalitas bertahap, checklist dokumen per jenis usaha, info sertifikasi halal, BPOM, PIRT | Should |
| F16\* | Legalitas | Reminder saat dokumen legalitas mendekati masa berlaku habis | Could |
| F17 | Simulasi | Tabel perbandingan hasil simulasi koperasi; simulasi KUR belum ada di versi ini | Should |
| F18\* | Administrasi | Admin mengelola konten legalitas dan sertifikasi serta memantau data pengguna | Should |

**Aturan bisnis dari alur proses**

- Setiap transaksi yang tersimpan memicu hitung ulang dashboard dan skor kelayakan, lalu skor disimpan.
- Jika pengguna belum memenuhi syarat KUR, sistem menampilkan rekomendasi perbaikan keuangan dan alur selesai; checklist dan planner tidak dibuka.
- Pengajuan koperasi hanya disimpan jika cicilan sesuai arus kas; jika tidak, sistem menampilkan peringatan risiko dan pengguna kembali ke form.

## Kriteria KUR dan Skor Kelayakan

Skor menilai seberapa baik perkembangan keuangan usaha dalam 6 bulan terakhir, lalu dipadukan dengan syarat administratif KUR agar peluang pengajuan diterima lebih besar. Syarat di bawah mengacu pada KUR BRI 2026; bank lain bisa berbeda, jadi tim perlu memeriksanya sebelum finalisasi.

**Syarat KUR dan cara UTERA mengeceknya**

| Syarat | Cara cek di UTERA |
| --- | --- |
| Usaha produktif, sudah berjalan minimal 6 bulan | Otomatis dari tanggal mulai usaha di profil usaha (atribut baru) dan riwayat transaksi |
| WNI, usia minimal 21 tahun atau sudah menikah | Deklarasi pengguna di checklist |
| Tidak sedang menerima kredit produktif dari bank lain (kredit konsumtif seperti KPR dikecualikan) | Deklarasi pengguna di checklist |
| Tidak masuk daftar hitam SLIK OJK | Deklarasi pengguna; UTERA tidak dapat memverifikasi |
| Punya NIB atau SKU/IUMK | Otomatis dari status legalitas usaha |
| Dokumen: e-KTP, Kartu Keluarga, NIB atau SKU, foto tempat usaha | Checklist dokumen KUR |

**Jenis KUR sebagai batas nominal di KUR Planner**

| Jenis | Plafon | Tenor |
| --- | --- | --- |
| Super Mikro | hingga Rp10 juta | 12 sampai 36 bulan |
| Mikro | Rp10 juta sampai Rp50 juta | 36 sampai 60 bulan |
| Kecil | Rp50 juta sampai Rp500 juta | hingga 60 bulan |

KUR Kecil memakai agunan sesuai ketentuan bank, sedangkan sebagian plafon sampai Rp100 juta bisa tanpa agunan tambahan. Bunga disebut 6% per tahun, tetapi artikel sumber menulis "flat" di ringkasan dan "efektif" di rincian; pastikan ke bank bila simulasi KUR ditambahkan nanti.

**Rumus skor kelayakan (disetujui kelompok, 0 sampai 100)**

| Komponen | Bobot | Dasar hitung |
| --- | --- | --- |
| Konsistensi pencatatan | 30 | Jumlah bulan yang punya transaksi dari 6 bulan terakhir |
| Tren pemasukan | 25 | Pemasukan 3 bulan terakhir dibanding 3 bulan sebelumnya; penuh bila naik atau tetap |
| Profitabilitas | 25 | Margin laba bersih; penuh pada margin 20% atau lebih |
| Stabilitas arus kas | 20 | Jumlah bulan dengan laba bersih positif dari 6 bulan terakhir |

```latex
Skor = 30 \cdot \frac{B_{catat}}{6} + 25 \cdot \min\left(1, \frac{R_{baru}}{R_{lama}}\right) + 25 \cdot \min\left(1, \frac{\max(0, M)}{0{,}20}\right) + 20 \cdot \frac{B_{laba}}{6}
```

B\_catat adalah jumlah bulan bertransaksi, R\_baru dan R\_lama adalah total pemasukan 3 bulan terakhir dan 3 bulan sebelumnya, M adalah margin laba bersih, dan B\_laba adalah jumlah bulan dengan laba positif. Jika R\_lama bernilai 0 dan R\_baru lebih dari 0, komponen tren bernilai penuh. Jika data kurang dari 6 bulan, skor dihitung dari bulan yang ada dan sistem menampilkan peringatan data belum cukup.

Kategori skor: Rendah (di bawah 40), Cukup (40 sampai 69), Baik (70 ke atas).

**Status cek kelayakan KUR**

- Memenuhi syarat: semua syarat administratif terpenuhi dan skor Cukup atau Baik.
- Belum siap: syarat administratif terpenuhi tetapi skor Rendah; sistem menampilkan rekomendasi perbaikan keuangan.
- Belum memenuhi: ada syarat administratif yang gagal; sistem menyebut syarat yang kurang.

**Kriteria cicilan sesuai arus kas (disetujui kelompok)**

Cicilan bulanan tidak lebih dari 30% rata-rata laba bersih bulanan selama 6 bulan terakhir. Angka 30%, bobot skor, margin 20%, dan batas 40 serta 70 adalah asumsi tanpa sumber yang sudah disetujui kelompok; kalibrasi dengan data nyata saat pengujian.

Hasil cek adalah estimasi persiapan pengajuan, bukan keputusan bank.

**Sumber:** [Bisnis.com, Tabel KUR BRI 2026 Lengkap dengan Bunga 6 Persen dan Syarat Pengajuan (26 Januari 2026)](https://finansial.bisnis.com/read/20260126/90/1947141/tabel-kur-bri-2026-lengkap-dengan-bunga-6-persen-dan-syarat-pengajuan)

## Kebutuhan Non-Fungsional

| Aspek | Kebutuhan |
| --- | --- |
| Usability | Antarmuka sederhana dan mudah dipahami pelaku UMKM tanpa latar belakang teknis |
| Responsiveness | Tampilan menyesuaikan layar laptop dan mobile dengan CSS responsive |
| Performance | Operasi umum (login, tambah transaksi, lihat dashboard) selesai dalam 1 detik; pembuatan PDF maksimal 10 detik dengan indikator progres |
| Security | Password disimpan sebagai hash, bukan plain text |
| Data integrity | Data tidak berubah atau hilang tanpa aksi eksplisit pengguna |
| Consistency | Warna, tombol, dan layout konsisten di semua pilar |
| Maintainability | Kode frontend, backend, dan query database terorganisir per fitur |

Batas waktu mengacu pada [Nielsen Norman Group](https://www.nngroup.com/articles/website-response-times/): 1 detik menjaga alur berpikir pengguna dan 10 detik adalah batas perhatian pengguna.

## Panduan UI/UX

Antarmuka dirancang untuk pelaku UMKM non-teknis: bahasa sehari-hari, satu tujuan per halaman, dan tampilan yang sama di laptop maupun ponsel.

**Prinsip desain**

- **Bahasa sederhana:** pakai istilah seperti pemasukan dan pengeluaran; istilah perbankan diberi penjelasan singkat.
- **Input minimal:** form transaksi hanya meminta tanggal, kategori, jenis, dan nominal.
- **Umpan balik cepat:** setelah transaksi tersimpan, dashboard dan skor langsung diperbarui.
- **Peringatan jelas:** skor dan simulasi selalu berlabel estimasi, bukan keputusan bank; peringatan risiko cicilan memakai teks dan ikon, tidak hanya warna.
- **Konsisten dan responsif:** warna, tombol, dan layout sama di semua pilar, dan diuji di laptop serta ponsel.

**Halaman utama**

| Halaman | Isi | Fitur |
| --- | --- | --- |
| Registrasi dan login | Form akun, pesan error login | F1, F2 |
| Dashboard | Pemasukan, pengeluaran, laba bersih per periode, skor terbaru | F5, F6 |
| Transaksi | Daftar transaksi, form tambah, ubah, hapus | F4 |
| Laporan keuangan | Ringkasan dan tombol unduh PDF | F7 |
| KUR | Cek kelayakan, checklist dokumen, KUR Planner, laporan pengajuan | F8 sampai F11 |
| Koperasi | Form simulasi, hasil cicilan, form pengajuan | F12, F13 |
| Perbandingan | Tabel dua simulasi koperasi berdampingan | F17 |
| Legalitas | Panduan bertahap, checklist, info sertifikasi, status legalitas | F14 sampai F16 |
| Admin | Kelola konten panduan, pantau pengguna | F18 |

**Arah desain: Buku Kas Warung (Design System & Color Palette)**

Antarmuka meminjam estetika fisik buku kas warung: kertas hangat, garis tipis tegas, dan baris angka yang rapi sejajar. Tujuannya memberikan rasa familier, tenang, dan transparan bagi pelaku UMKM tanpa nuansa aplikasi korporat perbankan yang kaku atau gradien neon artifisial.

**Palet Warna Utama (Color Tokens)**

| Peran | Hex Code | Deskripsi & Penggunaan |
| --- | --- | --- |
| **Primary** | `#1F6B4F` | Hijau tua (*Forest Pine*): Tombol aksi utama (*Primary Button*), indikator pemasukan, badge navigasi aktif, dan status "Baik" |
| **Secondary** | `#B5532F` | Terakota (*Warm Brick/Rust*): Indikator pengeluaran, peringatan risiko cicilan, tombol bahaya/hapus, dan status skor "Rendah" |
| **Tertiary** | `#C98A1B` | Ochre (*Warm Mustard Gold*): Aksen perhatian, catatan panduan, status "Cukup", dan progres berjalan |
| **Neutral / Teks** | `#1F2A24` | Charcoal gelap (*Deep Forest Slate*): Teks judul, teks isi utama, tombol *Inverted*, dan garis pembatas tegas |
| **Latar Kanvas** | `#FAF7F2` | Kertas hangat (*Warm Paper*): Latar belakang utama seluruh halaman |
| **Wadah & Kartu** | `#EAF1EB` / `#FFFFFF` | Latar kartu (*Card container*) dengan nuansa sage lembut atau putih kertas bersih |
| **Border / Garis** | `#D2DDD5` / `#1F2A24` (15%) | Garis pembatas tipis 1px untuk kartu, tabel pembukuan, dan input form |

**Tipografi**

| Level | Font Family | Bobot (Weight) | Penggunaan |
| --- | --- | --- | --- |
| **Headline** | `Source Serif 4` | SemiBold (600) / Bold (700) | Judul halaman, tajuk ringkasan finansial, dan angka skor utama |
| **Body** | `IBM Plex Sans` | Regular (400) / Medium (500) | Teks isi, deskripsi formulir, panduan, dan teks navigasi |
| **Label / Caption** | `IBM Plex Sans` | Medium (500) / SemiBold (600) | Label form, badge status, microcopy, dan header tabel |
| **Nominal & Angka** | `IBM Plex Sans` (Tabular) | Regular (400) / SemiBold (600) | Semua nominal rupiah dan data tanggal (`font-variant-numeric: tabular-nums`) |

**Spesifikasi Komponen UI (Buku Kas Warung Component Set)**

- **Varian Tombol (Button Styles):**
  - *Primary Button:* Latar `#1F6B4F`, teks `#FFFFFF`, sudut membulat 6–8px. Digunakan untuk aksi utama ("Catat Transaksi", "Hitung Cicilan").
  - *Secondary Button:* Latar `#DFEBE2`, teks `#1F2A24`. Digunakan untuk aksi sekunder ("Batal", "Filter").
  - *Inverted Button:* Latar `#1F2A24`, teks `#FFFFFF`. Digunakan untuk penekanan kontras tinggi.
  - *Outlined Button:* Latar transparan, border 1px `#1F2A24`, teks `#1F2A24`.
- **Elemen Input & Pencarian:**
  - Latar input `#F0F5F1` atau `#FFFFFF`, border 1px `#D5E0D8`, teks `#1F2A24`.
  - Input pencarian dilengkapi ikon kaca pembesar (*Search*) minimalis.
- **Indikator Visual & Bar Metrik:**
  - Grafik batang komparasi menggunakan warna Solid: Pemasukan (`#1F6B4F`), Pengeluaran (`#B5532F`), dan Cadangan/Proyeksi (`#C98A1B`) dengan track latar belakang netral pudar.
- **Navigasi & Ikon:**
  - *Floating Nav Pill:* Bilah navigasi melayang yang ringkas dengan ikon garis (Lucide/Heroicons) dan indikator aktif berwarna hijau `#1F6B4F`.
  - *Icon Badges:* Tombol aksi persegi membulat (Edit `#1F6B4F`, Badge `#C98A1B`, Hapus `#B5532F`).
  - Tidak menggunakan emoji atau karakter 3D.
- **Bentuk Kartu:**
  - Kartu datar (*flat card*), sudut membulat 8–16px pada container dan 6px pada kartu data internal, border 1px halus, **tanpa drop shadow / blur tebal**.

**Aturan tata letak**

- Dashboard: tiga angka (pemasukan, pengeluaran, laba bersih) berdampingan, lalu grafik batang 6 bulan dan satu skor.
- Skor tampil sebagai angka besar dengan satu kalimat saran, bukan speedometer.
- Daftar transaksi berupa tabel bergaris seperti buku kas, bukan deretan kartu.
- Form satu kolom; pesan kesalahan ditulis di bawah kolom yang salah.
- Laptop memakai menu samping; ponsel memakai menu bawah dengan empat item.
- Tombol memakai kata kerja: "Catat transaksi", "Hitung cicilan", "Unduh laporan".

&#91;embedded content: wireframe dashboard · laptop dan ponsel\]

**Hindari ciri tampilan generik**

- Gradien ungu-biru, kartu kaca buram (glassmorphism), dan bayangan tebal melayang.
- Emoji atau ilustrasi 3D sebagai pengganti ikon dan isi.
- Halaman depan berisi tiga kartu fitur identik dengan slogan umum.
- Semua teks rata tengah dan semua komponen berukuran sama.

**Contoh teks antarmuka**

- Daftar kosong: "Belum ada transaksi bulan ini. Catat yang pertama."
- Peringatan cicilan: "Cicilan ini melebihi 30% rata-rata laba bersih Anda. Coba tenor lebih panjang atau nominal lebih kecil."

**Rujukan alur pengajuan KUR:** urutan isi data, unggah dokumen, hitung angsuran, lalu ajukan, dibaca dari [artikel Bisnis.com](https://finansial.bisnis.com/read/20260126/90/1947141/tabel-kur-bri-2026-lengkap-dengan-bunga-6-persen-dan-syarat-pengajuan). Tampilan situs bank belum saya tinjau.

## Arsitektur Teknologi & Frontend

**Teknologi Frontend**

- **HTML5:** Struktur semantik, aksesibel (WCAG AA), dan SEO-friendly.
- **CSS3 (Vanilla CSS & CSS Variables):** Styling menggunakan variabel token desain (`--color-primary: #1F6B4F`, `--font-headline: 'Source Serif 4'`, dll.) untuk fleksibilitas maksimal, performa tinggi, dan kontrol penuh tanpa ketergantungan framework CSS pihak ketiga.
- **JavaScript (ES6+):** Logika kalkulasi interaktif, manipulasi DOM, validasi formulir, dan ekspor data.
- **React.js:** Membangun antarmuka berbasis komponen modular (*reusable components*), state management reaktif untuk simulasi cicilan, kalkulasi skor kelayakan dinamis, dan navigasi multi-pilar.

**Fokus Tahapan Saat Ini: Frontend-First**

- Prioritas pengembangan saat ini **difokuskan penuh pada sisi frontend**:
  1. Membangun sistem desain dan pustaka komponen Buku Kas Warung.
  2. Implementasi antarmuka landing page dan halaman inti aplikasi (Dashboard, Transaksi, Cek KUR, Simulasi Koperasi).
  3. Memastikan responsivitas sempurna di laptop maupun layar ponsel (*mobile-first*).
  4. Pengujian alur interaksi dan logika kalkulasi matematis di sisi client sebelum integrasi backend penuh.

## User Flow Utama

&#91;embedded content: alur KUR dan koperasi · 2 jalur, 2 keputusan\]

Jika syarat KUR belum terpenuhi, alur berhenti di rekomendasi perbaikan keuangan. Pengajuan koperasi hanya disimpan bila cicilan sesuai arus kas; jika tidak, pengguna kembali ke form dengan peringatan risiko.

Semua alur didahului registrasi dan login: akun baru divalidasi lalu disimpan ke database, kredensial dicek ke database, dan pengguna masuk ke dashboard utama.

## Arsitektur Data dan Model Database

&#91;embedded content: model data · 12 entitas milik Pengguna, 5 relasi antar entitas\]

Semua entitas membawa id\_pengguna sebagai foreign key dari Pengguna (id\_pengguna, username, password\_hash, email, created\_at). Prinsip satu sumber data terlihat pada SkorKelayakan: dihitung dari Transaksi, lalu dipakai cek kelayakan KUR dan laporan pengajuan.

Semua atribut bertipe stored, simple, dan single-valued, kecuali estimasi\_cicilan pada SimulasiKoperasi yang ditandai derived attribute. Estimasi cicilan dihitung saat ditampilkan, sehingga tidak disimpan di database.

**Penyempurnaan model data**

| Entitas | Perubahan | Alasan |
| --- | --- | --- |
| Pengguna | Tambah atribut peran (pelaku UMKM atau admin) | Admin ada di use case |
| ProfilUsaha | Tambah tanggal\_mulai\_usaha | Syarat KUR: usaha berjalan minimal 6 bulan |
| Transaksi dan SkorKelayakan | Tambah id\_profil (foreign key ke ProfilUsaha) | Satu pengguna bisa punya lebih dari satu usaha; data keuangan tidak tercampur |
| KontenPanduan (baru) | id\_konten (PK), id\_pengguna (FK, admin), jenis (legalitas atau sertifikasi), judul, isi, tanggal\_ubah | Konten panduan legalitas dan sertifikasi yang dikelola admin |
| PerbandinganPembiayaan | id\_perbandingan (PK), id\_pengguna (FK), id\_simulasi\_a (FK), id\_simulasi\_b (FK), tanggal\_dibuat | Membandingkan dua simulasi koperasi berdampingan; selisih cicilan dihitung saat ditampilkan, tidak disimpan |

Reminder legalitas memakai atribut masa\_berlaku yang sudah ada di LegalitasUsaha, jadi tidak perlu entitas baru.

## Asumsi, Risiko, dan Batasan

**Asumsi**

- Pengguna bersedia mencatat transaksi secara rutin; kualitas skor dan laporan bergantung pada hal ini.
- Aplikasi berbasis web dengan frontend, backend, dan database relasional.
- Hasil simulasi dan skor dipahami sebagai estimasi, bukan jaminan persetujuan.

**Risiko**

| Risiko | Dampak | Mitigasi (usulan) |
| --- | --- | --- |
| Pencatatan tidak konsisten oleh pengguna | Skor kelayakan dan laporan tidak mencerminkan kondisi usaha | Form transaksi singkat, validasi input, tampilan dashboard yang memberi umpan balik cepat |
| Rumus skor dan kriteria KUR belum didefinisikan | Hasil tidak bisa diuji dan bisa menyesatkan | Tetapkan rumus dan ambang sebelum implementasi modul KUR |
| Simulasi dikira keputusan kredit | Ekspektasi pengguna keliru | Cantumkan keterangan simulatif di setiap hasil perbandingan |
| Data keuangan pengguna bocor | Kerugian pengguna dan hilangnya kepercayaan | Hash password, akses data per pengguna |
| Lingkup lima pilar terlalu besar untuk tim kecil | Jadwal tertunda | Rilis bertahap, utamakan fitur Must |

**Batasan**

- Sistem tidak memberi keputusan persetujuan kredit.
- Tim mengembangkan frontend, backend, dan database sendiri; kode harus terorganisir per fitur agar mudah dipelihara anggota tim.

## Rencana Rilis dan Pertanyaan Terbuka

Dokumen asli tidak memuat jadwal. Usulan rilis bertahap berikut mengikuti prioritas fitur dan ketergantungan data; tanggal menunggu keputusan tim.

| Tahap | Isi | Alasan urutan |
| --- | --- | --- |
| 1. Fondasi | F1 sampai F7: autentikasi, profil, transaksi, dashboard, skor kelayakan, laporan keuangan PDF | Semua modul lain bergantung pada data transaksi dan skor |
| 2. Pembiayaan | F8 sampai F13 dan F17: KUR, koperasi, perbandingan | Memakai skor dan data keuangan dari tahap 1 |
| 3. Legalitas dan administrasi | F14 sampai F16, F18 | Relatif mandiri dari alur pembiayaan |

**Pertanyaan terbuka dari analisis dokumen**

- [x] Rumus skor kelayakan: dinilai dari perkembangan keuangan 6 bulan terakhir; rumus lengkap ada di bagian Kriteria KUR dan Skor Kelayakan.
- [x] Kriteria memenuhi syarat KUR: usaha minimal 6 bulan dan syarat lain dari hasil riset, di bagian yang sama.
- [x] Admin: perlu ditambahkan; atribut peran dan entitas KontenPanduan sudah dirancang.
- [x] Laporan keuangan PDF: wajib, masuk versi pertama.
- [x] Simulasi KUR: tidak ada untuk sementara; perbandingan hanya untuk simulasi koperasi.
- [x] Atribut PerbandinganPembiayaan: sudah ditentukan di bagian Arsitektur Data.
- [x] Batas waktu respons: 1 detik untuk operasi umum, 10 detik untuk PDF dengan indikator progres.
- [x] Estimasi cicilan dihitung saat ditampilkan, tidak disimpan.
- [x] Satu pengguna lebih dari satu usaha: 1:N dengan id\_profil di Transaksi dan SkorKelayakan; UI versi pertama cukup satu usaha aktif.
- [x] Bobot skor (30, 25, 25, 20), batas kategori (40 dan 70), target margin 20%, dan batas cicilan 30% dari laba bersih: disetujui kelompok.
- [x] Panduan legalitas, info sertifikasi, dan reminder (F15, F16): tetap di tahap 3.
- [x] Referensi desain: arah desain buku kas dan wireframe dashboard sudah dibuat di bagian Panduan UI/UX.
