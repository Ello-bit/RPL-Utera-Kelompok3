/**
 * UTERA · Laporan Siap Bank
 * Service layer: orchestrates data from Profil Usaha, Buku Kas Warung, Legalitas & NIB, and Skor Kelayakan.
 */
(function (global) {
  'use strict';

  const KEY_PROFILE = 'utera_profil_usaha';
  const KEY_KAS = 'utera.kas.transaksi.v1';
  const KEY_LEGALITAS = 'utera.legalitas.v1';

  const memoryStore = {};

  function safeStorage(type) {
    try {
      if (typeof window !== 'undefined' && window[type]) {
        const s = window[type];
        const t = '__utera_test__';
        s.setItem(t, t);
        s.removeItem(t);
        return s;
      }
    } catch (e) { /* storage restricted, use memory fallback */ }
    return {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(memoryStore, k) ? memoryStore[k] : null),
      setItem: (k, v) => { memoryStore[k] = String(v); },
      removeItem: (k) => { delete memoryStore[k]; },
    };
  }

  /* ---------------- Default Seed Data (Realistis & Konsisten) ---------------- */

  const DEFAULT_PROFILE = Object.freeze({
    id: 'p_kopi_01',
    nama_usaha: 'Kopi Nusantara',
    nama_pemilik: 'Budi Santoso',
    jenis_usaha: 'Kuliner & Minuman',
    tanggal_mulai_usaha: '2023-01-10',
    nomor_telepon: '0812-3456-7890',
    alamat_usaha: 'Jl. Malioboro No. 42, Kel. Sosromenduran, Kec. Gedongtengen, Kota Yogyakarta, D.I. Yogyakarta',
    deskripsi_usaha: 'Kedai kopi spesialis biji kopi nusantara dengan sajian minuman dan camilan khas, melayani pelanggan sejak 2023.',
    nib: { punya: true, nomor: '1234567890123' },
    npwp: { punya: true, nomor: '84.123.456.7-123.000' },
  });

  const DEFAULT_LEGALITAS = Object.freeze({
    nib: {
      nomor: '1234567890123',
      nama_usaha: 'Kopi Nusantara',
      penanggung_jawab: 'Budi Santoso',
      kbli: '56103 Kedai Makanan & Minuman',
      tanggal_terbit: '2024-05-15',
    },
    dokumen: [
      { id: 'doc_nib', kategori: 'nib', nama: 'Nomor Induk Berusaha (NIB)', nomor: '1234567890123', berkas: { nama: 'Dokumen-NIB-Resmi.pdf' } },
      { id: 'doc_npwp', kategori: 'npwp', nama: 'NPWP Usaha', nomor: '84.123.456.7-123.000', berkas: { nama: 'Kartu-NPWP.jpg' } },
      { id: 'doc_halal', kategori: 'halal', nama: 'Sertifikat Halal BPJPH', nomor: 'ID3211000123456', berlaku_hingga: '2028-10-20', berkas: { nama: 'Sertifikat-Halal.pdf' } },
      { id: 'doc_pirt', kategori: 'pirt', nama: 'PIRT / Izin Edar Dinkes', nomor: 'P-IRT 2063204010123-28', berlaku_hingga: '2027-06-15', berkas: { nama: 'Izin-Edar-PIRT.png' } },
    ],
  });

  const DEFAULT_TRANSACTIONS = [
    // 6 Bulan pembukuan: Mei s.d. Oktober 2026
    { id: 'tx_seed_01', date: '2026-05-08', type: 'income', category: 'Penjualan', note: 'Rekap Penjualan Kopi & Toast', amount: 18200000 },
    { id: 'tx_seed_02', date: '2026-05-15', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Biji Kopi & Susu', amount: 6100000 },
    { id: 'tx_seed_03', date: '2026-05-25', type: 'expense', category: 'Operasional', note: 'Listrik & Gas Elpiji', amount: 2000000 },
    { id: 'tx_seed_04', date: '2026-06-05', type: 'income', category: 'Penjualan', note: 'Rekap Shift Kasir Warung', amount: 19500000 },
    { id: 'tx_seed_05', date: '2026-06-12', type: 'expense', category: 'Bahan baku / kulakan', note: 'Bahan Makanan & Sirup', amount: 6400000 },
    { id: 'tx_seed_06', date: '2026-06-28', type: 'expense', category: 'Operasional', note: 'Sewa Tempat & Listrik', amount: 2000000 },
    { id: 'tx_seed_07', date: '2026-07-06', type: 'income', category: 'Penjualan', note: 'Penjualan Minuman & Camilan', amount: 20400000 },
    { id: 'tx_seed_08', date: '2026-07-14', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Biji Kopi Robusta', amount: 6800000 },
    { id: 'tx_seed_09', date: '2026-07-27', type: 'expense', category: 'Operasional', note: 'Listrik & Kebersihan', amount: 2000000 },
    { id: 'tx_seed_10', date: '2026-08-04', type: 'income', category: 'Penjualan', note: 'Omzet Harian & Acara Komunitas', amount: 21800000 },
    { id: 'tx_seed_11', date: '2026-08-16', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Kemasan & Cup Kopi', amount: 5500000 },
    { id: 'tx_seed_12', date: '2026-08-28', type: 'expense', category: 'Operasional', note: 'Listrik & Perawatan Mesin Kopi', amount: 2000000 },
    { id: 'tx_seed_13', date: '2026-09-05', type: 'income', category: 'Penjualan', note: 'Rekap Penjualan Kopi Nusantara', amount: 22100000 },
    { id: 'tx_seed_14', date: '2026-09-15', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Bahan Baku Bulanan', amount: 5900000 },
    { id: 'tx_seed_15', date: '2026-09-29', type: 'expense', category: 'Operasional', note: 'Listrik PLN & Internet', amount: 2000000 },
    { id: 'tx_seed_16', date: '2026-10-02', type: 'income', category: 'Penjualan', note: 'Rekap Kasir Awal Bulan', amount: 4500000 },
    { id: 'tx_seed_17', date: '2026-10-06', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Susu UHT & Gula Aren', amount: 1850000 },
    { id: 'tx_seed_18', date: '2026-10-12', type: 'income', category: 'Penjualan', note: 'Pesanan Katering Kopi 50 Cup', amount: 2800000 },
    { id: 'tx_seed_19', date: '2026-10-18', type: 'expense', category: 'Operasional', note: 'Token Listrik & Gas', amount: 950000 },
    { id: 'tx_seed_20', date: '2026-10-22', type: 'income', category: 'Penjualan', note: 'Penjualan Shift Siang & Malam', amount: 3200000 },
    { id: 'tx_seed_21', date: '2026-10-26', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Biji Kopi Espresso', amount: 1600000 },
    { id: 'tx_seed_22', date: '2026-10-27', type: 'income', category: 'Penjualan', note: 'Rekap Penjualan Akhir Pekan', amount: 14350000 },
    { id: 'tx_seed_23', date: '2026-10-27', type: 'expense', category: 'Operasional', note: 'Gaji Karyawan Shift Part-time', amount: 2000000 },
  ];

  /* ---------------- Data Loader ---------------- */

  function loadProfile() {
    try {
      const raw = safeStorage('localStorage').getItem(KEY_PROFILE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].nama_usaha) {
          return { ...DEFAULT_PROFILE, ...parsed[0] };
        }
        if (parsed && typeof parsed === 'object' && parsed.nama_usaha) {
          return { ...DEFAULT_PROFILE, ...parsed };
        }
      }
    } catch (e) { /* ignore */ }
    return { ...DEFAULT_PROFILE };
  }

  function loadTransactions() {
    try {
      const raw = safeStorage('localStorage').getItem(KEY_KAS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) { /* ignore */ }
    return DEFAULT_TRANSACTIONS.slice();
  }

  function loadLegalitas() {
    try {
      const raw = safeStorage('localStorage').getItem(KEY_LEGALITAS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.nib || Array.isArray(parsed.dokumen))) {
          return {
            nib: parsed.nib || DEFAULT_LEGALITAS.nib,
            dokumen: Array.isArray(parsed.dokumen) && parsed.dokumen.length > 0 ? parsed.dokumen : DEFAULT_LEGALITAS.dokumen,
          };
        }
      }
    } catch (e) { /* ignore */ }
    return { ...DEFAULT_LEGALITAS };
  }

  const Service = {
    async loadAllReportData() {
      // Non-blocking asynchronous contract
      const profile = loadProfile();
      const transactions = loadTransactions();
      const legalitas = loadLegalitas();

      const monthlyData = global.LaporanLogic.aggregateMonthly(transactions);
      const score = global.LaporanLogic.calculatePrdScore(monthlyData);
      const readiness = global.LaporanLogic.assessReportReadiness({
        profile,
        transactions,
        legalitas,
        score,
      });

      return {
        profile,
        transactions,
        legalitas,
        monthlyData,
        score,
        readiness,
        generatedAt: new Date().toISOString(),
      };
    },
  };

  global.LaporanService = Service;
})(window);

