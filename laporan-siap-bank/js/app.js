/**
 * UTERA · Laporan Siap Bank
 * Application Controller: UI rendering, period filtering, live preview, and PDF generation.
 */
(function () {
  'use strict';

  const M = window.LaporanModels;
  const L = window.LaporanLogic;
  const S = window.LaporanService;

  let reportData = null;
  let activePeriodMonths = 6; // Standard 6 months recommended for banks/KUR

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function esc(val) {
    return String(val == null ? '' : val)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function icon(name, extra = '') {
    return `<span class="material-symbols-rounded ${extra}" aria-hidden="true">${name}</span>`;
  }

  /* ---------------- Toast Notification ---------------- */

  function toast(message, type = 'success') {
    const region = $('#toast-region');
    if (!region) return;
    const el = document.createElement('div');
    const icons = { success: 'check_circle', info: 'info', warning: 'warning', error: 'error' };
    el.className = `toast toast-${type}`;
    el.innerHTML = `${icon(icons[type] || 'info')}<span>${esc(message)}</span>`;
    region.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 220);
    }, 3200);
  }

  /* ---------------- Core Render Function ---------------- */

  function render() {
    if (!reportData) return;

    const { profile, transactions, legalitas } = reportData;

    // Filter transactions based on selected period
    const filteredTxs = L.filterTransactionsByPeriod(transactions, activePeriodMonths);
    const finSummary = L.computeFinancialSummary(filteredTxs);
    const score = L.calculatePrdScore(finSummary.monthlyList);

    // Assess readiness with active period data
    const readiness = L.assessReportReadiness({
      profile,
      transactions: filteredTxs,
      legalitas,
      score,
    });

    renderStatusBanner(readiness);
    renderPillarsChecklist(readiness);
    renderQuickStats(finSummary, score);
    renderDocumentPreview(profile, legalitas, finSummary, score);
    renderSidebarProfile(profile);
  }

  /* ---------------- Readiness Banner ---------------- */

  function renderStatusBanner(readiness) {
    const banner = $('#readiness-banner');
    if (!banner) return;

    const toneClasses = {
      green: 'tone-green',
      gold: 'tone-gold',
      red: 'tone-red',
    };

    const toneClass = toneClasses[readiness.badgeTone] || 'tone-green';
    const statusIcon = readiness.badgeTone === 'green' ? 'task_alt' : (readiness.badgeTone === 'gold' ? 'rule' : 'pending_actions');

    banner.className = `readiness-banner ${toneClass}`;
    banner.innerHTML = `
      <div class="readiness-main">
        <div class="readiness-icon-wrap">
          ${icon(statusIcon, 'readiness-icon')}
        </div>
        <div class="readiness-info">
          <div class="readiness-meta-row">
            <span class="readiness-kicker">Status Kesiapan Dokumen</span>
            <span class="readiness-badge ${readiness.badgeTone}">
              ${readiness.badgeLabel}
            </span>
          </div>
          <h2 class="readiness-heading">${readiness.badgeLabel} untuk Pengajuan Pembiayaan</h2>
          <p class="readiness-desc">${esc(readiness.summaryText)}</p>
        </div>
        <div class="readiness-actions">
          <button type="button" class="btn btn-primary" id="btn-download-pdf-top">
            ${icon('download')}
            <span>Unduh Laporan PDF</span>
          </button>
          <button type="button" class="btn btn-outline" id="btn-print-top">
            ${icon('print')}
            <span>Cetak Dokumen</span>
          </button>
        </div>
      </div>
      <div class="readiness-facets">
        <div class="facet-col">
          <span class="facet-label">Kelengkapan 4 Pilar</span>
          <strong class="facet-val">${readiness.completedCount} dari ${readiness.totalCount} Pilar Siap</strong>
          <div class="meter-bar">
            <span class="meter-fill" style="width: ${(readiness.completedCount / readiness.totalCount) * 100}%"></span>
          </div>
        </div>
        <div class="facet-col">
          <span class="facet-label">Periode Analisis Finansial</span>
          <strong class="facet-val">${activePeriodMonths} Bulan Terakhir (${finSummaryLabel()})</strong>
        </div>
        <div class="facet-col">
          <span class="facet-label">Kapasitas Cicilan Sehat (30% Arus Kas)</span>
          <strong class="facet-val text-primary" id="facet-guardrail-val">Menghitung...</strong>
        </div>
      </div>
    `;

    $('#btn-download-pdf-top')?.addEventListener('click', triggerPdfDownload);
    $('#btn-print-top')?.addEventListener('click', triggerPdfPrint);
  }

  function finSummaryLabel() {
    const p = M.REPORT_PERIODS.find((x) => x.months === activePeriodMonths);
    return p ? p.label : `${activePeriodMonths} Bulan`;
  }

  /* ---------------- 4 Pillars Checklist ---------------- */

  function renderPillarsChecklist(readiness) {
    const container = $('#pillars-checklist-grid');
    if (!container) return;

    container.innerHTML = readiness.checks.map((chk) => {
      const isOk = chk.isComplete;
      const statusIcon = isOk ? 'check_circle' : 'error_outline';
      const statusTone = isOk ? 'is-complete' : 'is-incomplete';
      const statusLabel = isOk ? 'Siap' : 'Perlu Dilengkapi';

      return `
        <div class="pillar-card ${statusTone}">
          <div class="pillar-card-header">
            <span class="pillar-status-icon ${isOk ? 'icon-ok' : 'icon-warn'}">
              ${icon(statusIcon)}
            </span>
            <div class="pillar-title-wrap">
              <strong class="pillar-title">${esc(chk.title)}</strong>
              <span class="pillar-badge ${isOk ? 'badge-ok' : 'badge-warn'}">${statusLabel}</span>
            </div>
          </div>
          <p class="pillar-note">${esc(chk.note)}</p>
          <div class="pillar-footer">
            <span class="pillar-desc">${esc(chk.description)}</span>
            ${!isOk ? `
              <a href="${chk.link}" class="btn btn-outline btn-sm pillar-action-btn">
                <span>${esc(chk.linkText)}</span>
                ${icon('arrow_forward')}
              </a>
            ` : `
              <a href="${chk.link}" class="btn-link pillar-link-done">
                <span>Lihat Data</span>
                ${icon('open_in_new')}
              </a>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  /* ---------------- Quick Stats Banner ---------------- */

  function renderQuickStats(finSummary, score) {
    const guardrailEl = $('#facet-guardrail-val');
    if (guardrailEl) {
      guardrailEl.textContent = `${L.formatRupiah(finSummary.guardrailMaxCicilan)} / bln`;
    }

    const statsGrid = $('#quick-stats-grid');
    if (!statsGrid) return;

    statsGrid.innerHTML = `
      <div class="stat-box">
        <span class="stat-label">Total Omzet (${activePeriodMonths} Bln)</span>
        <strong class="stat-value text-emerald">${L.formatRupiah(finSummary.totalPemasukan)}</strong>
        <span class="stat-sub">Rata-rata ${L.formatRupiah(finSummary.rataPemasukan)}/bln</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">Total Biaya Operasional</span>
        <strong class="stat-value text-terracotta">${L.formatRupiah(finSummary.totalPengeluaran)}</strong>
        <span class="stat-sub">Rata-rata ${L.formatRupiah(finSummary.rataPengeluaran)}/bln</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">Laba Bersih Usaha</span>
        <strong class="stat-value ${finSummary.labaBersih >= 0 ? 'text-primary' : 'text-red'}">
          ${L.formatRupiah(finSummary.labaBersih)}
        </strong>
        <span class="stat-sub">Margin Laba: ${(finSummary.marginLaba * 100).toFixed(1)}%</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">Skor Kelayakan (0–100)</span>
        <div class="stat-score-row">
          <strong class="stat-value score-val score-${score.tone}">${score.total}</strong>
          <span class="stat-badge badge-${score.tone}">${score.kategori}</span>
        </div>
        <span class="stat-sub">${score.komponen.k1_konsistensi.detail}</span>
      </div>
    `;
  }

  /* ---------------- Document A4 Preview Render ---------------- */

  function renderDocumentPreview(profile, legalitas, finSummary, score) {
    const previewContainer = $('#document-a4-stage');
    if (!previewContainer) return;

    const todayStr = L.formatDateIndo(new Date());
    const nibInfo = (legalitas && legalitas.nib) || {};
    const docsList = (legalitas && legalitas.dokumen) || [];

    // Monthly rows for financial table
    const tableRowsHtml = finSummary.monthlyList.map((m) => `
      <tr>
        <td class="td-month"><strong>${esc(m.label)}</strong></td>
        <td class="td-num tabular text-emerald">${L.formatRupiah(m.pemasukan)}</td>
        <td class="td-num tabular text-terracotta">${L.formatRupiah(m.pengeluaran)}</td>
        <td class="td-num tabular ${m.labaBersih >= 0 ? 'text-primary font-bold' : 'text-red'}">
          ${L.formatRupiah(m.labaBersih)}
        </td>
      </tr>
    `).join('');

    previewContainer.innerHTML = `
      <article class="doc-a4-sheet" id="printable-report">
        <!-- HEADER DOKUMEN -->
        <header class="doc-header">
          <div class="doc-brand">
            <div class="doc-logo-symbol">U</div>
            <div class="doc-brand-text">
              <h1 class="doc-app-name">UTERA</h1>
              <span class="doc-app-tag">Platform Pendamping Finansial &amp; Legalitas UMKM</span>
            </div>
          </div>
          <div class="doc-meta-right">
            <span class="doc-badge-official">DOKUMEN PENDUKUNG PEMBIAYAAN</span>
            <span class="doc-meta-item">No. Berkas: <strong>UTR/BANK/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/042</strong></span>
            <span class="doc-meta-item">Tanggal Terbit: <strong>${todayStr}</strong></span>
          </div>
        </header>

        <div class="doc-title-block">
          <h2 class="doc-main-title">LAPORAN KONDISI USAHA &amp; KELAYAKAN PEMBIAYAAN</h2>
          <p class="doc-main-sub">Disusun untuk persiapan pengajuan fasilitas kredit produktif (KUR / Koperasi Perbankan)</p>
        </div>

        <!-- BAGIAN 1: IDENTITAS & RINGKASAN USAHA -->
        <section class="doc-section">
          <div class="doc-section-head">
            <span class="sec-num">1</span>
            <h3 class="sec-title">Identitas dan Profil Usaha</h3>
          </div>
          <div class="doc-grid-2">
            <dl class="doc-dl">
              <div><dt>Nama Resmi Usaha</dt><dd><strong>${esc(profile.nama_usaha || 'Usaha Saya')}</strong></dd></div>
              <div><dt>Nama Pemilik / Pengelola</dt><dd>${esc(profile.nama_pemilik || 'Pemilik Usaha')}</dd></div>
              <div><dt>Sektor / Jenis Usaha</dt><dd>${esc(profile.jenis_usaha || 'Kuliner / Perdagangan')}</dd></div>
            </dl>
            <dl class="doc-dl">
              <div><dt>Tanggal Berdiri / Mulai Usaha</dt><dd>${L.formatDateIndo(profile.tanggal_mulai_usaha) || 'Belum diisi'}</dd></div>
              <div><dt>Kontak / No. Telepon</dt><dd>${esc(profile.nomor_telepon || 'Belum diisi')}</dd></div>
              <div><dt>Lokasi / Alamat Operasional</dt><dd class="doc-address">${esc(profile.alamat_usaha || 'Alamat operasional usaha')}</dd></div>
            </dl>
          </div>
        </section>

        <!-- BAGIAN 2: STATUS LEGALITAS & NIB -->
        <section class="doc-section">
          <div class="doc-section-head">
            <span class="sec-num">2</span>
            <h3 class="sec-title">Legalitas &amp; Dokumen Usaha</h3>
          </div>
          <div class="doc-legal-box">
            <div class="legal-row">
              <span class="legal-kicker">Nomor Induk Berusaha (NIB)</span>
              <strong class="legal-nib-num">${esc(nibInfo.nomor || '1234567890123')}</strong>
              <span class="legal-status-pill green">Terdaftar Resmi di OSS</span>
            </div>
            <div class="legal-sub-grid">
              <div><span>KBLI / Bidang Usaha:</span> <strong>${esc(nibInfo.kbli || '56103 Kedai Makanan & Minuman')}</strong></div>
              <div><span>Tanggal Pengesahan NIB:</span> <strong>${L.formatDateIndo(nibInfo.tanggal_terbit) || '15 Mei 2024'}</strong></div>
            </div>
          </div>

          <div class="doc-checklist-table-wrap">
            <table class="doc-mini-table">
              <thead>
                <tr>
                  <th>Jenis Dokumen</th>
                  <th>Nomor Dokumen</th>
                  <th>Masa Berlaku</th>
                  <th>Status Administrasi</th>
                </tr>
              </thead>
              <tbody>
                ${docsList.map((d) => `
                  <tr>
                    <td><strong>${esc(d.nama)}</strong></td>
                    <td class="tabular">${esc(d.nomor || 'Terdata')}</td>
                    <td>${d.berlaku_hingga ? L.formatDateIndo(d.berlaku_hingga) : 'Berlaku Permanen'}</td>
                    <td><span class="doc-pill-ok">Siap Dilampirkan</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>

        <!-- BAGIAN 3: KONDISI KEUANGAN -->
        <section class="doc-section">
          <div class="doc-section-head">
            <span class="sec-num">3</span>
            <h3 class="sec-title">Kondisi Keuangan (${activePeriodMonths} Bulan Terakhir)</h3>
          </div>

          <div class="doc-fin-highlight-grid">
            <div class="fin-kpi-card">
              <span class="kpi-label">Total Omzet Masuk</span>
              <strong class="kpi-amount text-emerald">${L.formatRupiah(finSummary.totalPemasukan)}</strong>
            </div>
            <div class="fin-kpi-card">
              <span class="kpi-label">Total Pengeluaran</span>
              <strong class="kpi-amount text-terracotta">${L.formatRupiah(finSummary.totalPengeluaran)}</strong>
            </div>
            <div class="fin-kpi-card highlight">
              <span class="kpi-label">Total Laba Bersih</span>
              <strong class="kpi-amount text-primary font-bold">${L.formatRupiah(finSummary.labaBersih)}</strong>
            </div>
            <div class="fin-kpi-card guardrail-card">
              <span class="kpi-label">Batas Aman Cicilan (30% Laba)</span>
              <strong class="kpi-amount text-primary">${L.formatRupiah(finSummary.guardrailMaxCicilan)}</strong>
              <span class="kpi-note">Maks. cicilan pinjaman bulanan yang sehat</span>
            </div>
          </div>

          <div class="doc-table-wrap">
            <table class="doc-table">
              <thead>
                <tr>
                  <th>Periode Bulan</th>
                  <th class="text-right">Pemasukan (Omzet)</th>
                  <th class="text-right">Pengeluaran Operasional</th>
                  <th class="text-right">Laba Bersih Arus Kas</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>RATA-RATA / BULAN</strong></td>
                  <td class="text-right tabular font-bold text-emerald">${L.formatRupiah(finSummary.rataPemasukan)}</td>
                  <td class="text-right tabular font-bold text-terracotta">${L.formatRupiah(finSummary.rataPengeluaran)}</td>
                  <td class="text-right tabular font-bold text-primary">${L.formatRupiah(finSummary.rataLabaBersih)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <!-- BAGIAN 4: ANALISIS KELAYAKAN USAHA -->
        <section class="doc-section">
          <div class="doc-section-head">
            <span class="sec-num">4</span>
            <h3 class="sec-title">Evaluasi Skor Kelayakan Usaha</h3>
          </div>
          <div class="score-summary-banner">
            <div class="score-digit-col">
              <span class="score-circle-badge ${score.tone}">${score.total}</span>
              <div class="score-meta">
                <strong class="score-cat-label">Kategori: ${score.kategori}</strong>
                <span class="score-scale">Rentang skor 0 - 100 (Standar Kelayakan UTERA)</span>
              </div>
            </div>
            <p class="score-desc-para">${esc(score.ringkasan)}</p>
          </div>

          <div class="score-indicators-grid">
            <div class="score-item">
              <div class="score-item-top">
                <span>Konsistensi Pembukuan</span>
                <strong>${score.komponen.k1_konsistensi.score}/30</strong>
              </div>
              <span class="score-item-sub">${score.komponen.k1_konsistensi.detail}</span>
            </div>
            <div class="score-item">
              <div class="score-item-top">
                <span>Tren Omzet Penjualan</span>
                <strong>${score.komponen.k2_tren.score}/25</strong>
              </div>
              <span class="score-item-sub">${score.komponen.k2_tren.detail}</span>
            </div>
            <div class="score-item">
              <div class="score-item-top">
                <span>Profitabilitas (Margin)</span>
                <strong>${score.komponen.k3_profitabilitas.score}/25</strong>
              </div>
              <span class="score-item-sub">${score.komponen.k3_profitabilitas.detail}</span>
            </div>
            <div class="score-item">
              <div class="score-item-top">
                <span>Stabilitas Arus Kas</span>
                <strong>${score.komponen.k4_stabilitas.score}/20</strong>
              </div>
              <span class="score-item-sub">${score.komponen.k4_stabilitas.detail}</span>
            </div>
          </div>
        </section>

        <!-- BAGIAN 5: REKOMENDASI & PENGESAHAN -->
        <section class="doc-section page-break-inside-avoid">
          <div class="doc-section-head">
            <span class="sec-num">5</span>
            <h3 class="sec-title">Rekomendasi Pembiayaan &amp; Pernyataan</h3>
          </div>
          <div class="doc-recommendations">
            <ul class="rec-list">
              <li>
                <strong>Kapasitas Pengajuan:</strong> Berdasarkan laba bersih rata-rata bulanan sebesar ${L.formatRupiah(finSummary.rataLabaBersih)}, batas kemampuan angsuran bulanan yang disarankan maksimal adalah <strong>${L.formatRupiah(finSummary.guardrailMaxCicilan)}</strong> agar likuiditas usaha tetap terjaga stabil.
              </li>
              <li>
                <strong>Fasilitas Pembiayaan yang Sesuai:</strong> Memenuhi kualifikasi administratif untuk program <strong>Kredit Usaha Rakyat (KUR Mikro / Kecil)</strong> atau Pinjaman Usaha Koperasi Produktif dengan tenor 12 sampai 36 bulan.
              </li>
              <li>
                <strong>Kelengkapan Berkas:</strong> Seluruh berkas identitas dan NIB siap dilampirkan bersama salinan rekening koran bank operasional usaha.
              </li>
            </ul>
          </div>

          <!-- Tanda Tangan & Otorisasi -->
          <div class="doc-signatures-row">
            <div class="sig-box">
              <span class="sig-title">Disusun secara mandiri oleh Pemilik Usaha:</span>
              <div class="sig-space"></div>
              <strong class="sig-name">${esc(profile.nama_pemilik || 'Pemilik Usaha')}</strong>
              <span class="sig-role">Pemilik / Penanggung Jawab Usaha</span>
            </div>
            <div class="sig-box text-right">
              <span class="sig-title">Platform Verifikasi Catatan Usaha:</span>
              <div class="sig-space sig-stamp-wrap">
                <span class="sig-stamp">TERCATAT DI UTERA</span>
              </div>
              <strong class="sig-name">UTERA (UMKM Sejahtera)</strong>
              <span class="sig-role">Sistem Pendamping Finansial UMKM</span>
            </div>
          </div>

          <!-- Disclaimer Wajib PRD -->
          <footer class="doc-disclaimer-box">
            <p><strong>Pernyataan Batasan Dokumen (Disclaimer):</strong></p>
            <p>${esc(M.DISCLAIMER_TEXT)}</p>
          </footer>
        </section>
      </article>
    `;
  }

  /* ---------------- PDF Export Actions ---------------- */

  function triggerPdfDownload() {
    toast('Menyiapkan dokumen PDF (laporan-siap-bank.pdf)...', 'info');
    
    // Set document title so browser print dialog default filename is exactly "laporan-siap-bank.pdf"
    const oldTitle = document.title;
    document.title = 'laporan-siap-bank';

    setTimeout(() => {
      window.print();
      // Restore page title after printing
      setTimeout(() => {
        document.title = oldTitle;
      }, 1000);
    }, 250);
  }

  function triggerPdfPrint() {
    triggerPdfDownload();
  }

  /* ---------------- Event Listeners & Init ---------------- */

  function renderSidebarProfile(profile) {
    const name = (profile && profile.nama_usaha) || 'Profil Usaha';
    const sideEl = $('#sidebar-business-name');
    if (sideEl) sideEl.textContent = name;
    const words = name.trim().split(/\s+/);
    const initEl = $('#sidebar-initials');
    if (initEl) initEl.textContent = (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
  }

  function attachPeriodFilterHandlers() {
    const buttons = $$('.period-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activePeriodMonths = Number(btn.dataset.months) || 6;
        render();
        toast(`Periode diubah: ${btn.textContent.trim()}`, 'info');
      });
    });
  }

  function attachViewTabHandlers() {
    const tabButtons = $$('.view-tab-btn');
    const viewDashboard = $('#view-tab-dashboard');
    const viewPreview = $('#view-tab-preview');

    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const targetTab = btn.dataset.tab;

        if (targetTab === 'preview') {
          if (viewDashboard) viewDashboard.hidden = true;
          if (viewPreview) viewPreview.hidden = false;
        } else {
          if (viewDashboard) viewDashboard.hidden = false;
          if (viewPreview) viewPreview.hidden = true;
        }
      });
    });
  }

  function setSidebar(open) {
    $('#app-sidebar')?.classList.toggle('mobile-open', open);
    const backdrop = $('#sidebar-backdrop');
    if (backdrop) backdrop.hidden = !open;
    $('#btn-mobile-menu')?.setAttribute('aria-expanded', String(open));
  }

  async function init() {
    try {
      reportData = await S.loadAllReportData();
    } catch (e) {
      console.warn('[Laporan] Error loading data, using seed fallback', e);
    }

    attachPeriodFilterHandlers();
    attachViewTabHandlers();

    // Mobile sidebar
    $('#btn-mobile-menu')?.addEventListener('click', () => setSidebar(true));
    $('#btn-close-sidebar')?.addEventListener('click', () => setSidebar(false));
    $('#sidebar-backdrop')?.addEventListener('click', () => setSidebar(false));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('#app-sidebar')?.classList.contains('mobile-open')) {
        setSidebar(false);
      }
    });

    // Primary action buttons
    $('#btn-download-pdf-main')?.addEventListener('click', triggerPdfDownload);
    $('#btn-print-main')?.addEventListener('click', triggerPdfPrint);
    $('#btn-preview-switch')?.addEventListener('click', () => {
      const tabPreviewBtn = $('.view-tab-btn[data-tab="preview"]');
      if (tabPreviewBtn) tabPreviewBtn.click();
    });

    render();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

