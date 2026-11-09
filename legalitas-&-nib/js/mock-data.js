/**
 * UTERA · Legalitas & NIB
 * Mock data for UI preview and testing. Not real user data.
 *
 * Every scenario is built relative to "today" so expiry states stay correct
 * whenever the page is opened. Values are deliberately labelled as examples.
 */
(function (global) {
  'use strict';

  const M = global.LegalitasModels;
  const L = global.LegalitasLogic;

  const SAMPLE_PROFILE = Object.freeze({
    nama_usaha: 'Usaha Contoh',
    nama_pemilik: 'Pemilik Contoh',
  });

  function shiftDays(today, days) {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d;
  }

  function sampleFile(name, type, size, uploadedDaysAgo, today) {
    return {
      id: 'contoh_' + name,
      nama: name,
      tipe: type,
      ukuran: size,
      diunggah_pada: shiftDays(today, -uploadedDaysAgo).toISOString(),
      contoh: true,
    };
  }

  function sampleNib(today) {
    return M.createNib({
      nomor: '1234567890123',
      nama_usaha: SAMPLE_PROFILE.nama_usaha,
      penanggung_jawab: SAMPLE_PROFILE.nama_pemilik,
      kbli: '56103 Kedai Makanan',
      tanggal_terbit: L.toDateInputValue(shiftDays(today, -420)),
    });
  }

  function doc(kategori, overrides) {
    return Object.assign(M.createDocument(kategori, overrides && overrides.nama), overrides || {});
  }

  const scenarios = {
    'belum-nib': {
      label: 'Contoh: belum punya NIB',
      build() {
        return M.createEmptyState();
      },
    },

    'belum-lengkap': {
      label: 'Contoh: dokumen belum lengkap',
      build(today) {
        const s = M.createEmptyState();
        s.nib = sampleNib(today);
        s.dokumen = [
          doc('nib', { berkas: sampleFile('contoh-nib.pdf', 'application/pdf', 248000, 12, today) }),
          doc('npwp'),
          doc('pirt'),
        ];
        return s;
      },
    },

    lengkap: {
      label: 'Contoh: lengkap',
      build(today) {
        const s = M.createEmptyState();
        s.nib = sampleNib(today);
        s.dokumen = [
          doc('nib', { berkas: sampleFile('contoh-nib.pdf', 'application/pdf', 248000, 40, today) }),
          doc('npwp', { berkas: sampleFile('contoh-npwp.jpg', 'image/jpeg', 412000, 38, today) }),
          doc('halal', {
            berlaku_hingga: L.toDateInputValue(shiftDays(today, 900)),
            berkas: sampleFile('contoh-sertifikat-halal.pdf', 'application/pdf', 530000, 30, today),
          }),
        ];
        return s;
      },
    },

    'perlu-diperbarui': {
      label: 'Contoh: perlu diperbarui',
      build(today) {
        const s = M.createEmptyState();
        s.nib = sampleNib(today);
        s.dokumen = [
          doc('nib', { berkas: sampleFile('contoh-nib.pdf', 'application/pdf', 248000, 200, today) }),
          doc('pirt', {
            nomor: 'Contoh-PIRT-001',
            berlaku_hingga: L.toDateInputValue(shiftDays(today, -6)),
            berkas: sampleFile('contoh-pirt.png', 'image/png', 690000, 400, today),
          }),
          doc('halal', {
            berlaku_hingga: L.toDateInputValue(shiftDays(today, 18)),
            berkas: sampleFile('contoh-sertifikat-halal.pdf', 'application/pdf', 530000, 300, today),
          }),
        ];
        return s;
      },
    },
  };

  global.LegalitasMock = Object.freeze({ SAMPLE_PROFILE, scenarios });
})(window);

