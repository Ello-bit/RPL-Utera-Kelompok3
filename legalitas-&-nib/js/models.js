/**
 * UTERA · Legalitas & NIB
 * Data models and constants.
 *
 * The shapes here are the contract the future backend is expected to honour.
 * See ../README.md for the field-by-field description.
 */
(function (global) {
  'use strict';

  /** Overall legal status shown on the main page. Never includes "verified". */
  const LEGAL_STATUS = Object.freeze({
    BELUM_NIB: 'belum_nib',
    BELUM_LENGKAP: 'belum_lengkap',
    LENGKAP: 'lengkap',
    PERLU_DIPERBARUI: 'perlu_diperbarui',
  });

  /** Per-document status. Describes completeness and validity only. */
  const DOC_STATUS = Object.freeze({
    BELUM_DIUNGGAH: 'belum_diunggah',
    DIUNGGAH: 'diunggah',
    SEGERA_BERAKHIR: 'segera_berakhir',
    KEDALUWARSA: 'kedaluwarsa',
  });

  /**
   * Official verification is a separate axis from completeness and validity.
   * UTERA has no integration with issuing agencies yet, so this is the only value.
   */
  const VERIFICATION_STATUS = Object.freeze({
    BELUM_TERSEDIA: 'belum_tersedia',
  });

  const DOC_CATEGORIES = Object.freeze([
    { id: 'nib', label: 'NIB', fullLabel: 'Nomor Induk Berusaha (NIB)', hint: 'Diterbitkan melalui portal OSS', removable: false, hasExpiry: false, single: true },
    { id: 'npwp', label: 'NPWP', fullLabel: 'NPWP', hint: 'Nomor Pokok Wajib Pajak usaha atau pemilik', removable: true, hasExpiry: false, single: true },
    { id: 'halal', label: 'Sertifikat Halal', fullLabel: 'Sertifikat Halal', hint: 'Untuk produk makanan dan minuman', removable: true, hasExpiry: true, single: true },
    { id: 'pirt', label: 'PIRT / Izin Edar', fullLabel: 'PIRT atau Izin Edar', hint: 'Untuk produk pangan olahan', removable: true, hasExpiry: true, single: true },
    { id: 'lainnya', label: 'Dokumen lainnya', fullLabel: 'Dokumen lainnya', hint: 'Sertifikat atau dokumen pendukung', removable: true, hasExpiry: true, single: false },
  ]);

  const FILE_RULES = Object.freeze({
    maxBytes: 2 * 1024 * 1024,
    mimes: ['application/pdf', 'image/jpeg', 'image/png'],
    extensions: ['pdf', 'jpg', 'jpeg', 'png'],
    acceptAttr: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png',
  });

  /** A document expiring within this many days is flagged "segera berakhir". */
  const EXPIRY_WARNING_DAYS = 30;

  /** NIB issued by OSS is a 13 digit number. */
  const NIB_PATTERN = /^\d{13}$/;

  const SCHEMA_VERSION = 1;

  function getCategory(id) {
    return DOC_CATEGORIES.find((c) => c.id === id) || DOC_CATEGORIES[DOC_CATEGORIES.length - 1];
  }

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /**
   * @typedef {Object} FileMeta
   * @property {string} id            Storage key of the binary (IndexedDB now, object storage later)
   * @property {string} nama          Original file name
   * @property {string} tipe          MIME type
   * @property {number} ukuran        Size in bytes
   * @property {string} diunggah_pada ISO timestamp
   * @property {boolean} [contoh]     True for mock files that have no real content
   */

  /**
   * @typedef {Object} LegalDocument
   * @property {string} id
   * @property {string} kategori        One of DOC_CATEGORIES ids
   * @property {string} nama            Display name
   * @property {string} nomor           Optional document number
   * @property {string|null} berlaku_hingga  YYYY-MM-DD or null when there is no expiry
   * @property {FileMeta|null} berkas
   * @property {string} verifikasi      VERIFICATION_STATUS value
   * @property {string} dibuat_pada
   * @property {string} diperbarui_pada
   */
  function createDocument(kategori, nama) {
    const cat = getCategory(kategori);
    const now = new Date().toISOString();
    return {
      id: kategori === 'nib' ? 'doc_nib' : uid('doc'),
      kategori: cat.id,
      nama: (nama && nama.trim()) || cat.label,
      nomor: '',
      berlaku_hingga: null,
      berkas: null,
      verifikasi: VERIFICATION_STATUS.BELUM_TERSEDIA,
      dibuat_pada: now,
      diperbarui_pada: now,
    };
  }

  /**
   * @typedef {Object} NibInfo
   * @property {string} nomor
   * @property {string} nama_usaha
   * @property {string} penanggung_jawab
   * @property {string} kbli
   * @property {string} tanggal_terbit  YYYY-MM-DD
   * @property {string} dibuat_pada
   * @property {string} diperbarui_pada
   */
  function createNib(fields) {
    const now = new Date().toISOString();
    return {
      nomor: fields.nomor || '',
      nama_usaha: fields.nama_usaha || '',
      penanggung_jawab: fields.penanggung_jawab || '',
      kbli: fields.kbli || '',
      tanggal_terbit: fields.tanggal_terbit || '',
      dibuat_pada: fields.dibuat_pada || now,
      diperbarui_pada: now,
    };
  }

  /**
   * @typedef {Object} LegalitasState
   * @property {number} schema_version
   * @property {NibInfo|null} nib
   * @property {LegalDocument[]} dokumen
   * @property {string|null} diperbarui_pada
   */
  function createEmptyState() {
    return {
      schema_version: SCHEMA_VERSION,
      nib: null,
      dokumen: [createDocument('nib')],
      diperbarui_pada: null,
    };
  }

  function createInitialCompleteState(namaUsaha, namaPemilik) {
    const now = new Date().toISOString();
    const businessName = namaUsaha || 'Kopi Nusantara';
    const ownerName = namaPemilik || 'Budi Santoso';

    return {
      schema_version: SCHEMA_VERSION,
      nib: {
        nomor: '1234567890123',
        nama_usaha: businessName,
        penanggung_jawab: ownerName,
        kbli: '56103 Kedai Makanan & Minuman',
        tanggal_terbit: '2024-05-15',
        dibuat_pada: now,
        diperbarui_pada: now,
      },
      dokumen: [
        {
          id: 'doc_nib',
          kategori: 'nib',
          nama: 'Nomor Induk Berusaha (NIB)',
          nomor: '1234567890123',
          berlaku_hingga: null,
          berkas: {
            id: 'contoh_nib.pdf',
            nama: 'Dokumen-NIB-Resmi.pdf',
            tipe: 'application/pdf',
            ukuran: 248000,
            diunggah_pada: '2024-05-16T10:00:00.000Z',
            contoh: true,
          },
          verifikasi: VERIFICATION_STATUS.BELUM_TERSEDIA,
          dibuat_pada: now,
          diperbarui_pada: now,
        },
        {
          id: 'doc_npwp',
          kategori: 'npwp',
          nama: 'NPWP Usaha',
          nomor: '84.123.456.7-123.000',
          berlaku_hingga: null,
          berkas: {
            id: 'contoh_npwp.jpg',
            nama: 'Kartu-NPWP.jpg',
            tipe: 'image/jpeg',
            ukuran: 382000,
            diunggah_pada: '2024-05-18T14:30:00.000Z',
            contoh: true,
          },
          verifikasi: VERIFICATION_STATUS.BELUM_TERSEDIA,
          dibuat_pada: now,
          diperbarui_pada: now,
        },
        {
          id: 'doc_halal',
          kategori: 'halal',
          nama: 'Sertifikat Halal BPJPH',
          nomor: 'ID3211000123456',
          berlaku_hingga: '2028-10-20',
          berkas: {
            id: 'contoh_halal.pdf',
            nama: 'Sertifikat-Halal-BPJPH.pdf',
            tipe: 'application/pdf',
            ukuran: 520000,
            diunggah_pada: '2024-06-01T09:15:00.000Z',
            contoh: true,
          },
          verifikasi: VERIFICATION_STATUS.BELUM_TERSEDIA,
          dibuat_pada: now,
          diperbarui_pada: now,
        },
        {
          id: 'doc_pirt',
          kategori: 'pirt',
          nama: 'PIRT / Izin Edar Dinas Kesehatan',
          nomor: 'P-IRT 2063204010123-28',
          berlaku_hingga: '2027-06-15',
          berkas: {
            id: 'contoh_pirt.png',
            nama: 'Izin-Edar-PIRT.png',
            tipe: 'image/png',
            ukuran: 410000,
            diunggah_pada: '2024-06-10T11:20:00.000Z',
            contoh: true,
          },
          verifikasi: VERIFICATION_STATUS.BELUM_TERSEDIA,
          dibuat_pada: now,
          diperbarui_pada: now,
        }
      ],
      diperbarui_pada: now,
    };
  }

  global.LegalitasModels = Object.freeze({
    LEGAL_STATUS,
    DOC_STATUS,
    VERIFICATION_STATUS,
    DOC_CATEGORIES,
    FILE_RULES,
    EXPIRY_WARNING_DAYS,
    NIB_PATTERN,
    SCHEMA_VERSION,
    getCategory,
    uid,
    createDocument,
    createNib,
    createEmptyState,
    createInitialCompleteState,
  });
})(window);

