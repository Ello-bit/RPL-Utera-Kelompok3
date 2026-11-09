/**
 * UTERA · Legalitas & NIB
 * Service layer. The UI talks only to this module.
 *
 * Today it persists on the device:
 *   - "pengguna" source: localStorage (metadata) + IndexedDB (file binaries)
 *   - demo scenarios:    sessionStorage (metadata) + in-memory Map (file binaries)
 *
 * Every public method is async and returns plain objects so it can later be
 * swapped for fetch() calls without touching the UI. The intended endpoint is
 * noted above each method. Nothing here is sent to a server.
 */
(function (global) {
  'use strict';

  const M = global.LegalitasModels;
  const L = global.LegalitasLogic;
  const Mock = global.LegalitasMock;

  const USER_SOURCE = 'pengguna';
  const KEY_USER_STATE = 'utera.legalitas.v1';
  const KEY_DEMO_PREFIX = 'utera.legalitas.demo.';
  const KEY_SOURCE = 'utera.legalitas.source';
  const KEY_PROFILE = 'utera_profil_usaha';
  const IDB_NAME = 'utera-legalitas';
  const IDB_STORE = 'berkas';
  const LATENCY_MS = 280;

  const memoryBlobs = new Map();
  const memoryStore = {};
  let source = USER_SOURCE;

  function safeStorage(type) {
    try {
      if (typeof window !== 'undefined' && window[type]) {
        const s = window[type];
        const t = '__utera_test__';
        s.setItem(t, t);
        s.removeItem(t);
        return s;
      }
    } catch (e) { /* storage restricted/blocked, use memory fallback */ }
    return {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(memoryStore, k) ? memoryStore[k] : null),
      setItem: (k, v) => { memoryStore[k] = String(v); },
      removeItem: (k) => { delete memoryStore[k]; },
    };
  }

  function delay(ms = 0) {
    return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readSource() {
    try {
      const saved = safeStorage('sessionStorage').getItem(KEY_SOURCE);
      if (saved && (saved === USER_SOURCE || Mock.scenarios[saved])) return saved;
    } catch (e) { /* storage unavailable: fall back to default */ }
    return USER_SOURCE;
  }

  source = readSource();

  function isDemo() {
    return source !== USER_SOURCE;
  }

  /* ---------------- IndexedDB (binary files, user source only) ---------------- */

  let dbPromise = null;
  function openDb() {
    if (!('indexedDB' in global)) return Promise.reject(new Error('IndexedDB tidak tersedia'));
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  function idb(mode, fn) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, mode);
      const store = tx.objectStore(IDB_STORE);
      const req = fn(store);
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
    }));
  }

  async function putBlob(id, blob) {
    if (isDemo()) { memoryBlobs.set(id, blob); return; }
    try {
      await idb('readwrite', (s) => s.put(blob, id));
    } catch (e) {
      memoryBlobs.set(id, blob);
    }
  }

  async function getBlob(id) {
    if (memoryBlobs.has(id)) return memoryBlobs.get(id);
    if (isDemo()) return null;
    try { return (await idb('readonly', (s) => s.get(id))) || null; } catch (e) { return null; }
  }

  async function deleteBlob(id) {
    memoryBlobs.delete(id);
    if (isDemo()) return;
    try { await idb('readwrite', (s) => s.delete(id)); } catch (e) { /* nothing to clean */ }
  }

  /* ---------------- State persistence ---------------- */

  function stateKey() {
    return isDemo() ? KEY_DEMO_PREFIX + source : KEY_USER_STATE;
  }

  function storageFor() {
    return safeStorage(isDemo() ? 'sessionStorage' : 'localStorage');
  }

  function readState() {
    try {
      const raw = storageFor().getItem(stateKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.schema_version === M.SCHEMA_VERSION && Array.isArray(parsed.dokumen) && parsed.nib) {
          return parsed;
        }
      }
    } catch (e) { /* recreate fresh */ }

    const prof = readProfiles()[0];
    const namaUsaha = (prof && prof.nama_usaha) || 'Kopi Nusantara';
    const namaPemilik = (prof && prof.nama_pemilik) || 'Budi Santoso';

    const fresh = isDemo()
      ? Mock.scenarios[source].build(new Date())
      : M.createInitialCompleteState(namaUsaha, namaPemilik);
    writeState(fresh);
    return fresh;
  }

  function writeState(state) {
    state.diperbarui_pada = new Date().toISOString();
    try {
      storageFor().setItem(stateKey(), JSON.stringify(state));
    } catch (e) {
      memoryStore[stateKey()] = JSON.stringify(state);
    }
  }

  function findDoc(state, docId) {
    const d = state.dokumen.find((x) => x.id === docId);
    if (!d) throw new Error('Dokumen tidak ditemukan.');
    return d;
  }

  /* ---------------- Profil Usaha bridge ---------------- */

  function readProfiles() {
    try {
      const raw = localStorage.getItem(KEY_PROFILE);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') return [parsed];
    } catch (e) { /* unreadable profile is treated as missing */ }
    return [];
  }

  /** Keeps Profil Usaha's NIB toggle in step with this page (user source only). */
  function syncNibToProfile(nomor) {
    if (isDemo()) return;
    const profiles = readProfiles();
    if (!profiles.length) return;
    profiles[0].nib = { punya: Boolean(nomor), nomor: nomor || '' };
    profiles[0].updated_at = new Date().toISOString();
    try { localStorage.setItem(KEY_PROFILE, JSON.stringify(profiles)); } catch (e) { /* non-critical */ }
  }

  /* ---------------- Public API ---------------- */

  const Service = {
    USER_SOURCE,

    listSources() {
      return [{ id: USER_SOURCE, label: 'Data saya (perangkat ini)' }]
        .concat(Object.keys(Mock.scenarios).map((id) => ({ id, label: Mock.scenarios[id].label })));
    },

    getSource() { return source; },
    isDemo,

    setSource(id) {
      if (id !== USER_SOURCE && !Mock.scenarios[id]) throw new Error('Skenario tidak dikenal.');
      source = id;
      try { sessionStorage.setItem(KEY_SOURCE, id); } catch (e) { /* session only */ }
    },

    /** Business identity reused from Profil Usaha, so the form never asks twice. */
    getProfile() {
      if (isDemo()) return { ...Mock.SAMPLE_PROFILE, contoh: true };
      const p = readProfiles()[0];
      if (!p) return null;
      return {
        nama_usaha: p.nama_usaha || '',
        nama_pemilik: p.nama_pemilik || '',
        nib_nomor: (p.nib && p.nib.nomor) || '',
      };
    },

    // Backend: GET /api/legalitas
    async load() {
      await delay();
      return clone(readState());
    },

    // Backend: PUT /api/legalitas/nib
    async saveNib(input) {
      await delay();
      const check = L.validateNib(input);
      if (!check.valid) {
        const err = new Error('Periksa kembali isian NIB.');
        err.fields = check.errors;
        throw err;
      }
      const state = readState();
      const prev = state.nib;
      state.nib = M.createNib({
        nomor: check.value.nomor,
        nama_usaha: input.nama_usaha.trim(),
        penanggung_jawab: (input.penanggung_jawab || '').trim(),
        kbli: (input.kbli || '').trim(),
        tanggal_terbit: input.tanggal_terbit,
        dibuat_pada: prev ? prev.dibuat_pada : undefined,
      });
      const nibDoc = state.dokumen.find((d) => d.kategori === 'nib');
      if (nibDoc) { nibDoc.nomor = check.value.nomor; nibDoc.diperbarui_pada = state.nib.diperbarui_pada; }
      writeState(state);
      syncNibToProfile(check.value.nomor);
      return clone(state);
    },

    // Backend: POST /api/legalitas/dokumen
    async addDocument(kategori, nama) {
      await delay(160);
      const state = readState();
      const cat = M.getCategory(kategori);
      if (cat.single && state.dokumen.some((d) => d.kategori === cat.id)) {
        throw new Error(`${cat.label} sudah ada di daftar.`);
      }
      if (cat.id === 'lainnya') {
        const check = L.validateDocumentMeta({ nama: nama || '' });
        if (!check.valid) { const err = new Error(check.errors.nama); err.fields = check.errors; throw err; }
      }
      const doc = M.createDocument(cat.id, nama);
      state.dokumen.push(doc);
      writeState(state);
      return { state: clone(state), docId: doc.id };
    },

    // Backend: PATCH /api/legalitas/dokumen/:id
    async updateDocumentMeta(docId, input) {
      await delay(200);
      const check = L.validateDocumentMeta(input);
      if (!check.valid) { const err = new Error('Periksa kembali isian dokumen.'); err.fields = check.errors; throw err; }
      const state = readState();
      const doc = findDoc(state, docId);
      if (input.nama !== undefined && doc.kategori === 'lainnya') doc.nama = input.nama.trim();
      doc.nomor = (input.nomor || '').trim();
      doc.berlaku_hingga = input.berlaku_hingga || null;
      doc.diperbarui_pada = new Date().toISOString();
      writeState(state);
      return clone(state);
    },

    // Backend: POST /api/legalitas/dokumen/:id/berkas (multipart). Server must re-validate type, size and content.
    async uploadFile(docId, file, onProgress) {
      const error = L.validateFile(file);
      if (error) throw new Error(error);
      for (let p = 15; p < 100; p += 17) {
        await delay(70);
        if (onProgress) onProgress(p);
      }
      const state = readState();
      const doc = findDoc(state, docId);
      const old = doc.berkas;
      const meta = {
        id: M.uid('file'),
        nama: file.name,
        tipe: file.type,
        ukuran: file.size,
        diunggah_pada: new Date().toISOString(),
      };
      await putBlob(meta.id, file);
      doc.berkas = meta;
      doc.diperbarui_pada = meta.diunggah_pada;
      writeState(state);
      if (old && !old.contoh) await deleteBlob(old.id);
      if (onProgress) onProgress(100);
      return clone(state);
    },

    // Backend: DELETE /api/legalitas/dokumen/:id/berkas
    async removeFile(docId) {
      await delay(200);
      const state = readState();
      const doc = findDoc(state, docId);
      const old = doc.berkas;
      doc.berkas = null;
      doc.diperbarui_pada = new Date().toISOString();
      writeState(state);
      if (old && !old.contoh) await deleteBlob(old.id);
      return clone(state);
    },

    // Backend: DELETE /api/legalitas/dokumen/:id
    async removeDocument(docId) {
      await delay(200);
      const state = readState();
      const doc = findDoc(state, docId);
      if (!M.getCategory(doc.kategori).removable) throw new Error('Dokumen NIB tidak dapat dihapus dari daftar.');
      state.dokumen = state.dokumen.filter((d) => d.id !== docId);
      writeState(state);
      if (doc.berkas && !doc.berkas.contoh) await deleteBlob(doc.berkas.id);
      return clone(state);
    },

    // Backend: GET /api/legalitas/dokumen/:id/berkas (signed URL, owner only)
    async getFile(docId) {
      const state = readState();
      const doc = findDoc(state, docId);
      if (!doc.berkas) return null;
      if (doc.berkas.contoh) {
        const text = `Berkas contoh untuk simulasi UTERA.\nDokumen: ${doc.nama}\nBerkas ini tidak memiliki isi asli.`;
        return { meta: doc.berkas, blob: new Blob([text], { type: 'text/plain' }), contoh: true };
      }
      const blob = await getBlob(doc.berkas.id);
      return { meta: doc.berkas, blob, contoh: false };
    },

    /** Resets the active source: clears user data, or restores the scenario to its original mock. */
    async reset() {
      await delay(160);
      if (!isDemo()) {
        const state = (() => { try { return readState(); } catch (e) { return null; } })();
        if (state) {
          for (const d of state.dokumen) if (d.berkas && !d.berkas.contoh) await deleteBlob(d.berkas.id);
        }
      }
      storageFor().removeItem(stateKey());
      return clone(readState());
    },
  };

  global.LegalitasService = Service;
})(window);
