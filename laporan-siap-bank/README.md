# Dokumentasi Fitur Laporan Siap Bank — UTERA

Dokumentasi arsitektur frontend, sintesis 4 pilar data, evaluasi kesiapan, dan pembuatan berkas PDF untuk modul **Laporan Siap Bank** (F7 & F11 PRD UTERA).

---

## 1. Ikhtisar Fitur

Fitur **Laporan Siap Bank** berfungsi sebagai agregator dokumen resmi yang menyatukan seluruh data usaha yang telah diinput pengguna di berbagai modul UTERA:

1. **Profil Usaha** (`utera_profil_usaha`): Identitas usaha, penanggung jawab, sektor/KBLI, tanggal berdiri, kontak, dan alamat operasional.
2. **Buku Kas Warung** (`utera.kas.transaksi.v1`): Riwayat transaksi kas masuk (omzet), pengeluaran operasional, laba bersih, dan arus kas per bulan.
3. **Legalitas & NIB** (`utera.legalitas.v1`): NIB 13 digit resmi OSS RBA dan daftar dokumen izin (NPWP, Sertifikat Halal, PIRT).
4. **Skor Kelayakan Usaha**: Perhitungan skor 0–100 berdasarkan rumus resmi PRD UTERA (Konsistensi, Tren, Margin, Stabilitas Arus Kas).
5. **Kapasitas Guardrail 30%**: Batas angsuran bulanan yang sehat dihitung maksimal 30% dari rata-rata laba bersih bulanan.

---

## 2. Struktur Modul

```
laporan-siap-bank/
├── index.html        # Shell aplikasi, toolbar filter, dashboard kesiapan, dan preview A4
├── styles.css        # Desain UTERA (Plus Jakarta Sans, Forest Pine #1F6B4F, Print A4)
├── README.md         # Dokumentasi teknis, kontrak backend, dan spesifikasi PDF
└── js/
    ├── models.js     # Enum status kesiapan, filter periode (1, 3, 6, 12 bln), pilar data
    ├── logic.js      # Agregasi keuangan, kalkulasi skor PRD, guardrail 30%, format Rupiah
    ├── service.js    # Data bridge ke localStorage dengan mock data fallback
    └── app.js        # Controller UI, tabs view mode, filter periode, dan PDF print export
```

---

## 3. Status Kesiapan Laporan

Sistem mengevaluasi kelengkapan 4 pilar secara otomatis:

- **Siap Dibuat** (Hijau): Seluruh 4 pilar data terpenuhi (Profil, Transaksi Kas >= 3, NIB terdata, Skor terhitung). Dokumen siap diajukan ke bank/koperasi.
- **Perlu Dilengkapi** (Kuning): 2–3 pilar telah siap, tetapi masih ada data yang perlu dilengkapi. Tersedia tombol navigasi langsung ke modul terkait.
- **Belum Siap** (Merah): Data utama belum mencukupi (misal belum ada pembukuan kas warung).

---

## 4. Format & Spesifikasi Dokumen PDF

- **Nama Berkas**: `laporan-siap-bank.pdf`
- **Format Kertas**: Standar A4 Portrait (210 x 297 mm)
- **Margin**: 12mm atas/bawah, 15mm kiri/kanan (`@page { size: A4 portrait; margin: 12mm 15mm; }`)
- **Struktur Isi 5 Bagian**:
  1. *Bagian 1:* Identitas dan Profil Usaha
  2. *Bagian 2:* Legalitas & Dokumen Usaha (NIB 13 digit & Checklist)
  3. *Bagian 3:* Kondisi Keuangan & Arus Kas (Tabel Bulanan + KPI Laba + Guardrail 30%)
  4. *Bagian 4:* Evaluasi Skor Kelayakan Usaha (Skor 0–100 & 4 Komponen)
  5. *Bagian 5:* Rekomendasi Pembiayaan, Tanda Tangan Pemilik Usaha, dan Disclaimer Wajib PRD.

---

## 5. Pernyataan Batasan Dokumen (Disclaimer)

Dokumen ini mencantumkan penafian resmi sesuai mandat PRD:

> "Laporan ini disusun secara otomatis berdasarkan data pembukuan dan administrasi usaha yang tercatat pada platform UTERA. Dokumen ini merupakan ringkasan kondisi usaha dan dokumen pendukung persiapan pengajuan pembiayaan (KUR / Koperasi), bukan keputusan persetujuan kredit, penilaian resmi bank, atau jaminan pencairan dana. Keputusan akhir pembiayaan sepenuhnya merupakan hak dan wewenang lembaga keuangan penyalur kredit terkait."

