/**
 * UTERA · Legalitas & NIB
 * UI layer: rendering and interaction. Data access goes through LegalitasService only.
 */
(function () {
  'use strict';

  const M = window.LegalitasModels;
  const L = window.LegalitasLogic;
  const S = window.LegalitasService;

  const OSS_URL = 'https://oss.go.id/';

  const STATUS_COPY = {
    belum_nib: { label: 'Belum memiliki NIB', icon: 'pending_actions', tone: 'neutral' },
    belum_lengkap: { label: 'Belum lengkap', icon: 'rule', tone: 'gold' },
    lengkap: { label: 'Lengkap', icon: 'task_alt', tone: 'green' },
    perlu_diperbarui: { label: 'Perlu diperbarui', icon: 'event_busy', tone: 'red' },
  };

  const DOC_STATUS_COPY = {
    belum_diunggah: { label: 'Belum diunggah', tone: 'neutral' },
    diunggah: { label: 'Diunggah', tone: 'green' },
    segera_berakhir: { label: 'Segera berakhir', tone: 'gold' },
    kedaluwarsa: { label: 'Kedaluwarsa', tone: 'red' },
  };

  let state = null;
  let summary = null;
  let currentDocId = null;
  let pendingNibFile = null;
  let previewUrl = null;
  let previewDocId = null;

  /* ============================================================
     Helpers
     ============================================================ */
  const $ = (sel, root = document) => root.querySelector(sel);

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function icon(name, extra = '') {
    return `<span class="material-symbols-rounded ${extra}" aria-hidden="true">${name}</span>`;
  }

  function fileIcon(meta) {
    if (!meta) return 'upload_file';
    return meta.tipe === 'application/pdf' ? 'picture_as_pdf' : 'image';
  }

  function chip(statusKey) {
    const c = DOC_STATUS_COPY[statusKey];
    return `<span class="chip tone-${c.tone}">${c.label}</span>`;
  }

  function getDoc(id) {
    return state.dokumen.find((d) => d.id === id) || null;
  }

  function nibDoc() {
    return state.dokumen.find((d) => d.kategori === 'nib');
  }

  function setBusy(btn, busy, busyText) {
    if (!btn) return;
    if (busy) {
      btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      if (busyText) btn.innerHTML = `<span class="spinner spinner-sm" aria-hidden="true"></span><span>${busyText}</span>`;
    } else {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    }
  }

  function expiryText(doc) {
    if (!doc.berlaku_hingga) return '';
    const days = L.daysUntil(doc.berlaku_hingga, new Date());
    if (days === null) return '';
    if (days < 0) return `Berakhir ${L.formatDate(doc.berlaku_hingga)}`;
    if (days === 0) return 'Berakhir hari ini';
    if (days <= M.EXPIRY_WARNING_DAYS) return `Berakhir dalam ${days} hari`;
    return `Berlaku s.d. ${L.formatDate(doc.berlaku_hingga)}`;
  }

  /* ============================================================
     Toast
     ============================================================ */
  function toast(message, type = 'success') {
    const region = $('#toast-region');
    const el = document.createElement('div');
    const icons = { success: 'check_circle', error: 'error', info: 'info' };
    el.className = `toast toast-${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `${icon(icons[type] || 'info')}<span>${esc(message)}</span>`;
    region.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 200);
    }, type === 'error' ? 4800 : 3200);
  }

  /* ============================================================
     Dialogs (native <dialog>: Escape and focus handling built in)
     ============================================================ */
  const returnFocus = new WeakMap();

  function openDialog(dlg) {
    returnFocus.set(dlg, document.activeElement);
    if (!dlg.open) dlg.showModal();
  }

  function closeDialog(dlg) {
    if (dlg.open) dlg.close();
  }

  function wireDialog(dlg) {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) closeDialog(dlg);
      if (e.target.closest('[data-close]')) closeDialog(dlg);
    });
    dlg.addEventListener('close', () => {
      const el = returnFocus.get(dlg);
      if (el && document.contains(el) && typeof el.focus === 'function') el.focus();
    });
  }

  function confirmAction({ title, message, okLabel = 'Hapus' }) {
    const dlg = $('#dlg-confirm');
    $('#dlg-confirm-title').textContent = title;
    $('#dlg-confirm-msg').textContent = message;
    $('#btn-confirm-ok').textContent = okLabel;
    openDialog(dlg);
    $('#btn-confirm-cancel').focus();
    return new Promise((resolve) => {
      const ok = $('#btn-confirm-ok');
      const cancel = $('#btn-confirm-cancel');
      function done(result) {
        ok.removeEventListener('click', onOk);
        cancel.removeEventListener('click', onCancel);
        dlg.removeEventListener('close', onClose);
        closeDialog(dlg);
        resolve(result);
      }
      const onOk = () => done(true);
      const onCancel = () => done(false);
      const onClose = () => done(false);
      ok.addEventListener('click', onOk);
      cancel.addEventListener('click', onCancel);
      dlg.addEventListener('close', onClose);
    });
  }

  /* ============================================================
     Dropzone (reusable)
     ============================================================ */
  let dzCount = 0;

  function dropzoneHtml(compact) {
    dzCount += 1;
    const id = `dz-input-${dzCount}`;
    return `
      <div class="dropzone ${compact ? 'is-compact' : ''}" data-dropzone>
        <input type="file" id="${id}" class="dz-input" accept="${M.FILE_RULES.acceptAttr}" aria-describedby="${id}-err">
        <label for="${id}" class="dz-label">
          ${icon('upload', 'dz-icon')}
          <span class="dz-text"><strong>Pilih berkas</strong> atau seret ke sini</span>
          <span class="dz-hint">PDF, JPG, atau PNG. Maksimal 2 MB.</span>
        </label>
        <p class="err dz-error" id="${id}-err"></p>
      </div>`;
  }

  function wireDropzone(root, onFile) {
    const zone = root.querySelector('[data-dropzone]');
    if (!zone) return;
    const input = zone.querySelector('.dz-input');
    const errEl = zone.querySelector('.dz-error');

    function handle(file) {
      const error = L.validateFile(file);
      if (error) {
        errEl.textContent = error;
        zone.classList.add('has-error');
        toast(error, 'error');
        input.value = '';
        return;
      }
      errEl.textContent = '';
      zone.classList.remove('has-error');
      onFile(file);
      input.value = '';
    }

    input.addEventListener('change', () => { if (input.files[0]) handle(input.files[0]); });
    ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => {
      e.preventDefault();
      zone.classList.add('is-dragging');
    }));
    ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => {
      e.preventDefault();
      if (ev === 'dragleave' && zone.contains(e.relatedTarget)) return;
      zone.classList.remove('is-dragging');
    }));
    zone.addEventListener('drop', (e) => {
      const file = e.dataTransfer && e.dataTransfer.files[0];
      if (file) handle(file);
    });
  }

  /* ============================================================
     Render: status
     ============================================================ */
  function renderStatus() {
    const s = summary;
    const copy = STATUS_COPY[s.status];
    let desc = '';
    let action = '';

    if (s.status === M.LEGAL_STATUS.BELUM_NIB) {
      desc = 'Simpan NIB Anda di sini setelah diterbitkan melalui OSS.';
    } else if (s.status === M.LEGAL_STATUS.BELUM_LENGKAP) {
      const names = s.missing.map((d) => d.nama).join(', ');
      desc = `${s.missing.length} dokumen belum diunggah: ${esc(names)}.`;
      action = `<button type="button" class="btn btn-primary" data-action="open-doc" data-id="${esc(s.missing[0].id)}">${icon('upload')}<span>Lengkapi dokumen</span></button>`;
    } else if (s.status === M.LEGAL_STATUS.PERLU_DIPERBARUI) {
      const parts = s.expired.map((d) => `${esc(d.nama)} sudah kedaluwarsa`)
        .concat(s.expiring.map((d) => `${esc(d.nama)} ${expiryText(d).toLowerCase()}`));
      desc = parts.join('. ') + '.';
      const target = s.expired[0] || s.expiring[0];
      action = `<button type="button" class="btn btn-primary" data-action="open-doc" data-id="${esc(target.id)}">${icon('autorenew')}<span>Perbarui dokumen</span></button>`;
    } else {
      desc = 'Semua dokumen di daftar sudah diunggah dan masih berlaku.';
    }

    const pct = s.total ? Math.round((s.uploaded / s.total) * 100) : 0;
    let validity;
    if (s.expired.length) validity = `${s.expired.length} kedaluwarsa`;
    else if (s.expiring.length) validity = `${s.expiring.length} segera berakhir`;
    else if (!s.uploaded) validity = 'Belum ada dokumen';
    else validity = 'Semua masih berlaku';

    $('#status-panel').className = `status-panel tone-${copy.tone}`;
    $('#status-panel').innerHTML = `
      <div class="status-main">
        <span class="status-icon">${icon(copy.icon)}</span>
        <div class="status-text">
          <span class="status-kicker">Status legalitas</span>
          <h2 id="status-title">${copy.label}</h2>
          <p>${desc}</p>
        </div>
        ${action ? `<div class="status-action">${action}</div>` : ''}
      </div>
      <dl class="status-facets">
        <div class="facet">
          <dt>Kelengkapan</dt>
          <dd>${s.uploaded} dari ${s.total} dokumen</dd>
          <div class="meter" role="progressbar" aria-label="Kelengkapan dokumen" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
        </div>
        <div class="facet">
          <dt>Masa berlaku</dt>
          <dd class="${s.expired.length ? 'text-red' : s.expiring.length ? 'text-gold' : ''}">${validity}</dd>
        </div>
        <div class="facet">
          <dt>Verifikasi resmi</dt>
          <dd>Belum tersedia</dd>
          <span class="facet-note">UTERA belum terhubung dengan instansi penerbit.</span>
        </div>
      </dl>`;
  }

  /* ============================================================
     Render: NIB panel
     ============================================================ */
  function renderNib() {
    const panel = $('#nib-panel');
    const profile = S.getProfile();

    if (!state.nib) {
      const fromProfile = profile && profile.nib_nomor
        ? `<div class="inline-note">${icon('link')}<p>Profil Usaha mencatat NIB <strong class="mono">${esc(L.formatNib(profile.nib_nomor))}</strong>. Lengkapi informasinya di sini.</p></div>`
        : '';
      panel.innerHTML = `
        <header class="panel-head"><h2 id="nib-title">Informasi NIB</h2></header>
        <div class="nib-empty">
          <p class="empty-lead">Belum ada NIB tersimpan.</p>
          ${fromProfile}
          <ol class="mini-steps">
            <li>Siapkan informasi usaha</li>
            <li>Buka portal OSS resmi</li>
            <li>Ikuti proses pendaftaran</li>
            <li>Lengkapi informasi yang diminta</li>
            <li>Simpan NIB di UTERA setelah terbit</li>
          </ol>
          <div class="stack-actions">
            <a class="btn btn-primary" href="${OSS_URL}" target="_blank" rel="noopener noreferrer"><span>Urus NIB di OSS</span>${icon('open_in_new')}</a>
            <button type="button" class="btn btn-outline" data-action="add-nib">${icon('add')}<span>${fromProfile ? 'Lengkapi NIB' : 'Tambah NIB'}</span></button>
          </div>
          <button type="button" class="btn-link" data-action="open-guide">Baca panduan lengkap</button>
          <p class="fine-print">NIB diterbitkan oleh sistem OSS, bukan oleh UTERA.</p>
        </div>`;
      return;
    }

    const n = state.nib;
    const doc = nibDoc();
    const muted = '<span class="muted">Belum diisi</span>';
    const fileBlock = doc && doc.berkas
      ? `<div class="file-line">
          <span class="file-ic">${icon(fileIcon(doc.berkas))}</span>
          <div class="file-meta">
            <strong>${esc(doc.berkas.nama)}</strong>
            <span>${L.formatBytes(doc.berkas.ukuran)} · Diunggah ${L.formatDate(doc.berkas.diunggah_pada)}</span>
          </div>
          <div class="file-actions">
            <button type="button" class="icon-btn" data-action="preview" data-id="${esc(doc.id)}" aria-label="Lihat dokumen NIB" title="Lihat">${icon('visibility')}</button>
            <button type="button" class="icon-btn" data-action="download" data-id="${esc(doc.id)}" aria-label="Unduh dokumen NIB" title="Unduh">${icon('download')}</button>
          </div>
        </div>`
      : `<div class="file-line is-empty">
          <span class="file-ic">${icon('upload_file')}</span>
          <div class="file-meta"><strong>Dokumen NIB belum diunggah</strong><span>Unggah salinan dari OSS.</span></div>
          <button type="button" class="btn btn-secondary btn-sm" data-action="open-doc" data-id="${esc(doc ? doc.id : '')}">Unggah</button>
        </div>`;

    panel.innerHTML = `
      <header class="panel-head">
        <h2 id="nib-title">Informasi NIB</h2>
        <button type="button" class="btn btn-outline btn-sm" data-action="edit-nib">${icon('edit')}<span>Edit</span></button>
      </header>
      <div class="nib-number">
        <span class="kv-label">Nomor Induk Berusaha</span>
        <div class="nib-number-row">
          <strong class="mono">${esc(L.formatNib(n.nomor))}</strong>
          <button type="button" class="icon-btn" data-action="copy-nib" aria-label="Salin nomor NIB" title="Salin">${icon('content_copy')}</button>
        </div>
      </div>
      <dl class="kv">
        <div><dt>Nama usaha</dt><dd>${esc(n.nama_usaha)}</dd></div>
        <div><dt>Penanggung jawab</dt><dd>${n.penanggung_jawab ? esc(n.penanggung_jawab) : muted}</dd></div>
        <div><dt>KBLI / bidang usaha</dt><dd>${n.kbli ? esc(n.kbli) : muted}</dd></div>
        <div><dt>Tanggal terbit</dt><dd>${esc(L.formatDate(n.tanggal_terbit))}</dd></div>
      </dl>
      ${fileBlock}`;
  }

  /* ============================================================
     Render: documents
     ============================================================ */
  function renderDocs() {
    const today = new Date();
    const rows = state.dokumen.map((d) => {
      const st = L.getDocumentStatus(d, today);
      const sub = d.berkas ? esc(d.berkas.nama) : esc(M.getCategory(d.kategori).hint);
      const exp = d.berkas ? expiryText(d) : '';
      const btn = d.berkas
        ? `<button type="button" class="btn btn-outline btn-sm" data-action="open-doc" data-id="${esc(d.id)}" aria-label="Kelola ${esc(d.nama)}">Kelola</button>`
        : `<button type="button" class="btn btn-secondary btn-sm" data-action="open-doc" data-id="${esc(d.id)}" aria-label="Unggah ${esc(d.nama)}">Unggah</button>`;
      return `
        <li class="doc-row" data-status="${st}">
          <span class="doc-icon tone-${DOC_STATUS_COPY[st].tone}">${icon(fileIcon(d.berkas))}</span>
          <div class="doc-name">
            <strong>${esc(d.nama)}</strong>
            <span class="doc-sub">${sub}</span>
          </div>
          <div class="doc-status">
            ${chip(st)}
            ${exp ? `<span class="doc-exp ${st === 'kedaluwarsa' ? 'text-red' : st === 'segera_berakhir' ? 'text-gold' : ''}">${esc(exp)}</span>` : ''}
          </div>
          <span class="doc-date">${d.berkas ? `<span class="doc-date-label">Diunggah </span>${L.formatDate(d.berkas.diunggah_pada)}` : '<span class="muted">Belum ada</span>'}</span>
          <div class="doc-act">${btn}</div>
        </li>`;
    }).join('');

    const hint = state.dokumen.length === 1
      ? '<p class="docs-hint">Tambahkan NPWP, Sertifikat Halal, atau PIRT bila usaha Anda memerlukannya.</p>'
      : '';

    $('#docs-panel').innerHTML = `
      <header class="panel-head">
        <div>
          <h2 id="docs-title">Dokumen legalitas</h2>
          <p class="panel-sub">${summary.uploaded} dari ${summary.total} sudah diunggah</p>
        </div>
        <button type="button" class="btn btn-outline btn-sm" data-action="add-doc">${icon('add')}<span>Tambah dokumen</span></button>
      </header>
      <div class="doc-cols" aria-hidden="true"><span>Dokumen</span><span>Status</span><span>Tanggal unggah</span><span></span></div>
      <ul class="doc-list">${rows}</ul>
      ${hint}`;
  }

  function renderSidebarProfile() {
    const p = S.getProfile();
    let localName = '';
    try { localName = localStorage.getItem('utera_nama_usaha'); } catch (e) {}
    const name = (p && p.nama_usaha) || localName || (localStorage.getItem('utera_user_name') ? ('Usaha ' + localStorage.getItem('utera_user_name')) : 'Usaha Saya');
    const sideEl = $('#sidebar-business-name');
    if (sideEl) sideEl.textContent = name;
    const words = name.trim().split(/\s+/);
    const initEl = $('#sidebar-initials');
    if (initEl) initEl.textContent = (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
  }

  function render() {
    summary = L.summarize(state);
    renderStatus();
    renderNib();
    renderDocs();
    renderSidebarProfile();
    if ($('#dlg-doc') && $('#dlg-doc').open && currentDocId) {
      if (getDoc(currentDocId)) renderDocDialog();
      else closeDialog($('#dlg-doc'));
    }
  }

  /* ============================================================
     Load
     ============================================================ */
  async function load() {
    try {
      state = await S.load();
      render();
    } catch (e) {
      console.warn('[legalitas] using initial complete state', e);
      const defOwner = localStorage.getItem('utera_user_name') || 'Pemilik Usaha';
      const defBiz = localName || ('Usaha ' + defOwner);
      state = M.createInitialCompleteState(defBiz, defOwner);
      render();
    }
  }

  /* ============================================================
     NIB form
     ============================================================ */
  const NIB_FIELDS = {
    nomor: '#f-nomor',
    nama_usaha: '#f-nama-usaha',
    penanggung_jawab: '#f-pj',
    tanggal_terbit: '#f-terbit',
    kbli: '#f-kbli',
  };
  const NIB_ERR = {
    nomor: '#f-nomor-err',
    nama_usaha: '#f-nama-usaha-err',
    penanggung_jawab: '#f-pj-err',
    tanggal_terbit: '#f-terbit-err',
    kbli: '#f-kbli-err',
  };

  function clearNibErrors() {
    Object.keys(NIB_FIELDS).forEach((k) => {
      $(NIB_FIELDS[k]).removeAttribute('aria-invalid');
      $(NIB_ERR[k]).textContent = '';
    });
  }

  function showNibErrors(errors) {
    clearNibErrors();
    let first = null;
    Object.keys(errors).forEach((k) => {
      if (!NIB_FIELDS[k]) return;
      $(NIB_FIELDS[k]).setAttribute('aria-invalid', 'true');
      $(NIB_ERR[k]).textContent = errors[k];
      if (!first) first = $(NIB_FIELDS[k]);
    });
    if (first) first.focus();
  }

  function updateNibCounter() {
    const digits = L.normalizeNib($('#f-nomor').value).length;
    $('#f-nomor-hint').textContent = digits ? `${digits} dari 13 digit` : 'Tertera di bagian atas dokumen NIB.';
  }

  function renderNibFileSlot() {
    const slot = $('#nib-file-slot');
    const doc = nibDoc();
    if (pendingNibFile) {
      slot.innerHTML = `
        <div class="file-line is-pending">
          <span class="file-ic">${icon(fileIcon({ tipe: pendingNibFile.type }))}</span>
          <div class="file-meta"><strong>${esc(pendingNibFile.name)}</strong><span>${L.formatBytes(pendingNibFile.size)} · Diunggah saat disimpan</span></div>
          <button type="button" class="icon-btn" id="btn-clear-nib-file" aria-label="Batalkan berkas ini">${icon('close')}</button>
        </div>`;
      $('#btn-clear-nib-file').addEventListener('click', () => { pendingNibFile = null; renderNibFileSlot(); });
      return;
    }
    const current = doc && doc.berkas
      ? `<p class="hint slot-current">Tersimpan: <strong>${esc(doc.berkas.nama)}</strong>. Pilih berkas baru untuk mengganti.</p>`
      : '<p class="hint slot-current">Opsional. Bisa diunggah nanti.</p>';
    slot.innerHTML = current + dropzoneHtml(true);
    wireDropzone(slot, (file) => { pendingNibFile = file; renderNibFileSlot(); });
  }

  function openNibForm() {
    const form = $('#form-nib');
    form.reset();
    clearNibErrors();
    pendingNibFile = null;
    const profile = S.getProfile();
    const n = state.nib;
    $('#dlg-nib-title').textContent = n ? 'Edit informasi NIB' : 'Tambah informasi NIB';
    $('#f-nomor').value = n ? n.nomor : (profile && profile.nib_nomor) || '';
    $('#f-nama-usaha').value = n ? n.nama_usaha : (profile && profile.nama_usaha) || '';
    $('#f-pj').value = n ? n.penanggung_jawab : (profile && profile.nama_pemilik) || '';
    $('#f-terbit').value = n ? n.tanggal_terbit : '';
    $('#f-kbli').value = n ? n.kbli : '';
    $('#f-terbit').max = L.toDateInputValue(new Date());

    const fromProfile = !n && profile && profile.nama_usaha;
    $('#f-nama-usaha-hint').textContent = fromProfile ? 'Diambil dari Profil Usaha. Ubah bila berbeda dengan NIB.' : 'Sesuai yang tertulis di NIB.';
    $('#f-pj-hint').textContent = !n && profile && profile.nama_pemilik ? 'Diambil dari Profil Usaha.' : 'Opsional.';
    updateNibCounter();
    renderNibFileSlot();
    openDialog($('#dlg-nib'));
    $('#f-nomor').focus();
  }

  async function submitNib(e) {
    e.preventDefault();
    const input = {
      nomor: $('#f-nomor').value,
      nama_usaha: $('#f-nama-usaha').value,
      penanggung_jawab: $('#f-pj').value,
      tanggal_terbit: $('#f-terbit').value,
      kbli: $('#f-kbli').value,
    };
    const check = L.validateNib(input);
    if (!check.valid) {
      showNibErrors(check.errors);
      toast('Periksa kembali isian yang ditandai.', 'error');
      return;
    }
    const btn = $('#btn-save-nib');
    const isEdit = Boolean(state.nib);
    setBusy(btn, true, 'Menyimpan...');
    try {
      state = await S.saveNib(input);
      if (pendingNibFile) state = await S.uploadFile(nibDoc().id, pendingNibFile);
      pendingNibFile = null;
      render();
      closeDialog($('#dlg-nib'));
      toast(isEdit ? 'Informasi NIB diperbarui di perangkat ini.' : 'NIB tersimpan di perangkat ini.');
    } catch (err) {
      if (err.fields) showNibErrors(err.fields);
      toast(err.message || 'NIB gagal disimpan.', 'error');
    } finally {
      setBusy(btn, false);
    }
  }

  /* ============================================================
     Document dialog
     ============================================================ */
  function renderDocDialog() {
    const doc = getDoc(currentDocId);
    if (!doc) return;
    const cat = M.getCategory(doc.kategori);
    const st = L.getDocumentStatus(doc, new Date());
    $('#dlg-doc-title').textContent = doc.nama;
    $('#dlg-doc-sub').textContent = cat.hint;

    const fileSection = doc.berkas
      ? `<div class="file-line">
          <span class="file-ic">${icon(fileIcon(doc.berkas))}</span>
          <div class="file-meta">
            <strong>${esc(doc.berkas.nama)}</strong>
            <span>${L.formatBytes(doc.berkas.ukuran)} · Diunggah ${L.formatDate(doc.berkas.diunggah_pada)}${doc.berkas.contoh ? ' · Berkas contoh' : ''}</span>
          </div>
        </div>
        <div class="btn-row">
          <button type="button" class="btn btn-outline btn-sm" data-doc-action="preview">${icon('visibility')}<span>Lihat</span></button>
          <button type="button" class="btn btn-outline btn-sm" data-doc-action="download">${icon('download')}<span>Unduh</span></button>
          <label class="btn btn-outline btn-sm btn-file">
            ${icon('swap_horiz')}<span>Ganti berkas</span>
            <input type="file" class="sr-only" id="doc-replace-input" accept="${M.FILE_RULES.acceptAttr}">
          </label>
        </div>`
      : dropzoneHtml(false);

    const metaSection = doc.kategori === 'nib'
      ? `<p class="hint">Nomor dan data NIB diubah melalui <button type="button" class="btn-link" data-doc-action="edit-nib">Edit informasi NIB</button>.</p>`
      : `<form class="doc-meta-form" id="form-doc-meta" novalidate>
          ${doc.kategori === 'lainnya' ? `
          <div class="field">
            <label for="f-doc-nama">Nama dokumen</label>
            <input id="f-doc-nama" class="input" maxlength="80" value="${esc(doc.nama)}" aria-describedby="f-doc-nama-err">
            <span class="err" id="f-doc-nama-err"></span>
          </div>` : ''}
          <div class="field-row">
            <div class="field">
              <label for="f-doc-nomor">Nomor dokumen</label>
              <input id="f-doc-nomor" class="input" maxlength="60" value="${esc(doc.nomor)}" placeholder="Opsional" aria-describedby="f-doc-nomor-err">
              <span class="err" id="f-doc-nomor-err"></span>
            </div>
            ${cat.hasExpiry ? `
            <div class="field">
              <label for="f-doc-exp">Berlaku hingga</label>
              <input id="f-doc-exp" type="date" class="input" value="${esc(doc.berlaku_hingga || '')}" aria-describedby="f-doc-exp-hint f-doc-exp-err">
              <span class="hint" id="f-doc-exp-hint">Kosongkan bila tidak ada masa berlaku.</span>
              <span class="err" id="f-doc-exp-err"></span>
            </div>` : ''}
          </div>
          <button type="submit" class="btn btn-outline btn-sm" id="btn-save-meta">Simpan detail</button>
        </form>`;

    const danger = [];
    if (doc.berkas) danger.push(`<button type="button" class="btn btn-danger-ghost btn-sm" data-doc-action="remove-file">${icon('delete')}<span>Hapus berkas</span></button>`);
    if (cat.removable) danger.push(`<button type="button" class="btn btn-danger-ghost btn-sm" data-doc-action="remove-doc">${icon('playlist_remove')}<span>Hapus dari daftar</span></button>`);

    $('#dlg-doc-body').innerHTML = `
      <div class="doc-dlg-status">
        ${chip(st)}
        ${doc.berkas && expiryText(doc) ? `<span class="doc-exp">${esc(expiryText(doc))}</span>` : ''}
        <span class="verif-note">Verifikasi resmi: belum tersedia</span>
      </div>
      <div class="doc-file-section">${fileSection}</div>
      <div class="upload-progress" id="upload-progress" hidden>
        <div class="meter"><span id="upload-bar" style="width:0%"></span></div>
        <span class="hint" id="upload-text" role="status">Mengunggah...</span>
      </div>
      <div class="doc-meta-section">${metaSection}</div>
      ${danger.length ? `<div class="danger-row">${danger.join('')}</div>` : ''}`;

    const body = $('#dlg-doc-body');
    wireDropzone(body, (file) => uploadToCurrent(file));
    const replace = $('#doc-replace-input');
    if (replace) replace.addEventListener('change', () => {
      const file = replace.files[0];
      replace.value = '';
      if (!file) return;
      const error = L.validateFile(file);
      if (error) { toast(error, 'error'); return; }
      uploadToCurrent(file);
    });
    const metaForm = $('#form-doc-meta');
    if (metaForm) metaForm.addEventListener('submit', submitDocMeta);
  }

  function openDoc(id) {
    if (!getDoc(id)) return;
    currentDocId = id;
    renderDocDialog();
    openDialog($('#dlg-doc'));
    const first = $('#dlg-doc-body .dz-input, #dlg-doc-body button');
    if (first) first.focus();
  }

  async function uploadToCurrent(file) {
    const docId = currentDocId;
    const progress = $('#upload-progress');
    const bar = $('#upload-bar');
    const text = $('#upload-text');
    const section = $('#dlg-doc-body .doc-file-section');
    progress.hidden = false;
    section.classList.add('is-uploading');
    text.textContent = `Mengunggah ${file.name}...`;
    try {
      state = await S.uploadFile(docId, file, (p) => { bar.style.width = p + '%'; });
      render();
      toast('Berkas tersimpan di perangkat ini.');
    } catch (err) {
      progress.hidden = true;
      section.classList.remove('is-uploading');
      toast(err.message || 'Unggahan gagal. Coba lagi.', 'error');
    }
  }

  async function submitDocMeta(e) {
    e.preventDefault();
    const doc = getDoc(currentDocId);
    const input = {
      nomor: $('#f-doc-nomor') ? $('#f-doc-nomor').value : '',
      berlaku_hingga: $('#f-doc-exp') ? $('#f-doc-exp').value : null,
    };
    if ($('#f-doc-nama')) input.nama = $('#f-doc-nama').value;
    const check = L.validateDocumentMeta(input);
    ['nama', 'nomor', 'berlaku_hingga'].forEach((k) => {
      const map = { nama: 'f-doc-nama', nomor: 'f-doc-nomor', berlaku_hingga: 'f-doc-exp' };
      const field = document.getElementById(map[k]);
      const err = document.getElementById(map[k] + '-err');
      if (!field || !err) return;
      err.textContent = check.errors[k] || '';
      if (check.errors[k]) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid');
    });
    if (!check.valid) { toast('Periksa kembali isian dokumen.', 'error'); return; }
    const btn = $('#btn-save-meta');
    setBusy(btn, true, 'Menyimpan...');
    try {
      state = await S.updateDocumentMeta(doc.id, input);
      render();
      toast('Detail dokumen diperbarui.');
    } catch (err) {
      toast(err.message || 'Detail gagal disimpan.', 'error');
      setBusy(btn, false);
    }
  }

  async function removeFile(docId) {
    const doc = getDoc(docId);
    const ok = await confirmAction({
      title: 'Hapus berkas?',
      message: `Berkas ${doc.berkas.nama} akan dihapus dari perangkat ini. Data ${doc.nama} lainnya tetap tersimpan.`,
      okLabel: 'Hapus berkas',
    });
    if (!ok) return;
    try {
      state = await S.removeFile(docId);
      render();
      toast('Berkas dihapus.');
    } catch (err) {
      toast(err.message || 'Berkas gagal dihapus.', 'error');
    }
  }

  async function removeDocument(docId) {
    const doc = getDoc(docId);
    const ok = await confirmAction({
      title: `Hapus ${doc.nama} dari daftar?`,
      message: doc.berkas
        ? 'Dokumen dan berkasnya akan dihapus dari perangkat ini. Tindakan ini tidak dapat dibatalkan.'
        : 'Dokumen ini tidak lagi dihitung dalam kelengkapan legalitas.',
      okLabel: 'Hapus',
    });
    if (!ok) return;
    try {
      state = await S.removeDocument(docId);
      closeDialog($('#dlg-doc'));
      render();
      toast(`${doc.nama} dihapus dari daftar.`);
    } catch (err) {
      toast(err.message || 'Dokumen gagal dihapus.', 'error');
    }
  }

  /* ============================================================
     Add document
     ============================================================ */
  function openAddDoc() {
    const taken = new Set(state.dokumen.map((d) => d.kategori));
    const options = M.DOC_CATEGORIES.filter((c) => c.id !== 'nib' && !(c.single && taken.has(c.id)));
    $('#add-choices').innerHTML = '<legend class="sr-only">Jenis dokumen</legend>' + options.map((c, i) => `
      <label class="choice">
        <input type="radio" name="kategori" value="${c.id}" ${i === 0 ? 'checked' : ''}>
        <span class="choice-text"><strong>${esc(c.fullLabel)}</strong><span>${esc(c.hint)}</span></span>
      </label>`).join('');
    $('#f-add-nama').value = '';
    $('#f-add-nama-err').textContent = '';
    $('#f-add-nama').removeAttribute('aria-invalid');
    syncAddCustom();
    openDialog($('#dlg-add'));
    const first = $('#add-choices input');
    if (first) first.focus();
  }

  function syncAddCustom() {
    const sel = $('#add-choices input:checked');
    $('#add-custom-field').hidden = !(sel && sel.value === 'lainnya');
  }

  async function submitAddDoc(e) {
    e.preventDefault();
    const sel = $('#add-choices input:checked');
    if (!sel) return;
    const nama = sel.value === 'lainnya' ? $('#f-add-nama').value : '';
    if (sel.value === 'lainnya' && !nama.trim()) {
      $('#f-add-nama-err').textContent = 'Nama dokumen wajib diisi.';
      $('#f-add-nama').setAttribute('aria-invalid', 'true');
      $('#f-add-nama').focus();
      return;
    }
    const btn = e.submitter || $('#form-add button[type="submit"]');
    setBusy(btn, true, 'Menambah...');
    try {
      const res = await S.addDocument(sel.value, nama);
      state = res.state;
      render();
      closeDialog($('#dlg-add'));
      openDoc(res.docId);
    } catch (err) {
      toast(err.message || 'Dokumen gagal ditambahkan.', 'error');
    } finally {
      setBusy(btn, false);
    }
  }

  /* ============================================================
     Preview & download
     ============================================================ */
  async function openPreview(docId) {
    const doc = getDoc(docId);
    if (!doc || !doc.berkas) return;
    previewDocId = docId;
    const stage = $('#preview-stage');
    $('#dlg-preview-title').textContent = doc.nama;
    $('#dlg-preview-sub').textContent = `${doc.berkas.nama} · ${L.formatBytes(doc.berkas.ukuran)}`;
    stage.innerHTML = '<div class="preview-msg"><span class="spinner" aria-hidden="true"></span><p>Menyiapkan pratinjau...</p></div>';
    openDialog($('#dlg-preview'));

    const file = await S.getFile(docId);
    if (!file || file.contoh) {
      stage.innerHTML = `<div class="preview-msg">${icon(fileIcon(doc.berkas), 'preview-ic')}<p><strong>Berkas contoh</strong></p><p>Data simulasi tidak memiliki isi dokumen asli. Unggah berkas Anda sendiri untuk melihat pratinjau.</p></div>`;
      return;
    }
    if (!file.blob) {
      stage.innerHTML = `<div class="preview-msg">${icon('error', 'preview-ic')}<p><strong>Berkas tidak ditemukan di perangkat ini</strong></p><p>Penyimpanan peramban mungkin sudah dibersihkan. Unggah ulang dokumen.</p></div>`;
      return;
    }
    revokePreview();
    previewUrl = URL.createObjectURL(file.blob);
    stage.innerHTML = file.meta.tipe === 'application/pdf'
      ? `<iframe class="preview-frame" src="${previewUrl}" title="Pratinjau ${esc(doc.nama)}"></iframe>`
      : `<img class="preview-img" src="${previewUrl}" alt="Pratinjau ${esc(doc.nama)}">`;
  }

  function revokePreview() {
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
  }

  async function downloadDoc(docId) {
    try {
      const file = await S.getFile(docId);
      if (!file || !file.blob) { toast('Berkas tidak ditemukan di perangkat ini. Unggah ulang dokumen.', 'error'); return; }
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.contoh ? file.meta.nama.replace(/\.[^.]+$/, '') + '.txt' : file.meta.nama;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(file.contoh ? 'Mengunduh berkas contoh (teks).' : 'Unduhan dimulai.', 'info');
    } catch (err) {
      toast('Berkas gagal diunduh.', 'error');
    }
  }

  async function copyNib() {
    try {
      await navigator.clipboard.writeText(state.nib.nomor);
      toast('Nomor NIB disalin.', 'info');
    } catch (e) {
      toast('Tidak dapat menyalin. Salin nomor secara manual.', 'error');
    }
  }

  /* ============================================================
     Sidebar (mobile)
     ============================================================ */
  function setSidebar(open) {
    $('#app-sidebar').classList.toggle('mobile-open', open);
    $('#sidebar-backdrop').hidden = !open;
    $('#btn-mobile-menu').setAttribute('aria-expanded', String(open));
    if (open) $('#btn-close-sidebar').focus();
  }

  /* ============================================================
     Source switcher (simulation)
     ============================================================ */
  function renderSources() {
    const sel = $('#source-select');
    if (!sel) return;
    sel.innerHTML = S.listSources().map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join('');
    sel.value = S.getSource();
  }

  async function resetSource() {
    const demo = S.isDemo();
    const ok = await confirmAction({
      title: demo ? 'Kembalikan data contoh?' : 'Hapus semua data legalitas Anda?',
      message: demo
        ? 'Perubahan pada skenario ini akan dikembalikan ke kondisi awal.'
        : 'Informasi NIB dan semua berkas yang tersimpan di perangkat ini akan dihapus. Profil Usaha tidak terpengaruh.',
      okLabel: demo ? 'Kembalikan' : 'Hapus semua',
    });
    if (!ok) return;
    try {
      state = await S.reset();
      render();
      toast(demo ? 'Data contoh dikembalikan.' : 'Data legalitas dihapus dari perangkat ini.');
    } catch (err) {
      toast(err.message || 'Gagal mengatur ulang.', 'error');
    }
  }

  /* ============================================================
     Events
     ============================================================ */
  function onMainClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const id = el.dataset.id;
    switch (el.dataset.action) {
      case 'add-nib':
      case 'edit-nib': openNibForm(); break;
      case 'open-doc': openDoc(id); break;
      case 'add-doc': openAddDoc(); break;
      case 'preview': openPreview(id); break;
      case 'download': downloadDoc(id); break;
      case 'copy-nib': copyNib(); break;
      case 'open-guide': openDialog($('#dlg-guide')); break;
      default: break;
    }
  }

  function onDocDialogClick(e) {
    const el = e.target.closest('[data-doc-action]');
    if (!el) return;
    switch (el.dataset.docAction) {
      case 'preview': openPreview(currentDocId); break;
      case 'download': downloadDoc(currentDocId); break;
      case 'remove-file': removeFile(currentDocId); break;
      case 'remove-doc': removeDocument(currentDocId); break;
      case 'edit-nib': closeDialog($('#dlg-doc')); openNibForm(); break;
      default: break;
    }
  }

  function init() {
    document.querySelectorAll('dialog').forEach(wireDialog);

    $('#view-main').addEventListener('click', onMainClick);
    $('#dlg-doc-body').addEventListener('click', onDocDialogClick);
    $('#dlg-doc').addEventListener('close', () => { currentDocId = null; });
    $('#dlg-preview').addEventListener('close', () => { revokePreview(); $('#preview-stage').innerHTML = ''; previewDocId = null; });
    $('#btn-preview-download').addEventListener('click', () => { if (previewDocId) downloadDoc(previewDocId); });

    $('#form-nib').addEventListener('submit', submitNib);
    $('#f-nomor').addEventListener('input', (e) => {
      const cleaned = e.target.value.replace(/[^\d\s]/g, '');
      if (cleaned !== e.target.value) e.target.value = cleaned;
      updateNibCounter();
    });
    $('#form-add').addEventListener('submit', submitAddDoc);
    $('#add-choices').addEventListener('change', syncAddCustom);

    const btnGuide = $('#btn-open-guide');
    if (btnGuide) btnGuide.addEventListener('click', () => openDialog($('#dlg-guide')));

    const btnRetry = $('#btn-retry');
    if (btnRetry) btnRetry.addEventListener('click', load);

    const btnReset = $('#btn-reset');
    if (btnReset) btnReset.addEventListener('click', resetSource);

    const srcSelect = $('#source-select');
    if (srcSelect) {
      srcSelect.addEventListener('change', (e) => {
        S.setSource(e.target.value);
        load();
      });
    }

    const btnMobile = $('#btn-mobile-menu');
    if (btnMobile) btnMobile.addEventListener('click', () => setSidebar(true));

    const btnCloseSidebar = $('#btn-close-sidebar');
    if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', () => { setSidebar(false); if (btnMobile) btnMobile.focus(); });

    const backdrop = $('#sidebar-backdrop');
    if (backdrop) backdrop.addEventListener('click', () => setSidebar(false));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('#app-sidebar') && $('#app-sidebar').classList.contains('mobile-open')) {
        setSidebar(false);
        if (btnMobile) btnMobile.focus();
      }
    });

    renderSources();
    load();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

