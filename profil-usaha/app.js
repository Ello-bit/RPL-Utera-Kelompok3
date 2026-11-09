/**
 * UTERA — Profil Usaha (F3, F14 PRD)
 * Vanilla JS: LocalStorage, KUR eligibility, legalitas toggles,
 * multi-profil switcher, kelengkapan profil, PDF export.
 */

'use strict';

/* ============================================================
   CONSTANTS & CONFIG
   ============================================================ */
const STORAGE_KEY = 'utera_profil_usaha';
const KUR_MIN_MONTHS = 6;

const JENIS_USAHA_OPTIONS = [
  { value: '', label: '-- Pilih Jenis Usaha --' },
  { value: 'kuliner', label: 'Kuliner & Makanan' },
  { value: 'retail', label: 'Retail & Toko' },
  { value: 'jasa', label: 'Jasa & Servis' },
  { value: 'kerajinan', label: 'Kerajinan Tangan' },
  { value: 'katering', label: 'Katering' },
  { value: 'perdagangan', label: 'Perdagangan Umum' },
  { value: 'pertanian', label: 'Pertanian & Hortikultura' },
  { value: 'perikanan', label: 'Perikanan & Budidaya' },
  { value: 'peternakan', label: 'Peternakan' },
  { value: 'teknologi', label: 'Teknologi & Digital' },
  { value: 'pendidikan', label: 'Pendidikan & Pelatihan' },
  { value: 'kesehatan', label: 'Kesehatan & Kecantikan' },
  { value: 'transportasi', label: 'Transportasi & Logistik' },
  { value: 'properti', label: 'Properti & Konstruksi' },
  { value: 'lainnya', label: 'Lainnya' },
];

const EMPTY_PROFILE = {
  id: null,
  nama_usaha: '',
  nama_pemilik: '',
  jenis_usaha: '',
  tanggal_mulai_usaha: '',
  alamat_usaha: '',
  nomor_telepon: '',
  deskripsi_usaha: '',
  nib: { punya: false, nomor: '' },
  npwp: { punya: false, nomor: '' },
  sku: { punya: false, nomor: '' },
  created_at: null,
  updated_at: null,
};

/* ============================================================
   STATE
   ============================================================ */
let profiles = [];    // array of profile objects
let activeIdx = 0;   // index of active profile

/* ============================================================
   UTILS
   ============================================================ */
function uid() {
  return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function monthDiff(startDate) {
  if (!startDate) return null;
  const start = new Date(startDate);
  if (isNaN(start)) return null;
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return Math.max(0, months);
}

function formatDuration(months) {
  if (months === null) return '—';
  if (months < 1) return 'Kurang dari 1 bulan';
  if (months < 12) return `${months} bulan`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y} tahun ${m} bulan` : `${y} tahun`;
}

function getInitials(name) {
  if (!name) return 'U';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function getJenisLabel(value) {
  const opt = JENIS_USAHA_OPTIONS.find(o => o.value === value);
  return opt ? opt.label : 'Belum dipilih';
}

function cloneProfile(p) {
  return JSON.parse(JSON.stringify(p));
}

/* ============================================================
   STORAGE
   ============================================================ */
function loadProfiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        profiles = parsed;
        activeIdx = 0;
        return;
      }
      // legacy single object
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        profiles = [{ ...EMPTY_PROFILE, ...parsed, id: parsed.id || uid() }];
        activeIdx = 0;
        return;
      }
    }
  } catch (e) {
    console.error('loadProfiles error:', e);
  }
  // No data — start with one blank profile
  profiles = [{ ...cloneProfile(EMPTY_PROFILE), id: uid() }];
  activeIdx = 0;
}

function saveProfiles() {
  try {
    const now = new Date().toISOString();
    profiles[activeIdx].updated_at = now;
    if (!profiles[activeIdx].created_at) profiles[activeIdx].created_at = now;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    // Also broadcast business name for other modules
    if (profiles[activeIdx].nama_usaha) {
      localStorage.setItem('utera_nama_usaha', profiles[activeIdx].nama_usaha);
    }
    if (profiles[activeIdx].nama_pemilik) {
      localStorage.setItem('utera_user_name', profiles[activeIdx].nama_pemilik);
    }
    // Sync to Supabase Cloud in background
    syncToSupabase(profiles[activeIdx]);
  } catch (e) {
    console.error('saveProfiles error:', e);
  }
}

/* ============================================================
   SUPABASE CLOUD SYNC
   ============================================================ */
async function syncToSupabase(p) {
  if (!window.uteraSupabase) return;
  try {
    const payload = {
      nama_usaha: p.nama_usaha || 'Tanpa Nama',
      nama_pemilik: p.nama_pemilik || null,
      jenis_usaha: p.jenis_usaha || null,
      tanggal_mulai_usaha: p.tanggal_mulai_usaha || null,
      alamat_usaha: p.alamat_usaha || null,
      nomor_telepon: p.nomor_telepon || null,
      deskripsi_usaha: p.deskripsi_usaha || null,
      updated_at: new Date().toISOString()
    };
    if (p.supabase_id) {
      await window.uteraSupabase.from('profil_usaha').update(payload).eq('id', p.supabase_id);
    } else {
      const { data, error } = await window.uteraSupabase.from('profil_usaha').insert([payload]).select('id');
      if (data && data[0]) {
        p.supabase_id = data[0].id;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
      }
    }
    console.log('☁️ Tersinkronisasi ke Supabase Cloud.');
  } catch (err) {
    console.warn('Sync to Supabase warning:', err);
  }
}

async function fetchFromSupabase() {
  if (!window.uteraSupabase) return;
  try {
    const { data, error } = await window.uteraSupabase.from('profil_usaha').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    if (data && data.length > 0) {
      const cloudProfiles = data.map(item => ({
        ...cloneProfile(EMPTY_PROFILE),
        supabase_id: item.id,
        nama_usaha: item.nama_usaha || '',
        nama_pemilik: item.nama_pemilik || '',
        jenis_usaha: item.jenis_usaha || '',
        tanggal_mulai_usaha: item.tanggal_mulai_usaha || '',
        alamat_usaha: item.alamat_usaha || '',
        nomor_telepon: item.nomor_telepon || '',
        deskripsi_usaha: item.deskripsi_usaha || '',
        created_at: item.created_at,
        updated_at: item.updated_at
      }));
      profiles = cloudProfiles;
      activeIdx = 0;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
      buildSwitcher();
      renderForm();
      console.log('☁️ Data profil dimuat dari Supabase Cloud.');
    }
  } catch (err) {
    console.warn('Fetch from Supabase warning:', err);
  }
}

function getActive() {
  return profiles[activeIdx] || { ...cloneProfile(EMPTY_PROFILE) };
}

/* ============================================================
   DOM HELPERS
   ============================================================ */
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return [...document.querySelectorAll(sel)]; }

function showToast(message, type = 'success', duration = 3000) {
  const container = qs('.toast-container');
  const toast = document.createElement('div');
  const icons = { success: 'check_circle', error: 'error', warning: 'warning' };
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="material-symbols-rounded">${icons[type] || 'info'}</span>${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 220);
  }, duration);
}

/* ============================================================
   POPULATE JENIS USAHA SELECT
   ============================================================ */
function buildJenisSelect() {
  const sel = qs('#jenis_usaha');
  sel.innerHTML = '';
  JENIS_USAHA_OPTIONS.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    sel.appendChild(o);
  });
}

/* ============================================================
   PROFILE SWITCHER DROPDOWN
   ============================================================ */
function buildSwitcher() {
  const sel = qs('#profile-switcher');
  sel.innerHTML = '';
  profiles.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = p.nama_usaha || `Profil Usaha ${i + 1}`;
    sel.appendChild(o);
  });
  sel.value = activeIdx;
}

/* ============================================================
   RENDER — fill form from active profile
   ============================================================ */
function renderForm() {
  const p = getActive();

  // Basic info
  qs('#nama_usaha').value          = p.nama_usaha;
  qs('#nama_pemilik').value        = p.nama_pemilik;
  qs('#jenis_usaha').value         = p.jenis_usaha;
  qs('#tanggal_mulai_usaha').value = p.tanggal_mulai_usaha;
  qs('#alamat_usaha').value        = p.alamat_usaha;
  qs('#nomor_telepon').value       = p.nomor_telepon;
  qs('#deskripsi_usaha').value     = p.deskripsi_usaha;

  // Legalitas
  renderLegalitas('nib', p.nib);
  renderLegalitas('npwp', p.npwp);
  renderLegalitas('sku', p.sku);

  // Profile header card
  renderHeaderCard();
  renderKurWidget();
  renderCompleteness();
}

function renderHeaderCard() {
  const p = getActive();
  const months = monthDiff(p.tanggal_mulai_usaha);

  qs('#profile-initials').textContent     = getInitials(p.nama_usaha);
  qs('#profile-business-name').textContent = p.nama_usaha || 'Nama Usaha Belum Diisi';
  qs('#profile-owner').textContent         = p.nama_pemilik ? `Pemilik: ${p.nama_pemilik}` : 'Nama pemilik belum diisi';

  // Sector chip
  const sectorChip = qs('#meta-sector');
  sectorChip.textContent = getJenisLabel(p.jenis_usaha);

  // Duration chip
  const durChip = qs('#meta-duration');
  const icon = durChip.querySelector('.material-symbols-rounded');
  if (months === null) {
    durChip.className = 'meta-chip duration';
    icon.textContent = 'schedule';
    durChip.querySelector('.chip-text').textContent = 'Tanggal mulai belum diisi';
  } else if (months >= KUR_MIN_MONTHS) {
    durChip.className = 'meta-chip duration ok';
    icon.textContent = 'verified';
    durChip.querySelector('.chip-text').textContent = formatDuration(months);
  } else {
    durChip.className = 'meta-chip duration warn';
    icon.textContent = 'warning';
    durChip.querySelector('.chip-text').textContent = formatDuration(months);
  }
}

function renderKurWidget() {
  const p = getActive();
  const months = monthDiff(p.tanggal_mulai_usaha);
  const widget = qs('#kur-eligibility-widget');
  const icon = qs('#kur-elig-icon-sym');
  const title = qs('#kur-elig-title');
  const desc = qs('#kur-elig-desc');
  const action = qs('#kur-elig-action');

  if (months === null) {
    widget.className = 'kur-eligibility-widget no-data';
    icon.textContent = 'help';
    title.textContent = 'Kelayakan KUR Belum Dapat Dihitung';
    desc.textContent = 'Isi tanggal mulai usaha untuk melihat apakah usaha Anda memenuhi syarat usia minimum KUR (6 bulan).';
    action.style.display = 'none';
  } else if (months >= KUR_MIN_MONTHS) {
    widget.className = 'kur-eligibility-widget eligible';
    icon.textContent = 'task_alt';
    title.textContent = `Memenuhi Syarat KUR — Usaha berjalan ${formatDuration(months)}`;
    desc.textContent = `Usaha telah berjalan lebih dari ${KUR_MIN_MONTHS} bulan. Anda dapat mengajukan KUR Mikro maupun KUR Kecil 2026.`;
    action.style.display = 'inline-flex';
    action.textContent = 'Simulasi KUR';
    action.innerHTML = '<span class="material-symbols-rounded">calculate</span> Simulasi KUR';
    action.onclick = () => window.location.href = '../simulasi-kur/index.html';
  } else {
    widget.className = 'kur-eligibility-widget not-eligible';
    icon.textContent = 'cancel';
    const remaining = KUR_MIN_MONTHS - months;
    title.textContent = `Belum Memenuhi Syarat KUR — Kurang ${remaining} bulan lagi`;
    desc.textContent = `Usaha minimal harus berjalan ${KUR_MIN_MONTHS} bulan. Saat ini baru ${formatDuration(months)}. Terus kembangkan usaha Anda!`;
    action.style.display = 'inline-flex';
    action.innerHTML = '<span class="material-symbols-rounded">tips_and_updates</span> Pelajari Syarat';
    action.onclick = () => window.open('https://kur.ekon.go.id/', '_blank');
  }
}

function renderLegalitas(key, data) {
  const item = qs(`#leg-item-${key}`);
  const toggle = qs(`#leg-toggle-${key}`);
  const numInput = qs(`#leg-nomor-${key}`);
  const iconWrap = qs(`#leg-icon-${key}`);
  const badge = qs(`#leg-badge-${key}`);

  if (!item || !toggle) return;

  toggle.checked = data.punya;
  if (numInput) numInput.value = data.nomor || '';

  if (data.punya) {
    item.className = 'legalitas-item has-doc';
    if (iconWrap) {
      iconWrap.innerHTML = '<span class="material-symbols-rounded">verified</span>';
    }
    if (badge) {
      badge.textContent = 'Terverifikasi';
      badge.className = 'legalitas-status-badge verified';
    }
  } else {
    item.className = 'legalitas-item no-doc';
    if (iconWrap) {
      iconWrap.innerHTML = '<span class="material-symbols-rounded">pending</span>';
    }
    if (badge) {
      badge.textContent = 'Belum Ada';
      badge.className = 'legalitas-status-badge pending';
    }
  }
}

function renderCompleteness() {
  const p = getActive();
  const fields = [
    p.nama_usaha, p.nama_pemilik, p.jenis_usaha,
    p.tanggal_mulai_usaha, p.alamat_usaha,
    p.nomor_telepon, p.deskripsi_usaha
  ];
  const filled = fields.filter(f => f && f.trim() !== '').length;
  const pct = Math.round((filled / fields.length) * 100);

  qs('#completeness-fill').style.width = pct + '%';
  qs('#completeness-pct').textContent = pct + '%';
  qs('#completeness-label').textContent =
    pct === 100 ? 'Profil lengkap!' :
    pct >= 70   ? 'Hampir lengkap' :
    pct >= 40   ? 'Sedang diisi' :
                  'Profil belum lengkap';
}

/* ============================================================
   COLLECT FORM → profile object
   ============================================================ */
function collectForm() {
  const p = getActive();
  p.nama_usaha          = qs('#nama_usaha').value.trim();
  p.nama_pemilik        = qs('#nama_pemilik').value.trim();
  p.jenis_usaha         = qs('#jenis_usaha').value;
  p.tanggal_mulai_usaha = qs('#tanggal_mulai_usaha').value;
  p.alamat_usaha        = qs('#alamat_usaha').value.trim();
  p.nomor_telepon       = qs('#nomor_telepon').value.trim();
  p.deskripsi_usaha     = qs('#deskripsi_usaha').value.trim();

  ['nib', 'npwp', 'sku'].forEach(key => {
    p[key] = {
      punya: qs(`#leg-toggle-${key}`).checked,
      nomor: (qs(`#leg-nomor-${key}`) || {}).value || '',
    };
  });

  profiles[activeIdx] = p;
}

/* ============================================================
   VALIDATION
   ============================================================ */
function validateForm() {
  let valid = true;

  const required = [
    { id: 'nama_usaha', msg: 'Nama usaha wajib diisi' },
    { id: 'nama_pemilik', msg: 'Nama pemilik wajib diisi' },
    { id: 'jenis_usaha', msg: 'Jenis usaha wajib dipilih' },
    { id: 'tanggal_mulai_usaha', msg: 'Tanggal mulai usaha wajib diisi (penting untuk cek KUR)' },
    { id: 'alamat_usaha', msg: 'Alamat usaha wajib diisi' },
  ];

  required.forEach(({ id, msg }) => {
    const input = qs(`#${id}`);
    const group = input.closest('.form-group');
    const errorEl = group.querySelector('.form-error');
    if (!input.value.trim() && input.value === '') {
      group.classList.add('has-error');
      input.classList.add('error');
      if (errorEl) errorEl.textContent = msg;
      valid = false;
    } else {
      group.classList.remove('has-error');
      input.classList.remove('error');
      input.classList.add('success');
    }
  });

  // Phone validation (optional but if filled, check format)
  const phone = qs('#nomor_telepon');
  const phoneGroup = phone.closest('.form-group');
  const phoneError = phoneGroup.querySelector('.form-error');
  if (phone.value && !/^[0-9+\-\s()]{7,15}$/.test(phone.value)) {
    phoneGroup.classList.add('has-error');
    phone.classList.add('error');
    if (phoneError) phoneError.textContent = 'Format nomor telepon tidak valid';
    valid = false;
  } else if (phone.value) {
    phoneGroup.classList.remove('has-error');
    phone.classList.remove('error');
    phone.classList.add('success');
  }

  return valid;
}

function clearValidation() {
  qsa('.form-group').forEach(g => {
    g.classList.remove('has-error');
    g.querySelectorAll('.form-control').forEach(inp => {
      inp.classList.remove('error', 'success');
    });
  });
}

/* ============================================================
   LIVE UPDATES (while typing)
   ============================================================ */
function attachLiveListeners() {
  const liveFields = [
    'nama_usaha', 'nama_pemilik', 'jenis_usaha',
    'tanggal_mulai_usaha', 'alamat_usaha',
    'nomor_telepon', 'deskripsi_usaha'
  ];
  liveFields.forEach(id => {
    const el = qs(`#${id}`);
    if (!el) return;
    el.addEventListener('input', () => {
      collectForm();
      renderHeaderCard();
      renderKurWidget();
      renderCompleteness();
    });
    el.addEventListener('change', () => {
      collectForm();
      renderHeaderCard();
      renderKurWidget();
      renderCompleteness();
    });
  });
}

/* ============================================================
   LEGALITAS TOGGLE HANDLERS
   ============================================================ */
function attachLegalisaListeners() {
  ['nib', 'npwp', 'sku'].forEach(key => {
    const toggle = qs(`#leg-toggle-${key}`);
    const numInput = qs(`#leg-nomor-${key}`);
    if (!toggle) return;

    toggle.addEventListener('change', () => {
      const checked = toggle.checked;
      profiles[activeIdx][key] = {
        punya: checked,
        nomor: numInput ? numInput.value : '',
      };
      renderLegalitas(key, profiles[activeIdx][key]);
      renderCompleteness();
    });

    if (numInput) {
      numInput.addEventListener('input', () => {
        profiles[activeIdx][key].nomor = numInput.value;
      });
    }
  });
}

/* ============================================================
   MULTI-PROFILE SWITCHER
   ============================================================ */
function attachSwitcherListeners() {
  const sel = qs('#profile-switcher');
  sel.addEventListener('change', () => {
    collectForm();
    activeIdx = parseInt(sel.value);
    clearValidation();
    renderForm();
    buildSwitcher();
    showToast(`Beralih ke: ${getActive().nama_usaha || 'Profil ' + (activeIdx + 1)}`, 'success', 2000);
  });

  qs('#btn-add-profile').addEventListener('click', () => {
    if (profiles.length >= 5) {
      showToast('Maksimal 5 profil usaha dapat disimpan', 'warning');
      return;
    }
    collectForm();
    profiles.push({ ...cloneProfile(EMPTY_PROFILE), id: uid() });
    activeIdx = profiles.length - 1;
    clearValidation();
    renderForm();
    buildSwitcher();
    showToast('Profil usaha baru ditambahkan', 'success');
  });
}

/* ============================================================
   SAVE HANDLER
   ============================================================ */
function handleSave() {
  if (!validateForm()) {
    showToast('Lengkapi data yang wajib diisi', 'error');
    return;
  }
  collectForm();
  saveProfiles();
  renderHeaderCard();
  renderKurWidget();
  renderCompleteness();
  buildSwitcher();
  showToast('Profil usaha berhasil disimpan', 'success');
}

/* ============================================================
   DELETE PROFILE
   ============================================================ */
function handleDeleteProfile() {
  if (profiles.length <= 1) {
    showToast('Minimal harus ada 1 profil usaha', 'warning');
    return;
  }
  qs('.modal-backdrop').classList.add('open');
}

function confirmDelete() {
  profiles.splice(activeIdx, 1);
  activeIdx = Math.max(0, activeIdx - 1);
  saveProfiles();
  clearValidation();
  renderForm();
  buildSwitcher();
  qs('.modal-backdrop').classList.remove('open');
  showToast('Profil usaha dihapus', 'success');
}

/* ============================================================
   PDF EXPORT
   ============================================================ */
function handleExport() {
  collectForm();
  window.print();
}

/* ============================================================
   SIDEBAR NAV BADGE (transaction count from Buku Kas)
   ============================================================ */
function updateNavBadge() {
  try {
    const kasRaw = localStorage.getItem('utera.kas.transaksi.v1');
    if (kasRaw) {
      const kas = JSON.parse(kasRaw);
      if (Array.isArray(kas) && kas.length > 0) {
        const badge = qs('#kas-badge');
        if (badge) {
          badge.textContent = kas.length;
          badge.style.display = '';
        }
      }
    }
  } catch (e) { /* ignore */ }
}

/* ============================================================
   MOBILE HAMBURGER
   ============================================================ */
function attachHamburger() {
  const btn = qs('#hamburger-btn');
  const sidebar = qs('.sidebar');
  if (!btn || !sidebar) return;
  btn.addEventListener('click', () => sidebar.classList.toggle('mobile-open'));
  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !btn.contains(e.target)) {
      sidebar.classList.remove('mobile-open');
    }
  });
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  buildJenisSelect();
  loadProfiles();
  buildSwitcher();
  renderForm();
  attachLiveListeners();
  attachLegalisaListeners();
  attachSwitcherListeners();
  attachHamburger();
  updateNavBadge();
  fetchFromSupabase(); // Sinkronkan data dari cloud Supabase jika ada

  // Set max date to today for tanggal_mulai_usaha
  const dateInput = qs('#tanggal_mulai_usaha');
  if (dateInput) {
    dateInput.max = new Date().toISOString().split('T')[0];
  }

  // Save button
  qs('#btn-save').addEventListener('click', handleSave);

  // Export button
  qs('#btn-export').addEventListener('click', handleExport);

  // Delete profile button
  qs('#btn-delete-profile') && qs('#btn-delete-profile').addEventListener('click', handleDeleteProfile);

  // Modal buttons
  qs('#modal-confirm-delete') && qs('#modal-confirm-delete').addEventListener('click', confirmDelete);
  qs('#modal-cancel') && qs('#modal-cancel').addEventListener('click', () => {
    qs('.modal-backdrop').classList.remove('open');
  });
  qs('.modal-backdrop') && qs('.modal-backdrop').addEventListener('click', (e) => {
    if (e.target === qs('.modal-backdrop')) qs('.modal-backdrop').classList.remove('open');
  });

  // Keyboard shortcut: Ctrl+S to save
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);

