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

  function load() {
    state.readError = null;
    if (memoryFallback) return memoryFallback.slice();

    if (!storageAvailable()) {
      state.readError = 'unavailable';
      memoryFallback = [];
      return [];
    }

    var raw = global.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

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
