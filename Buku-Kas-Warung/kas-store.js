/**
 * UTERA Buku Kas: penyimpanan transaksi bersama.
 * Satu sumber data untuk halaman Buku Kas Warung dan Dashboard (PRD: "satu sumber data").
 * Disimpan di localStorage sampai backend tersedia.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'utera.kas.transaksi.v1';

  var CATEGORIES = {
    income: ['Penjualan', 'Pendapatan lain'],
    expense: ['Bahan baku / kulakan', 'Operasional', 'Gaji karyawan', 'Peralatan', 'Lainnya']
  };

  // Status terakhir baca/tulis, dipakai UI untuk menampilkan error state.
  var state = { readError: null, writeError: null };
  var memoryFallback = null;

  function storageAvailable() {
    try {
      var probe = '__utera_probe__';
      global.localStorage.setItem(probe, probe);
      global.localStorage.removeItem(probe);
      return true;
    } catch (e) {
      return false;
    }
  }

  function isValidTx(tx) {
    return tx &&
      typeof tx.id === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(tx.date) &&
      (tx.type === 'income' || tx.type === 'expense') &&
      typeof tx.category === 'string' &&
      typeof tx.amount === 'number' && tx.amount > 0;
  }

  function getInitialSeed() {
    return [
      // === BISNIS 1: Kopi Nusantara (biz_kopi) ===
      { id: 'tx_seed_01', bizId: 'biz_kopi', date: '2026-05-08', type: 'income', category: 'Penjualan', note: 'Rekap Penjualan Kopi & Toast', amount: 18200000, createdAt: 1778200000000 },
      { id: 'tx_seed_02', bizId: 'biz_kopi', date: '2026-05-15', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Biji Kopi & Susu', amount: 6100000, createdAt: 1778800000000 },
      { id: 'tx_seed_03', bizId: 'biz_kopi', date: '2026-05-25', type: 'expense', category: 'Operasional', note: 'Listrik & Gas Elpiji', amount: 2000000, createdAt: 1779600000000 },
      { id: 'tx_seed_04', bizId: 'biz_kopi', date: '2026-06-05', type: 'income', category: 'Penjualan', note: 'Rekap Shift Kasir Warung', amount: 19500000, createdAt: 1780800000000 },
      { id: 'tx_seed_05', bizId: 'biz_kopi', date: '2026-06-12', type: 'expense', category: 'Bahan baku / kulakan', note: 'Bahan Makanan & Sirup', amount: 6400000, createdAt: 1781400000000 },
      { id: 'tx_seed_06', bizId: 'biz_kopi', date: '2026-06-28', type: 'expense', category: 'Operasional', note: 'Sewa Tempat & Listrik', amount: 2000000, createdAt: 1782700000000 },
      { id: 'tx_seed_07', bizId: 'biz_kopi', date: '2026-07-06', type: 'income', category: 'Penjualan', note: 'Penjualan Minuman & Camilan', amount: 20400000, createdAt: 1783400000000 },
      { id: 'tx_seed_08', bizId: 'biz_kopi', date: '2026-07-14', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Biji Kopi Robusta', amount: 6800000, createdAt: 1784100000000 },
      { id: 'tx_seed_09', bizId: 'biz_kopi', date: '2026-07-27', type: 'expense', category: 'Operasional', note: 'Listrik & Kebersihan', amount: 2000000, createdAt: 1785200000000 },
      { id: 'tx_seed_10', bizId: 'biz_kopi', date: '2026-08-04', type: 'income', category: 'Penjualan', note: 'Omzet Harian & Acara Komunitas', amount: 21800000, createdAt: 1785900000000 },
      { id: 'tx_seed_11', bizId: 'biz_kopi', date: '2026-08-16', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Kemasan & Cup Kopi', amount: 5500000, createdAt: 1786900000000 },
      { id: 'tx_seed_12', bizId: 'biz_kopi', date: '2026-08-28', type: 'expense', category: 'Operasional', note: 'Listrik & Perawatan Mesin Kopi', amount: 2000000, createdAt: 1787900000000 },
      { id: 'tx_seed_13', bizId: 'biz_kopi', date: '2026-09-05', type: 'income', category: 'Penjualan', note: 'Rekap Penjualan Kopi Nusantara', amount: 22100000, createdAt: 1788600000000 },
      { id: 'tx_seed_14', bizId: 'biz_kopi', date: '2026-09-15', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Bahan Baku Bulanan', amount: 5900000, createdAt: 1789500000000 },
      { id: 'tx_seed_15', bizId: 'biz_kopi', date: '2026-09-29', type: 'expense', category: 'Operasional', note: 'Listrik PLN & Internet', amount: 2000000, createdAt: 1790700000000 },
      { id: 'tx_seed_16', bizId: 'biz_kopi', date: '2026-10-02', type: 'income', category: 'Penjualan', note: 'Rekap Kasir Awal Bulan', amount: 4500000, createdAt: 1790900000000 },
      { id: 'tx_seed_17', bizId: 'biz_kopi', date: '2026-10-06', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Susu UHT & Gula Aren', amount: 1850000, createdAt: 1791300000000 },
      { id: 'tx_seed_18', bizId: 'biz_kopi', date: '2026-10-12', type: 'income', category: 'Penjualan', note: 'Pesanan Katering Kopi 50 Cup', amount: 2800000, createdAt: 1791800000000 },
      { id: 'tx_seed_19', bizId: 'biz_kopi', date: '2026-10-18', type: 'expense', category: 'Operasional', note: 'Token Listrik & Gas', amount: 950000, createdAt: 1792300000000 },
      { id: 'tx_seed_20', bizId: 'biz_kopi', date: '2026-10-22', type: 'income', category: 'Penjualan', note: 'Penjualan Shift Siang & Malam', amount: 3200000, createdAt: 1792700000000 },
      { id: 'tx_seed_21', bizId: 'biz_kopi', date: '2026-10-26', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Biji Kopi Espresso', amount: 1600000, createdAt: 1793000000000 },
      { id: 'tx_seed_22', bizId: 'biz_kopi', date: '2026-10-27', type: 'income', category: 'Penjualan', note: 'Rekap Penjualan Akhir Pekan', amount: 14350000, createdAt: 1793100000000 },
      { id: 'tx_seed_23', bizId: 'biz_kopi', date: '2026-10-27', type: 'expense', category: 'Operasional', note: 'Gaji Karyawan Shift Part-time', amount: 2000000, createdAt: 1793150000000 },

      // === BISNIS 2: Warung Sembako Barokah (biz_sembako) ===
      { id: 'tx_smb_01', bizId: 'biz_sembako', date: '2026-05-10', type: 'income', category: 'Penjualan', note: 'Penjualan Sembako Eceran & Grosir', amount: 12500000, createdAt: 1778300000000 },
      { id: 'tx_smb_02', bizId: 'biz_sembako', date: '2026-05-18', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Beras & Minyak Goreng', amount: 9200000, createdAt: 1779000000000 },
      { id: 'tx_smb_03', bizId: 'biz_sembako', date: '2026-06-08', type: 'income', category: 'Penjualan', note: 'Rekap Penjualan Beras & Telur', amount: 13800000, createdAt: 1781000000000 },
      { id: 'tx_smb_04', bizId: 'biz_sembako', date: '2026-06-16', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Gula Pasir & Mi Instan', amount: 10100000, createdAt: 1781800000000 },
      { id: 'tx_smb_05', bizId: 'biz_sembako', date: '2026-07-09', type: 'income', category: 'Penjualan', note: 'Penjualan Grosir Warung Kecil', amount: 14500000, createdAt: 1783700000000 },
      { id: 'tx_smb_06', bizId: 'biz_sembako', date: '2026-07-18', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Tepung Terigu & Minyak', amount: 10500000, createdAt: 1784500000000 },
      { id: 'tx_smb_07', bizId: 'biz_sembako', date: '2026-08-06', type: 'income', category: 'Penjualan', note: 'Omzet Sembako Harian', amount: 15000000, createdAt: 1786100000000 },
      { id: 'tx_smb_08', bizId: 'biz_sembako', date: '2026-08-17', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Beras 20 Karung', amount: 10800000, createdAt: 1787000000000 },
      { id: 'tx_smb_09', bizId: 'biz_sembako', date: '2026-09-08', type: 'income', category: 'Penjualan', note: 'Rekap Penjualan Awal Bulan', amount: 15600000, createdAt: 1788900000000 },
      { id: 'tx_smb_10', bizId: 'biz_sembako', date: '2026-09-19', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Minyak & Telur Ayam', amount: 11200000, createdAt: 1789900000000 },
      { id: 'tx_smb_11', bizId: 'biz_sembako', date: '2026-10-03', type: 'income', category: 'Penjualan', note: 'Penjualan Beras Rojolele & Minyak', amount: 4500000, createdAt: 1791000000000 },
      { id: 'tx_smb_12', bizId: 'biz_sembako', date: '2026-10-08', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Beras & Gula Pasir 5 Karung', amount: 6200000, createdAt: 1791500000000 },
      { id: 'tx_smb_13', bizId: 'biz_sembako', date: '2026-10-14', type: 'income', category: 'Penjualan', note: 'Penjualan Grosir Telur & Mi Instan', amount: 4800000, createdAt: 1792000000000 },
      { id: 'tx_smb_14', bizId: 'biz_sembako', date: '2026-10-19', type: 'expense', category: 'Operasional', note: 'Sewa Lapak & Token Listrik Toko', amount: 1200000, createdAt: 1792400000000 },
      { id: 'tx_smb_15', bizId: 'biz_sembako', date: '2026-10-24', type: 'income', category: 'Penjualan', note: 'Rekap Penjualan Kasir Toko Sembako', amount: 6900000, createdAt: 1792900000000 },
      { id: 'tx_smb_16', bizId: 'biz_sembako', date: '2026-10-27', type: 'expense', category: 'Operasional', note: 'Gaji Penjaga Toko Sembako', amount: 4000000, createdAt: 1793160000000 },

      // === BISNIS 3: Dapur Katering Mama (biz_katering) ===
      { id: 'tx_kat_01', bizId: 'biz_katering', date: '2026-05-12', type: 'income', category: 'Penjualan', note: 'Pesanan Nasi Kotak Arisan', amount: 6800000, createdAt: 1778500000000 },
      { id: 'tx_kat_02', bizId: 'biz_katering', date: '2026-05-19', type: 'expense', category: 'Bahan baku / kulakan', note: 'Belanja Daging Sapi & Bumbu', amount: 3200000, createdAt: 1779100000000 },
      { id: 'tx_kat_03', bizId: 'biz_katering', date: '2026-06-10', type: 'income', category: 'Penjualan', note: 'Katering Syukuran Kantor', amount: 7500000, createdAt: 1781200000000 },
      { id: 'tx_kat_04', bizId: 'biz_katering', date: '2026-06-18', type: 'expense', category: 'Bahan baku / kulakan', note: 'Belanja Ayam Potong & Sayur', amount: 3500000, createdAt: 1782000000000 },
      { id: 'tx_kat_05', bizId: 'biz_katering', date: '2026-07-11', type: 'income', category: 'Penjualan', note: 'Pesanan Snack Box Rapat', amount: 8000000, createdAt: 1783900000000 },
      { id: 'tx_kat_06', bizId: 'biz_katering', date: '2026-07-20', type: 'expense', category: 'Bahan baku / kulakan', note: 'Bahan Kue Basah & Kardus', amount: 3800000, createdAt: 1784700000000 },
      { id: 'tx_kat_07', bizId: 'biz_katering', date: '2026-08-08', type: 'income', category: 'Penjualan', note: 'Katering Prasmanan Pernikahan', amount: 8400000, createdAt: 1786300000000 },
      { id: 'tx_kat_08', bizId: 'biz_katering', date: '2026-08-20', type: 'expense', category: 'Bahan baku / kulakan', note: 'Belanja Bahan Baku Katering', amount: 4000000, createdAt: 1787200000000 },
      { id: 'tx_kat_09', bizId: 'biz_katering', date: '2026-09-10', type: 'income', category: 'Penjualan', note: 'Pesanan Nasi Tumpeng & Bento', amount: 8900000, createdAt: 1789100000000 },
      { id: 'tx_kat_10', bizId: 'biz_katering', date: '2026-09-22', type: 'expense', category: 'Bahan baku / kulakan', note: 'Bahan Masakan & Gas Elpiji', amount: 4200000, createdAt: 1790100000000 },
      { id: 'tx_kat_11', bizId: 'biz_katering', date: '2026-10-04', type: 'income', category: 'Penjualan', note: 'Pesanan 100 Box Nasi Kuning Kantor Dinas', amount: 2800000, createdAt: 1791100000000 },
      { id: 'tx_kat_12', bizId: 'biz_katering', date: '2026-10-09', type: 'expense', category: 'Bahan baku / kulakan', note: 'Belanja Daging Sapi, Ayam & Bumbu Pasar', amount: 1900000, createdAt: 1791600000000 },
      { id: 'tx_kat_13', bizId: 'biz_katering', date: '2026-10-15', type: 'income', category: 'Penjualan', note: 'Katering Prasmanan Acara Syukuran', amount: 4200000, createdAt: 1792100000000 },
      { id: 'tx_kat_14', bizId: 'biz_katering', date: '2026-10-21', type: 'expense', category: 'Operasional', note: 'Gas Elpiji 12kg & Wadah Thinwall', amount: 600000, createdAt: 1792600000000 },
      { id: 'tx_kat_15', bizId: 'biz_katering', date: '2026-10-25', type: 'income', category: 'Penjualan', note: 'Snack Box 150 Porsi Pengajian', amount: 2400000, createdAt: 1793000000000 },
      { id: 'tx_kat_16', bizId: 'biz_katering', date: '2026-10-27', type: 'expense', category: 'Operasional', note: 'Upah Asisten Masak Harian', amount: 1800000, createdAt: 1793170000000 }
    ];
  }

  function load() {
    state.readError = null;
    if (memoryFallback) return memoryFallback.slice();

    if (!storageAvailable()) {
      state.readError = 'unavailable';
      memoryFallback = getInitialSeed();
      return memoryFallback.slice();
    }

    var raw = global.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      // First boot: populate with realistic multi-business 6-month seed
      var seed = getInitialSeed();
      try {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      } catch (e) { /* ignore */ }
      return seed;
    }

    try {
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('not an array');
      var list = parsed.filter(isValidTx);

      // Ensure multi-business seed is populated if user only had the first seed
      var hasSembako = list.some(function (t) { return t.bizId === 'biz_sembako'; });
      if (!hasSembako) {
        var fullSeed = getInitialSeed();
        var extra = fullSeed.filter(function (s) { return s.bizId !== 'biz_kopi'; });
        list.forEach(function (t) { if (!t.bizId) t.bizId = 'biz_kopi'; });
        list = list.concat(extra);
        try {
          global.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch (e) { /* ignore */ }
      }
      return list;
    } catch (e) {
      state.readError = 'corrupt';
      return [];
    }
  }

  function save(list) {
    state.writeError = null;
    if (memoryFallback) {
      memoryFallback = list.slice();
      return true;
    }
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      state.writeError = e && e.name === 'QuotaExceededError' ? 'quota' : 'unknown';
      return false;
    }
  }

  function clearCorrupt() {
    try { global.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* abaikan */ }
    state.readError = null;
  }

  function newId() {
    return 'tx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function toISODate(d) {
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  // Urutan buku kas: tanggal naik, lalu waktu dicatat.
  function sortLedger(list) {
    return list.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }

  function formatRupiah(n) {
    return 'Rp ' + Math.abs(Math.round(n)).toLocaleString('id-ID');
  }

  global.UteraKas = {
    STORAGE_KEY: STORAGE_KEY,
    CATEGORIES: CATEGORIES,
    state: state,
    load: load,
    save: save,
    clearCorrupt: clearCorrupt,
    newId: newId,
    toISODate: toISODate,
    sortLedger: sortLedger,
    formatRupiah: formatRupiah
  };
})(window);
