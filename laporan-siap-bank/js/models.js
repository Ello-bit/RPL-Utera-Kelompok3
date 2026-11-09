/**
 * UTERA · Laporan Siap Bank
 * Data models and constants for bank-ready report synthesis.
 */
(function (global) {
  'use strict';

  const REPORT_STATUS = Object.freeze({
    SIAP_DIBUAT: 'siap_dibuat',
    PERLU_DILENGKAPI: 'perlu_dilengkapi',
    BELUM_SIAP: 'belum_siap',
  });

  const REPORT_PERIODS = Object.freeze([
    { id: '1m', label: '1 Bulan Terakhir', months: 1, hint: '30 hari terakhir' },
    { id: '3m', label: '3 Bulan Terakhir', months: 3, hint: 'Kuartal terakhir' },
    { id: '6m', label: '6 Bulan (Standar Bank / KUR)', months: 6, hint: 'Rekomendasi standar perbankan', isDefault: true },
    { id: '12m', label: '12 Bulan (1 Tahun)', months: 12, hint: 'Tinjauan tahunan lengkap' },
  ]);

  const PILLARS = Object.freeze([
    {
      id: 'profil',
      name: 'Profil Usaha',
      icon: 'storefront',
      link: '../profil-usaha/index.html',
      description: 'Identitas usaha, nama pemilik, jenis sektor, dan alamat operasional.',
      requiredFields: ['nama_usaha', 'nama_pemilik', 'jenis_usaha', 'tanggal_mulai_usaha'],
    },
    {
      id: 'keuangan',
      name: 'Catatan Keuangan',
      icon: 'receipt_long',
      link: '../Buku-Kas-Warung/index.html',
      description: 'Riwayat pencatatan transaksi kas masuk, kas keluar, dan omzet berkala.',
      requiredFields: ['transaksi_min_3'],
    },
    {
      id: 'legalitas',
      name: 'Legalitas & NIB',
      icon: 'verified_user',
      link: '../legalitas-&-nib/index.html',
      description: 'Nomor Induk Berusaha (NIB 13 digit) dan dokumen pendukung seperti NPWP atau izin edar.',
      requiredFields: ['nomor_nib'],
    },
    {
      id: 'skor',
      name: 'Skor Kelayakan',
      icon: 'verified',
      link: '../Skor-Kelayakan/index.html',
      description: 'Evaluasi kesehatan finansial berdasarkan konsistensi, tren omzet, dan profitabilitas.',
      requiredFields: ['skor_terhitung'],
    },
  ]);

  const DISCLAIMER_TEXT =
    'Laporan ini disusun secara otomatis berdasarkan data pembukuan dan administrasi usaha yang tercatat pada platform UTERA. Dokumen ini merupakan ringkasan kondisi usaha dan dokumen pendukung persiapan pengajuan pembiayaan (KUR / Koperasi), bukan keputusan persetujuan kredit, penilaian resmi bank, atau jaminan pencairan dana. Keputusan akhir pembiayaan sepenuhnya merupakan hak dan wewenang lembaga keuangan penyalur kredit terkait.';

  global.LaporanModels = Object.freeze({
    REPORT_STATUS,
    REPORT_PERIODS,
    PILLARS,
    DISCLAIMER_TEXT,
  });
})(window);

