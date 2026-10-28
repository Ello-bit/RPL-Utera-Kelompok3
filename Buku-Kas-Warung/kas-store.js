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
      { id: 'tx_seed_01', date: '2026-05-08', type: 'income', category: 'Penjualan', note: 'Rekap Penjualan Kopi & Toast', amount: 18200000, createdAt: 1778200000000 },
      { id: 'tx_seed_02', date: '2026-05-15', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Biji Kopi & Susu', amount: 6100000, createdAt: 1778800000000 },
      { id: 'tx_seed_03', date: '2026-05-25', type: 'expense', category: 'Operasional', note: 'Listrik & Gas Elpiji', amount: 2000000, createdAt: 1779600000000 },
      { id: 'tx_seed_04', date: '2026-06-05', type: 'income', category: 'Penjualan', note: 'Rekap Shift Kasir Warung', amount: 19500000, createdAt: 1780800000000 },
      { id: 'tx_seed_05', date: '2026-06-12', type: 'expense', category: 'Bahan baku / kulakan', note: 'Bahan Makanan & Sirup', amount: 6400000, createdAt: 1781400000000 },
      { id: 'tx_seed_06', date: '2026-06-28', type: 'expense', category: 'Operasional', note: 'Sewa Tempat & Listrik', amount: 2000000, createdAt: 1782700000000 },
      { id: 'tx_seed_07', date: '2026-07-06', type: 'income', category: 'Penjualan', note: 'Penjualan Minuman & Camilan', amount: 20400000, createdAt: 1783400000000 },
      { id: 'tx_seed_08', date: '2026-07-14', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Biji Kopi Robusta', amount: 6800000, createdAt: 1784100000000 },
      { id: 'tx_seed_09', date: '2026-07-27', type: 'expense', category: 'Operasional', note: 'Listrik & Kebersihan', amount: 2000000, createdAt: 1785200000000 },
      { id: 'tx_seed_10', date: '2026-08-04', type: 'income', category: 'Penjualan', note: 'Omzet Harian & Acara Komunitas', amount: 21800000, createdAt: 1785900000000 },
      { id: 'tx_seed_11', date: '2026-08-16', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Kemasan & Cup Kopi', amount: 5500000, createdAt: 1786900000000 },
      { id: 'tx_seed_12', date: '2026-08-28', type: 'expense', category: 'Operasional', note: 'Listrik & Perawatan Mesin Kopi', amount: 2000000, createdAt: 1787900000000 },
      { id: 'tx_seed_13', date: '2026-09-05', type: 'income', category: 'Penjualan', note: 'Rekap Penjualan Kopi Nusantara', amount: 22100000, createdAt: 1788600000000 },
      { id: 'tx_seed_14', date: '2026-09-15', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Bahan Baku Bulanan', amount: 5900000, createdAt: 1789500000000 },
      { id: 'tx_seed_15', date: '2026-09-29', type: 'expense', category: 'Operasional', note: 'Listrik PLN & Internet', amount: 2000000, createdAt: 1790700000000 },
      { id: 'tx_seed_16', date: '2026-10-02', type: 'income', category: 'Penjualan', note: 'Rekap Kasir Awal Bulan', amount: 4500000, createdAt: 1790900000000 },
      { id: 'tx_seed_17', date: '2026-10-06', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Susu UHT & Gula Aren', amount: 1850000, createdAt: 1791300000000 },
      { id: 'tx_seed_18', date: '2026-10-12', type: 'income', category: 'Penjualan', note: 'Pesanan Katering Kopi 50 Cup', amount: 2800000, createdAt: 1791800000000 },
      { id: 'tx_seed_19', date: '2026-10-18', type: 'expense', category: 'Operasional', note: 'Token Listrik & Gas', amount: 950000, createdAt: 1792300000000 },
      { id: 'tx_seed_20', date: '2026-10-22', type: 'income', category: 'Penjualan', note: 'Penjualan Shift Siang & Malam', amount: 3200000, createdAt: 1792700000000 },
      { id: 'tx_seed_21', date: '2026-10-26', type: 'expense', category: 'Bahan baku / kulakan', note: 'Kulakan Biji Kopi Espresso', amount: 1600000, createdAt: 1793000000000 },
      { id: 'tx_seed_22', date: '2026-10-27', type: 'income', category: 'Penjualan', note: 'Rekap Penjualan Akhir Pekan', amount: 14350000, createdAt: 1793100000000 },
      { id: 'tx_seed_23', date: '2026-10-27', type: 'expense', category: 'Operasional', note: 'Gaji Karyawan Shift Part-time', amount: 2000000, createdAt: 1793150000000 }
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
      // First boot: populate with realistic 6-month seed
      var seed = getInitialSeed();
      try {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      } catch (e) { /* ignore */ }
      return seed;
    }

    try {
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('not an array');
      return parsed.filter(isValidTx);
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
