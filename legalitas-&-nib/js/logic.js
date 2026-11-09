/**
 * UTERA · Legalitas & NIB
 * Business logic: status derivation, validation, formatting.
 * Pure functions only, no DOM and no storage, so the same rules can be
 * ported to the backend and unit tested in isolation.
 */
(function (global) {
  'use strict';

  const M = global.LegalitasModels;
  const DAY_MS = 24 * 60 * 60 * 1000;

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function parseDateOnly(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return date;
  }

  function daysUntil(value, today) {
    const target = parseDateOnly(value);
    if (!target) return null;
    return Math.round((startOfDay(target) - startOfDay(today)) / DAY_MS);
  }

  function getDocumentStatus(doc, today = new Date()) {
    if (!doc.berkas) return M.DOC_STATUS.BELUM_DIUNGGAH;
    if (doc.berlaku_hingga) {
      const days = daysUntil(doc.berlaku_hingga, today);
      if (days !== null && days < 0) return M.DOC_STATUS.KEDALUWARSA;
      if (days !== null && days <= M.EXPIRY_WARNING_DAYS) return M.DOC_STATUS.SEGERA_BERAKHIR;
    }
    return M.DOC_STATUS.DIUNGGAH;
  }

  /**
   * Derives the overall status. Order matters:
   * 1. no NIB recorded       -> belum_nib
   * 2. expired or expiring   -> perlu_diperbarui
   * 3. listed doc w/o file   -> belum_lengkap
   * 4. otherwise             -> lengkap
   * Official verification is reported separately and never changes this value.
   */
  function summarize(state, today = new Date()) {
    const docs = state.dokumen.map((d) => ({ doc: d, status: getDocumentStatus(d, today) }));
    const missing = docs.filter((x) => x.status === M.DOC_STATUS.BELUM_DIUNGGAH).map((x) => x.doc);
    const expired = docs.filter((x) => x.status === M.DOC_STATUS.KEDALUWARSA).map((x) => x.doc);
    const expiring = docs.filter((x) => x.status === M.DOC_STATUS.SEGERA_BERAKHIR).map((x) => x.doc);
    const uploaded = docs.length - missing.length;

    let status;
    if (!state.nib || !state.nib.nomor) status = M.LEGAL_STATUS.BELUM_NIB;
    else if (expired.length || expiring.length) status = M.LEGAL_STATUS.PERLU_DIPERBARUI;
    else if (missing.length) status = M.LEGAL_STATUS.BELUM_LENGKAP;
    else status = M.LEGAL_STATUS.LENGKAP;

    return {
      status,
      total: docs.length,
      uploaded,
      missing,
      expired,
      expiring,
      verification: M.VERIFICATION_STATUS.BELUM_TERSEDIA,
    };
  }

  /* ---------------- Validation ---------------- */

  function normalizeNib(value) {
    return String(value || '').replace(/[\s.-]/g, '');
  }

  function validateNib(input, today = new Date()) {
    const errors = {};
    const nomor = normalizeNib(input.nomor);
    if (!nomor) errors.nomor = 'Nomor NIB wajib diisi.';
    else if (!/^\d+$/.test(nomor)) errors.nomor = 'Nomor NIB hanya berisi angka.';
    else if (!M.NIB_PATTERN.test(nomor)) errors.nomor = `NIB terdiri dari 13 digit. Saat ini ${nomor.length} digit.`;

    if (!String(input.nama_usaha || '').trim()) errors.nama_usaha = 'Nama usaha wajib diisi.';
    else if (input.nama_usaha.trim().length > 100) errors.nama_usaha = 'Nama usaha maksimal 100 karakter.';

    if (String(input.penanggung_jawab || '').trim().length > 80) errors.penanggung_jawab = 'Maksimal 80 karakter.';

    const kbli = String(input.kbli || '').trim();
    if (kbli.length > 120) errors.kbli = 'Maksimal 120 karakter.';
    else if (/^\d/.test(kbli) && !/^\d{5}(\D|$)/.test(kbli)) errors.kbli = 'Kode KBLI terdiri dari 5 digit, contoh 56103.';

    if (!input.tanggal_terbit) errors.tanggal_terbit = 'Tanggal terbit wajib diisi.';
    else {
      const d = parseDateOnly(input.tanggal_terbit);
      if (!d) errors.tanggal_terbit = 'Format tanggal tidak valid.';
      else if (startOfDay(d) > startOfDay(today)) errors.tanggal_terbit = 'Tanggal terbit tidak boleh di masa depan.';
    }
    return { valid: Object.keys(errors).length === 0, errors, value: { ...input, nomor } };
  }

  function validateDocumentMeta(input) {
    const errors = {};
    if (input.nama !== undefined) {
      if (!String(input.nama).trim()) errors.nama = 'Nama dokumen wajib diisi.';
      else if (input.nama.trim().length > 80) errors.nama = 'Maksimal 80 karakter.';
    }
    if (String(input.nomor || '').length > 60) errors.nomor = 'Maksimal 60 karakter.';
    if (input.berlaku_hingga && !parseDateOnly(input.berlaku_hingga)) errors.berlaku_hingga = 'Format tanggal tidak valid.';
    return { valid: Object.keys(errors).length === 0, errors };
  }

  /** Front-end check only. The backend must repeat it, including content sniffing. */
  function validateFile(file) {
    if (!file) return 'Pilih berkas terlebih dahulu.';
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const typeOk = M.FILE_RULES.mimes.includes(file.type);
    const extOk = M.FILE_RULES.extensions.includes(ext);
    if (!typeOk || !extOk) return `Format .${ext || '?'} tidak didukung. Gunakan PDF, JPG, atau PNG.`;
    if (file.size === 0) return 'Berkas kosong. Pilih berkas lain.';
    if (file.size > M.FILE_RULES.maxBytes) return `Ukuran ${formatBytes(file.size)} melebihi batas 2 MB.`;
    return null;
  }

  /* ---------------- Formatting ---------------- */

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  function formatDate(value) {
    if (!value) return '';
    const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDateOnly(value) : new Date(value);
    if (!d || isNaN(d)) return '';
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }

  function formatNib(nomor) {
    const n = normalizeNib(nomor);
    return n.replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  function toDateInputValue(d) {
    const x = new Date(d);
    const mm = String(x.getMonth() + 1).padStart(2, '0');
    const dd = String(x.getDate()).padStart(2, '0');
    return `${x.getFullYear()}-${mm}-${dd}`;
  }

  global.LegalitasLogic = Object.freeze({
    parseDateOnly,
    daysUntil,
    getDocumentStatus,
    summarize,
    normalizeNib,
    validateNib,
    validateDocumentMeta,
    validateFile,
    formatDate,
    formatBytes,
    formatNib,
    toDateInputValue,
  });
})(window);

