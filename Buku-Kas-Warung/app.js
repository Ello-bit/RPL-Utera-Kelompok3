/**
 * UTERA SaaS Finansial UMKM — Buku Kas Warung Logic
 * Memadukan:
 * - Penyimpanan bersama (kas-store.js / localStorage)
 * - Grafik Area Laba Bersih Bulanan (Interaktif SVG dengan kurva Bezier halus & gradien emerald)
 * - Grafik Volume Arus Kas (Bar chart omzet/biaya)
 * - 2x2 Metric Grid (Rekap Kinerja Kas & Guardrail 30%)
 * - Lembar Transaksi & Pool Tabs (Filter cepat, pencarian, running balance)
 * - CRUD Transaksi lengkap dengan Undo Toast
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var Kas = window.UteraKas;
  var $ = function (id) { return document.getElementById(id); };

  // Elements
  var el = {
    // Month picker
    monthLabel: $('month-label'),
    prevMonth: $('btn-prev-month'),
    nextMonth: $('btn-next-month'),
    exportCsv: $('btn-export-csv'),
    miniExport: $('btn-mini-export'),
    notice: $('notice-region'),

    // Area Chart Elements
    chartProfitVal: $('chart-profit-val'),
    chartProfitTrend: $('chart-profit-trend'),
    chartProfitCaption: $('chart-profit-caption'),
    chartSvgContainer: $('chart-svg-container'),
    svgGridLines: $('svg-grid-lines'),
    svgAreaFill: $('svg-area-fill'),
    svgLineStroke: $('svg-line-stroke'),
    svgDataPoints: $('svg-data-points'),
    svgXLabels: $('svg-x-labels'),
    tooltip: $('chart-tooltip'),
    tooltipMonth: $('tooltip-month'),
    tooltipNet: $('tooltip-net'),
    tooltipIn: $('tooltip-in'),
    tooltipOut: $('tooltip-out'),

    // Volume Chart Elements
    chartVolumeVal: $('chart-volume-val'),
    volBarsContainer: $('volume-bars-container'),

    // 2x2 Metric Grid
    valRekapIncome: $('val-rekap-income'),
    valRekapExpense: $('val-rekap-expense'),
    valRekapMargin: $('val-rekap-margin'),
    valRekapGuardrail: $('val-rekap-guardrail'),

    // Ledger & Filter
    poolTabs: document.querySelectorAll('.pool-tab'),
    paginationInfo: $('ledger-pagination-info'),
    btnQuickCatat: $('btn-quick-catat'),
    filterSearch: $('filter-search'),
    globalSearch: $('global-search'),
    filterCategory: $('filter-category'),
    btnResetFilters: $('btn-reset-filters'),
    tableBody: $('ledger-table-body'),
    tableFoot: $('ledger-table-foot'),

    // Form
    entryPanel: $('entry-panel'),
    formTitle: $('form-entry-title'),
    form: $('entry-form'),
    typeIncome: $('label-type-income'),
    typeExpense: $('label-type-expense'),
    amount: $('input-amount'),
    wrapAmount: $('wrap-amount'),
    stepPlus: $('btn-step-plus'),
    stepMinus: $('btn-step-minus'),
    date: $('input-date'),
    wrapDate: $('wrap-date'),
    category: $('input-category'),
    note: $('input-note'),
    btnSubmit: $('btn-submit-tx'),
    btnCancel: $('btn-cancel-tx'),
    errAmount: $('err-amount'),
    errDate: $('err-date'),
    errCategory: $('err-category'),
    errForm: $('err-form'),

    // Toast
    toast: $('toast'),
    toastText: $('toast-text'),
    toastAction: $('toast-action'),

    // Sidebar & Mobile Nav
    sidebar: $('app-sidebar'),
    sidebarBackdrop: $('sidebar-backdrop'),
    btnMobileMenu: $('btn-mobile-menu'),
    btnCollapseSidebar: $('btn-collapse-sidebar'),
    sidebarBizName: $('sidebar-business-name'),
    sidebarBizBadge: $('sidebar-business-badge'),
    sidebarBizIcon: $('sidebar-biz-icon'),
    btnTopCatat: $('btn-top-catat'),

    // Dropdown Selectors
    cardBiz: $('card-dropdown-business'),
    menuBiz: $('menu-dropdown-business'),
    listBizOptions: $('list-business-options'),
    activeBizName: $('active-biz-name'),
    activeBizDesc: $('active-biz-desc'),
    activeBizIcon: $('active-biz-icon'),
    activeBizIconWrap: $('active-biz-icon-wrap'),
    btnAddBiz: $('btn-add-business'),

    cardWallet: $('card-dropdown-wallet'),
    menuWallet: $('menu-dropdown-wallet'),
    listWalletOptions: $('list-wallet-options'),
    activeWalletName: $('active-wallet-name'),
    activeWalletDesc: $('active-wallet-desc'),
    activeWalletIcon: $('active-wallet-icon'),
    activeWalletIconWrap: $('active-wallet-icon-wrap'),
    btnAddWallet: $('btn-add-wallet')
  };

  var today = new Date();
  var todayISO = Kas.toISODate(today);

  var state = {
    all: Kas.load(),
    year: today.getFullYear(),
    month: today.getMonth(), // 0-indexed (9 for October)
    chartRange: '6m',
    volRange: '7d',
    activeTab: 'all',
    searchQuery: '',
    categoryFilter: 'all',
    editingId: null,
    highlightId: null
  };

  // Multi-Usaha & Kantong Kas Data Model
  var businessProfiles = [
    {
      id: 'biz_kopi',
      name: 'Kopi Nusantara',
      desc: 'Usaha Aktif • UMKM Kuliner',
      icon: 'local_cafe',
      iconBg: 'bg-emerald-light',
      iconColor: 'text-emerald',
      omzet: 'Rp 24.85M'
    },
    {
      id: 'biz_sembako',
      name: 'Warung Sembako Barokah',
      desc: 'Cabang 2 • UMKM Ritel Sembako',
      icon: 'storefront',
      iconBg: 'bg-blue-light',
      iconColor: 'text-blue',
      omzet: 'Rp 16.20M'
    },
    {
      id: 'biz_katering',
      name: 'Dapur Katering Mama',
      desc: 'Usaha Rumahan • Katering Harian',
      icon: 'restaurant',
      iconBg: 'bg-gold-light',
      iconColor: 'text-gold',
      omzet: 'Rp 9.40M'
    }
  ];

  var walletAccounts = [
    {
      id: 'wal_operasional',
      name: 'Kas Operasional Warung',
      desc: 'Rekening & Kasir Utama',
      icon: 'account_balance_wallet',
      iconBg: 'bg-blue-light',
      iconColor: 'text-blue',
      saldo: 'Rp 18.450.000'
    },
    {
      id: 'wal_bri_kur',
      name: 'Tabungan Usaha (Bank BRI - KUR)',
      desc: 'No. Rek 0129-01-002341-50-8',
      icon: 'account_balance',
      iconBg: 'bg-emerald-light',
      iconColor: 'text-emerald',
      saldo: 'Rp 35.800.000'
    },
    {
      id: 'wal_petty_cash',
      name: 'Kas Kecil (Petty Cash)',
      desc: 'Uang Kembalian & Belanja Harian',
      icon: 'payments',
      iconBg: 'bg-gold-light',
      iconColor: 'text-gold',
      saldo: 'Rp 1.500.000'
    }
  ];

  var activeBizId = 'biz_kopi';
  var activeWalletId = 'wal_operasional';

  function getActiveBiz() {
    return businessProfiles.find(function (b) { return b.id === activeBizId; }) || businessProfiles[0];
  }

  function getActiveBizTransactions() {
    return state.all.filter(function (tx) {
      return (tx.bizId || 'biz_kopi') === activeBizId;
    });
  }

  function computeBizMonthOmzet(bizId) {
    var curKey = monthKey(state.year, state.month);
    var sum = 0;
    state.all.forEach(function (tx) {
      if ((tx.bizId || 'biz_kopi') === bizId && tx.type === 'income' && tx.date.slice(0, 7) === curKey) {
        sum += tx.amount;
      }
    });
    return sum;
  }

  function renderBusinessOptions() {
    if (!el.listBizOptions) return;
    el.listBizOptions.innerHTML = businessProfiles.map(function (biz) {
      var isSelected = biz.id === activeBizId;
      var curOmzet = computeBizMonthOmzet(biz.id);
      var omzetText = curOmzet > 0 ? (' • Omzet: ' + formatCompactRupiah(curOmzet)) : '';
      return '<li class="dropdown-item' + (isSelected ? ' is-selected' : '') + '" data-biz-id="' + biz.id + '">' +
               '<div class="dropdown-item-icon ' + biz.iconBg + '">' +
                 '<span class="material-symbols-rounded ' + biz.iconColor + '">' + biz.icon + '</span>' +
               '</div>' +
               '<div class="dropdown-item-info">' +
                 '<span class="dropdown-item-title">' + escapeHtml(biz.name) + '</span>' +
                 '<span class="dropdown-item-meta">' + escapeHtml(biz.desc) + omzetText + '</span>' +
               '</div>' +
               (isSelected ? '<span class="material-symbols-rounded dropdown-item-check">check</span>' : '') +
             '</li>';
    }).join('');
  }

  function renderWalletOptions() {
    if (!el.listWalletOptions) return;
    el.listWalletOptions.innerHTML = walletAccounts.map(function (wal) {
      var isSelected = wal.id === activeWalletId;
      return '<li class="dropdown-item' + (isSelected ? ' is-selected' : '') + '" data-wal-id="' + wal.id + '">' +
               '<div class="dropdown-item-icon ' + wal.iconBg + '">' +
                 '<span class="material-symbols-rounded ' + wal.iconColor + '">' + wal.icon + '</span>' +
               '</div>' +
               '<div class="dropdown-item-info">' +
                 '<span class="dropdown-item-title">' + escapeHtml(wal.name) + '</span>' +
                 '<span class="dropdown-item-meta">' + escapeHtml(wal.desc) + '</span>' +
               '</div>' +
               (isSelected ? '<span class="material-symbols-rounded dropdown-item-check">check</span>' : '') +
             '</li>';
    }).join('');
  }

  function selectBusiness(bizId) {
    var found = businessProfiles.find(function (b) { return b.id === bizId; });
    if (!found) return;
    activeBizId = bizId;
    el.activeBizName.textContent = found.name;
    el.activeBizDesc.textContent = found.desc;
    el.activeBizIcon.textContent = found.icon;
    el.activeBizIcon.className = 'material-symbols-rounded ' + found.iconColor;
    el.activeBizIconWrap.className = 'selector-icon-wrap ' + found.iconBg;
    if (el.sidebarBizName) el.sidebarBizName.textContent = found.name;
    if (el.sidebarBizBadge) el.sidebarBizBadge.textContent = found.desc.split('•')[1] ? found.desc.split('•')[1].trim() : 'UMKM Mandiri';
    if (el.sidebarBizIcon) el.sidebarBizIcon.textContent = found.icon;
    closeAllDropdowns();
    renderBusinessOptions();
    if (!state.editingId) {
      el.formTitle.textContent = 'Catat Transaksi Kas (' + found.name + ')';
    }
    renderAllViews();
    showToast('Beralih ke profil usaha: ' + found.name);
  }

  function selectWallet(walId) {
    var found = walletAccounts.find(function (w) { return w.id === walId; });
    if (!found) return;
    activeWalletId = walId;
    el.activeWalletName.textContent = found.name;
    el.activeWalletDesc.textContent = found.desc;
    el.activeWalletIcon.textContent = found.icon;
    el.activeWalletIcon.className = 'material-symbols-rounded ' + found.iconColor;
    el.activeWalletIconWrap.className = 'selector-icon-wrap ' + found.iconBg;
    closeAllDropdowns();
    renderWalletOptions();
    showToast('Beralih ke rekening kas: ' + found.name);
  }

  function closeAllDropdowns() {
    if (el.menuBiz) { el.menuBiz.hidden = true; el.cardBiz.classList.remove('is-open'); el.cardBiz.setAttribute('aria-expanded', 'false'); }
    if (el.menuWallet) { el.menuWallet.hidden = true; el.cardWallet.classList.remove('is-open'); el.cardWallet.setAttribute('aria-expanded', 'false'); }
  }

  function toggleDropdown(card, menu) {
    var isOpen = !menu.hidden;
    closeAllDropdowns();
    if (!isOpen) {
      menu.hidden = false;
      card.classList.add('is-open');
      card.setAttribute('aria-expanded', 'true');
    }
  }

  if (el.cardBiz && el.menuBiz) {
    el.cardBiz.addEventListener('click', function (e) {
      if (e.target.closest('#menu-dropdown-business')) return;
      toggleDropdown(el.cardBiz, el.menuBiz);
    });
  }

  if (el.cardWallet && el.menuWallet) {
    el.cardWallet.addEventListener('click', function (e) {
      if (e.target.closest('#menu-dropdown-wallet')) return;
      toggleDropdown(el.cardWallet, el.menuWallet);
    });
  }

  if (el.listBizOptions) {
    el.listBizOptions.addEventListener('click', function (e) {
      var item = e.target.closest('li[data-biz-id]');
      if (item) {
        selectBusiness(item.getAttribute('data-biz-id'));
      }
    });
  }

  if (el.listWalletOptions) {
    el.listWalletOptions.addEventListener('click', function (e) {
      var item = e.target.closest('li[data-wal-id]');
      if (item) {
        selectWallet(item.getAttribute('data-wal-id'));
      }
    });
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('#card-dropdown-business') && !e.target.closest('#card-dropdown-wallet')) {
      closeAllDropdowns();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAllDropdowns();
  });

  if (el.btnAddBiz) {
    el.btnAddBiz.addEventListener('click', function (e) {
      e.stopPropagation();
      var name = prompt('Masukkan nama usaha UMKM baru:', 'Kedai Kopi Barokah');
      if (name && name.trim()) {
        var newBiz = {
          id: 'biz_' + Date.now(),
          name: name.trim(),
          desc: 'Usaha Baru • Terdaftar',
          icon: 'storefront',
          iconBg: 'bg-emerald-light',
          iconColor: 'text-emerald',
          omzet: 'Rp 0'
        };
        businessProfiles.push(newBiz);
        selectBusiness(newBiz.id);
      }
    });
  }

  if (el.btnAddWallet) {
    el.btnAddWallet.addEventListener('click', function (e) {
      e.stopPropagation();
      var name = prompt('Masukkan nama rekening atau kantong kas baru:', 'Kas Tabungan Mandiri');
      if (name && name.trim()) {
        var newWal = {
          id: 'wal_' + Date.now(),
          name: name.trim(),
          desc: 'Rekening Kas Tambahan',
          icon: 'account_balance_wallet',
          iconBg: 'bg-blue-light',
          iconColor: 'text-blue',
          saldo: 'Rp 0'
        };
        walletAccounts.push(newWal);
        selectWallet(newWal.id);
      }
    });
  }

  /* ==========================================================================
     HELPERS & FORMATTERS
     ========================================================================== */

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function monthKey(y, m) {
    return y + '-' + String(m + 1).padStart(2, '0');
  }

  function monthName(y, m) {
    return new Date(y, m, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }

  function shortMonthName(y, m) {
    return new Date(y, m, 1).toLocaleDateString('id-ID', { month: 'short' });
  }

  function parseISO(iso) {
    var p = iso.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function formatShortDate(iso) {
    return parseISO(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }

  function formatCompactRupiah(num) {
    var abs = Math.abs(num);
    if (abs >= 1000000000) {
      return (num / 1000000000).toFixed(1).replace('.0', '') + 'M';
    }
    if (abs >= 1000000) {
      return (num / 1000000).toFixed(2).replace('.00', '') + ' Jt';
    }
    return Kas.formatRupiah(num);
  }

  function digitsOnly(v) {
    return String(v).replace(/\D/g, '').replace(/^0+/, '').slice(0, 12);
  }

  /* ==========================================================================
     CATEGORY DROPDOWN OPTIONS
     ========================================================================== */

  function fillFormCategories(type, selected) {
    var list = Kas.CATEGORIES[type] || [];
    el.category.innerHTML = '<option value="">Pilih Kategori</option>' + list.map(function (c) {
      return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
    }).join('');
    if (selected && list.indexOf(selected) !== -1) {
      el.category.value = selected;
    }
  }

  function fillFilterCategories() {
    var all = Kas.CATEGORIES.income.concat(Kas.CATEGORIES.expense);
    el.filterCategory.innerHTML = '<option value="all">Semua Kategori</option>' + all.map(function (c) {
      return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
    }).join('');
  }

  /* ==========================================================================
     1. DYNAMIC SVG AREA CHART (LABA BERSIH BULANAN)
     ========================================================================== */

  function computeMonthlySeries(range) {
    var monthsCount = 6;
    if (range === '1m') monthsCount = 1;
    else if (range === '3m') monthsCount = 3;
    else if (range === '6m') monthsCount = 6;
    else if (range === '1y') monthsCount = 12;
    else if (range === 'all') monthsCount = 18;

    var series = [];
    var curYear = state.year;
    var curMonth = state.month;
    var bizTxs = getActiveBizTransactions();

    for (var i = monthsCount - 1; i >= 0; i--) {
      var d = new Date(curYear, curMonth - i, 1);
      var y = d.getFullYear();
      var m = d.getMonth();
      var key = monthKey(y, m);

      var monthIncome = 0;
      var monthExpense = 0;

      bizTxs.forEach(function (tx) {
        if (tx.date.slice(0, 7) === key) {
          if (tx.type === 'income') monthIncome += tx.amount;
          else monthExpense += tx.amount;
        }
      });

      var net = monthIncome - monthExpense;
      series.push({
        year: y,
        month: m,
        key: key,
        label: shortMonthName(y, m),
        fullLabel: monthName(y, m),
        income: monthIncome,
        expense: monthExpense,
        net: net
      });
    }

    return series;
  }

  function renderAreaChart() {
    var series = computeMonthlySeries(state.chartRange);
    if (!series.length) return;

    var svgW = 760;
    var svgH = 220;
    var padLeft = 45;
    var padRight = 30;
    var padTop = 24;
    var padBottom = 38;

    var chartW = svgW - padLeft - padRight;
    var chartH = svgH - padTop - padBottom;

    // Determine Min & Max Net Values
    var maxVal = 0;
    var minVal = 0;
    series.forEach(function (s) {
      if (s.net > maxVal) maxVal = s.net;
      if (s.net < minVal) minVal = s.net;
    });

    // Provide headroom
    if (maxVal === 0) maxVal = 10000000;
    maxVal = Math.ceil(maxVal * 1.15);
    minVal = Math.min(0, Math.floor(minVal * 1.15));
    var valRange = (maxVal - minVal) || 1;

    // Grid lines (3 horizontal levels)
    var gridHtml = '';
    var gridLevels = [0, 0.5, 1];
    gridLevels.forEach(function (lvl) {
      var val = minVal + valRange * lvl;
      var y = padTop + chartH * (1 - lvl);
      gridHtml += '<line x1="' + padLeft + '" y1="' + y + '" x2="' + (svgW - padRight) + '" y2="' + y + '" class="chart-grid-line" />' +
                  '<text x="' + (padLeft - 8) + '" y="' + (y + 4) + '" text-anchor="end" class="chart-grid-label">' + formatCompactRupiah(val) + '</text>';
    });
    el.svgGridLines.innerHTML = gridHtml;

    // Calculate Points coordinates
    var pts = series.map(function (s, idx) {
      var x = padLeft + (series.length === 1 ? chartW / 2 : (idx / (series.length - 1)) * chartW);
      var norm = (s.net - minVal) / valRange;
      var y = padTop + chartH * (1 - norm);
      return { x: x, y: y, data: s };
    });

    // Generate Smooth Spline Path (Catmull-Rom to Cubic Bezier)
    var dLine = '';
    if (pts.length === 1) {
      dLine = 'M ' + padLeft + ' ' + pts[0].y + ' L ' + (svgW - padRight) + ' ' + pts[0].y;
    } else {
      dLine = 'M ' + pts[0].x + ' ' + pts[0].y;
      for (var i = 0; i < pts.length - 1; i++) {
        var p0 = i > 0 ? pts[i - 1] : pts[i];
        var p1 = pts[i];
        var p2 = pts[i + 1];
        var p3 = (i < pts.length - 2) ? pts[i + 2] : p2;

        var cp1x = p1.x + (p2.x - p0.x) / 6;
        var cp1y = p1.y + (p2.y - p0.y) / 6;
        var cp2x = p2.x - (p3.x - p1.x) / 6;
        var cp2y = p2.y - (p3.y - p1.y) / 6;

        dLine += ' C ' + cp1x.toFixed(1) + ' ' + cp1y.toFixed(1) + ', ' + cp2x.toFixed(1) + ' ' + cp2y.toFixed(1) + ', ' + p2.x.toFixed(1) + ' ' + p2.y.toFixed(1);
      }
    }

    // Closed Area Path
    var baseY = padTop + chartH;
    var dArea = dLine + ' L ' + pts[pts.length - 1].x + ' ' + baseY + ' L ' + pts[0].x + ' ' + baseY + ' Z';

    el.svgLineStroke.setAttribute('d', dLine);
    el.svgAreaFill.setAttribute('d', dArea);

    // X-Axis Labels & Data Points
    var xLabelsHtml = '';
    var dotsHtml = '';

    pts.forEach(function (pt, idx) {
      xLabelsHtml += '<text x="' + pt.x + '" y="' + (svgH - 12) + '" class="chart-x-label">' + pt.data.label + '</text>';
      dotsHtml += '<circle cx="' + pt.x + '" cy="' + pt.y + '" r="4.5" class="chart-data-dot" data-idx="' + idx + '"></circle>';
    });

    el.svgXLabels.innerHTML = xLabelsHtml;
    el.svgDataPoints.innerHTML = dotsHtml;

    // Update Big Metric on Header to Current Month's Value
    var activeMonthData = series[series.length - 1];
    var activeBiz = getActiveBiz();
    if (activeMonthData) {
      el.chartProfitVal.textContent = Kas.formatRupiah(activeMonthData.net);
      el.chartProfitCaption.textContent = activeMonthData.fullLabel + ' • Laba bersih terakumulasi ' + escapeHtml(activeBiz.name);

      if (el.chartProfitTrend && series.length >= 2) {
        var prevMonthData = series[series.length - 2];
        var diff = activeMonthData.net - prevMonthData.net;
        var pct = prevMonthData.net !== 0
          ? Math.round((Math.abs(diff) / Math.abs(prevMonthData.net)) * 100)
          : (activeMonthData.net > 0 ? 100 : 0);

        if (diff >= 0) {
          el.chartProfitTrend.innerHTML = '<span class="material-symbols-rounded">trending_up</span><span>+' + pct + '% tren positif</span>';
          el.chartProfitTrend.className = 'trend-badge-positive';
        } else {
          el.chartProfitTrend.innerHTML = '<span class="material-symbols-rounded">trending_down</span><span>-' + pct + '% defisit laba</span>';
          el.chartProfitTrend.className = 'trend-badge-negative';
        }
      }
    }

    // Attach Hover Handlers to Data Dots
    el.svgDataPoints.querySelectorAll('.chart-data-dot').forEach(function (dot) {
      dot.addEventListener('mouseenter', function (e) {
        var idx = Number(e.target.getAttribute('data-idx'));
        var pt = pts[idx];
        if (!pt) return;

        el.svgDataPoints.querySelectorAll('.chart-data-dot').forEach(function (d) { d.classList.remove('is-active'); });
        e.target.classList.add('is-active');

        el.tooltipMonth.textContent = pt.data.fullLabel;
        el.tooltipNet.textContent = Kas.formatRupiah(pt.data.net);
        el.tooltipIn.textContent = formatCompactRupiah(pt.data.income);
        el.tooltipOut.textContent = formatCompactRupiah(pt.data.expense);

        // Position tooltip relative to container
        var rect = el.chartSvgContainer.getBoundingClientRect();
        var posX = (pt.x / svgW) * rect.width;
        el.tooltip.style.left = posX + 'px';
        el.tooltip.style.top = '10px';
        el.tooltip.hidden = false;
      });
    });

    el.chartSvgContainer.addEventListener('mouseleave', function () {
      el.tooltip.hidden = true;
      el.svgDataPoints.querySelectorAll('.chart-data-dot').forEach(function (d) { d.classList.remove('is-active'); });
    });
  }

  /* ==========================================================================
     2. DYNAMIC VOLUME CASHFLOW BAR CHART
     ========================================================================== */

  function renderVolumeChart() {
    if (!el.volBarsContainer) return;

    var bizTxs = getActiveBizTransactions();
    var barsData = [];
    var totalVol = 0;

    // Use recent transactions or 12 segments
    for (var i = 11; i >= 0; i--) {
      var d = new Date(state.year, state.month, 28 - i * 2);
      var dayIso = Kas.toISODate(d);
      var vol = 0;

      bizTxs.forEach(function (tx) {
        if (tx.date === dayIso || (i === 0 && tx.date.slice(0, 7) === monthKey(state.year, state.month))) {
          vol += tx.amount;
        }
      });

      // Reasonable placeholder volume if sparse
      if (vol === 0) {
        var baseSeed = bizTxs.reduce(function (acc, t) { return acc + t.amount; }, 0) / (bizTxs.length || 1);
        vol = Math.round((baseSeed * 0.35) + (Math.sin(i * 1.2) * (baseSeed * 0.2)));
        if (vol < 0) vol = 400000;
      }

      totalVol += vol;
      barsData.push({
        label: d.getDate() + ' ' + shortMonthName(d.getFullYear(), d.getMonth()),
        vol: vol
      });
    }

    var maxVol = Math.max.apply(null, barsData.map(function (b) { return b.vol; })) || 1;

    el.volBarsContainer.innerHTML = barsData.map(function (b, idx) {
      var pct = Math.round((b.vol / maxVol) * 88);
      var isPeak = pct >= 80;
      return '<div class="vol-bar-col' + (isPeak ? ' is-peak' : '') + '" title="' + b.label + ': ' + Kas.formatRupiah(b.vol) + '">' +
               '<div class="vol-bar-fill" style="height: ' + pct + '%;"></div>' +
               '<span class="vol-bar-date">' + (idx % 2 === 0 ? b.label.split(' ')[0] : '') + '</span>' +
             '</div>';
    }).join('');

    // Update Volume Total on Header
    if (el.chartVolumeVal) {
      var activeMonthIncome = 0;
      var curKey = monthKey(state.year, state.month);
      bizTxs.forEach(function (tx) {
        if (tx.date.slice(0, 7) === curKey && tx.type === 'income') {
          activeMonthIncome += tx.amount;
        }
      });
      el.chartVolumeVal.textContent = Kas.formatRupiah(activeMonthIncome || totalVol);
    }
  }

  /* ==========================================================================
     3. 2x2 COMMISSION METRIC GRID
     ========================================================================== */

  function render2x2Grid(monthIncome, monthExpense) {
    var net = monthIncome - monthExpense;
    var margin = monthIncome > 0 ? ((net / monthIncome) * 100).toFixed(1) : '0.0';
    var guardrail30 = Math.round(net * 0.30);

    if (el.valRekapIncome) el.valRekapIncome.textContent = formatCompactRupiah(monthIncome);
    if (el.valRekapExpense) el.valRekapExpense.textContent = formatCompactRupiah(monthExpense);
    if (el.valRekapMargin) el.valRekapMargin.textContent = margin + '%';
    if (el.valRekapGuardrail) el.valRekapGuardrail.textContent = formatCompactRupiah(guardrail30);
  }

  /* ==========================================================================
     4. TRANSACTIONS LEDGER TABLE (WITH RUNNING SALDO)
     ========================================================================== */

  function renderLedgerTable() {
    var key = monthKey(state.year, state.month);
    var label = monthName(state.year, state.month);
    var activeBiz = getActiveBiz();

    el.monthLabel.textContent = label;

    var bizTxs = getActiveBizTransactions();
    var sorted = Kas.sortLedger(bizTxs);
    var carry = 0;
    var hasEarlier = false;
    var monthRows = [];

    sorted.forEach(function (tx) {
      var k = tx.date.slice(0, 7);
      if (k < key) {
        carry += (tx.type === 'income' ? tx.amount : -tx.amount);
        hasEarlier = true;
      } else if (k === key) {
        monthRows.push(tx);
      }
    });

    // Compute running balance
    var running = carry;
    var totalIn = 0;
    var totalOut = 0;
    var saldoMap = {};

    monthRows.forEach(function (tx) {
      if (tx.type === 'income') {
        running += tx.amount;
        totalIn += tx.amount;
      } else {
        running -= tx.amount;
        totalOut += tx.amount;
      }
      saldoMap[tx.id] = running;
    });

    // Update 2x2 grid with month totals
    render2x2Grid(totalIn, totalOut);

    // Apply Filter & Search
    var q = state.searchQuery.toLowerCase();
    var filtered = monthRows.filter(function (tx) {
      // Pool Tab Filter
      if (state.activeTab === 'income' && tx.type !== 'income') return false;
      if (state.activeTab === 'expense' && tx.type !== 'expense') return false;
      if (state.activeTab === 'kulakan' && !tx.category.toLowerCase().includes('bahan')) return false;
      if (state.activeTab === 'operasional' && !tx.category.toLowerCase().includes('operasional')) return false;

      // Category Dropdown Filter
      if (state.categoryFilter !== 'all' && tx.category !== state.categoryFilter) return false;

      // Text Search
      if (q && !(tx.note || '').toLowerCase().includes(q) && !tx.category.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });

    // Update Pagination / Row Count
    if (el.paginationInfo) {
      el.paginationInfo.textContent = 'Menampilkan ' + filtered.length + ' dari ' + monthRows.length + ' transaksi (' + activeBiz.name + ')';
    }

    // Empty state
    if (filtered.length === 0) {
      el.tableBody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 36px 16px; color: var(--slate-400);">' +
        (monthRows.length === 0 ? 'Belum ada transaksi di ' + label + ' untuk usaha ' + escapeHtml(activeBiz.name) + '. Silakan catat transaksi baru.' : 'Tidak ada transaksi yang cocok dengan filter.') +
        '</td></tr>';
      el.tableFoot.innerHTML = '';
      return;
    }

    var rowsHtml = '';

    // Carry-over row from previous month if not filtering
    if (state.activeTab === 'all' && state.categoryFilter === 'all' && !q && hasEarlier) {
      rowsHtml += '<tr style="background-color: var(--slate-50); font-style: italic; color: var(--slate-500);">' +
                    '<td></td>' +
                    '<td><strong>Saldo Bawaan Bulan Sebelumnya</strong></td>' +
                    '<td><span class="badge-cat-pill">Saldo Awal</span></td>' +
                    '<td></td><td></td>' +
                    '<td class="text-right font-bold' + (carry < 0 ? ' text-terracotta' : '') + '">' + Kas.formatRupiah(carry) + '</td>' +
                    '<td></td>' +
                  '</tr>';
    }

    filtered.forEach(function (tx) {
      var isIn = tx.type === 'income';
      var saldo = saldoMap[tx.id];
      var isEditing = tx.id === state.editingId;
      var isNew = tx.id === state.highlightId;

      var dateDisplay = formatShortDate(tx.date);
      if (tx.date === todayISO) {
        dateDisplay += '<span class="badge-today">Hari ini</span>';
      }

      rowsHtml += '<tr class="' + (isEditing ? 'is-editing' : '') + '" data-id="' + tx.id + '">' +
        '<td>' + dateDisplay + '</td>' +
        '<td><strong>' + escapeHtml(tx.note || tx.category) + '</strong></td>' +
        '<td><span class="badge-cat-pill">' + escapeHtml(tx.category) + '</span></td>' +
        '<td class="text-right text-emerald font-semibold">' + (isIn ? '+ ' + Kas.formatRupiah(tx.amount) : '') + '</td>' +
        '<td class="text-right text-terracotta font-semibold">' + (!isIn ? '- ' + Kas.formatRupiah(tx.amount) : '') + '</td>' +
        '<td class="text-right font-bold' + (saldo < 0 ? ' text-terracotta' : '') + '">' + Kas.formatRupiah(saldo) + '</td>' +
        '<td class="text-center">' +
          '<button type="button" class="table-btn-action btn-edit" data-action="edit" title="Ubah transaksi">' +
            '<span class="material-symbols-rounded">edit</span>' +
          '</button>' +
          '<button type="button" class="table-btn-action btn-del" data-action="delete" title="Hapus transaksi">' +
            '<span class="material-symbols-rounded">delete</span>' +
          '</button>' +
        '</td>' +
      '</tr>';
    });

    el.tableBody.innerHTML = rowsHtml;

    // Render Table Foot (Totals)
    el.tableFoot.innerHTML = '<tr>' +
      '<td colspan="3"><strong>TOTAL BULAN INI</strong></td>' +
      '<td class="text-right text-emerald font-bold">+ ' + Kas.formatRupiah(totalIn) + '</td>' +
      '<td class="text-right text-terracotta font-bold">- ' + Kas.formatRupiah(totalOut) + '</td>' +
      '<td class="text-right font-bold' + (running < 0 ? ' text-terracotta' : '') + '">' + Kas.formatRupiah(running) + '</td>' +
      '<td></td>' +
    '</tr>';

    state.highlightId = null;
  }

  /* ==========================================================================
     5. CRUD FORM ACTIONS & VALIDATION
     ========================================================================== */

  function currentFormType() {
    var checked = el.form.querySelector('input[name="type"]:checked');
    return checked ? checked.value : 'income';
  }

  function setFormType(type) {
    if (type === 'income') {
      el.typeIncome.classList.add('is-active');
      el.typeExpense.classList.remove('is-active');
      el.form.querySelector('input[name="type"][value="income"]').checked = true;
    } else {
      el.typeExpense.classList.add('is-active');
      el.typeIncome.classList.remove('is-active');
      el.form.querySelector('input[name="type"][value="expense"]').checked = true;
    }
    fillFormCategories(type);
  }

  function resetForm() {
    el.form.reset();
    state.editingId = null;
    var activeBiz = getActiveBiz();
    el.formTitle.textContent = 'Catat Transaksi Kas (' + activeBiz.name + ')';
    el.btnSubmit.textContent = 'CATAT TRANSAKSI KAS';
    el.btnCancel.hidden = true;
    setFormType('income');
    el.date.value = todayISO;
    clearFormErrors();
  }

  function clearFormErrors() {
    el.errAmount.textContent = '';
    el.errDate.textContent = '';
    el.errCategory.textContent = '';
    el.errForm.textContent = '';
    el.wrapAmount.classList.remove('has-error');
    el.wrapDate.classList.remove('has-error');
  }

  function validateForm() {
    clearFormErrors();
    var hasError = false;

    var amt = Number(digitsOnly(el.amount.value));
    if (!amt || amt <= 0) {
      el.errAmount.textContent = 'Isi nominal transaksi lebih dari Rp 0.';
      el.wrapAmount.classList.add('has-error');
      hasError = true;
    }

    if (!el.date.value) {
      el.errDate.textContent = 'Pilih tanggal pembukuan kas.';
      el.wrapDate.classList.add('has-error');
      hasError = true;
    }

    if (!el.category.value) {
      el.errCategory.textContent = 'Pilih kategori transaksi.';
      hasError = true;
    }

    if (hasError) return null;

    return {
      type: currentFormType(),
      amount: amt,
      date: el.date.value,
      category: el.category.value,
      note: el.note.value.trim()
    };
  }

  function startEdit(id) {
    var tx = state.all.find(function (t) { return t.id === id; });
    if (!tx) return;

    state.editingId = id;
    setFormType(tx.type);
    fillFormCategories(tx.type, tx.category);

    el.amount.value = Number(tx.amount).toLocaleString('id-ID');
    el.date.value = tx.date;
    el.note.value = tx.note || '';

    el.formTitle.textContent = 'Ubah Transaksi Kas';
    el.btnSubmit.textContent = 'SIMPAN PERUBAHAN';
    el.btnCancel.hidden = false;

    el.entryPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    renderLedgerTable();
  }

  // Form Submission
  el.form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = validateForm();
    if (!data) return;

    var next;
    var savedId;
    var wasEditing = !!state.editingId;

    if (wasEditing) {
      savedId = state.editingId;
      next = state.all.map(function (t) {
        if (t.id === savedId) {
          return Object.assign({}, t, data, { updatedAt: Date.now() });
        }
        return t;
      });
    } else {
      savedId = Kas.newId();
      next = state.all.concat([Object.assign({
        id: savedId,
        bizId: activeBizId,
        walletId: activeWalletId,
        createdAt: Date.now()
      }, data)]);
    }

    if (!Kas.save(next)) {
      el.errForm.textContent = 'Gagal menyimpan ke penyimpanan browser.';
      return;
    }

    state.all = next;
    state.highlightId = savedId;

    // If transaction date is in different month, switch to it
    var d = parseISO(data.date);
    state.year = d.getFullYear();
    state.month = d.getMonth();

    resetForm();
    renderAllViews();
    showToast(wasEditing ? 'Perubahan transaksi disimpan.' : 'Transaksi kas berhasil dicatat.');
  });

  el.btnCancel.addEventListener('click', function () {
    resetForm();
    renderLedgerTable();
  });

  // Numeric step buttons
  el.stepPlus.addEventListener('click', function () {
    var cur = Number(digitsOnly(el.amount.value)) || 0;
    cur += 50000;
    el.amount.value = cur.toLocaleString('id-ID');
  });

  el.stepMinus.addEventListener('click', function () {
    var cur = Number(digitsOnly(el.amount.value)) || 0;
    if (cur >= 50000) cur -= 50000;
    el.amount.value = cur ? cur.toLocaleString('id-ID') : '';
  });

  // Amount input mask
  el.amount.addEventListener('input', function () {
    var d = digitsOnly(el.amount.value);
    el.amount.value = d ? Number(d).toLocaleString('id-ID') : '';
    if (d) el.errAmount.textContent = '';
  });

  // Type Radio Toggle Handlers
  el.typeIncome.addEventListener('click', function () { setFormType('income'); });
  el.typeExpense.addEventListener('click', function () { setFormType('expense'); });

  /* ==========================================================================
     6. TABLE ACTIONS (EDIT & DELETE WITH UNDO)
     ========================================================================== */

  el.tableBody.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-action]');
    if (!btn) return;

    var row = btn.closest('tr[data-id]');
    if (!row) return;

    var id = row.getAttribute('data-id');
    var action = btn.getAttribute('data-action');

    if (action === 'edit') {
      startEdit(id);
    } else if (action === 'delete') {
      deleteTransaction(id);
    }
  });

  function deleteTransaction(id) {
    var item = state.all.find(function (t) { return t.id === id; });
    if (!item) return;

    var next = state.all.filter(function (t) { return t.id !== id; });
    if (!Kas.save(next)) return;

    state.all = next;
    if (state.editingId === id) resetForm();

    renderAllViews();

    showToast('Transaksi dihapus.', function () {
      var restored = state.all.concat([item]);
      if (Kas.save(restored)) {
        state.all = restored;
        renderAllViews();
        showToast('Transaksi berhasil dikembalikan.');
      }
    });
  }

  /* ==========================================================================
     7. TOAST NOTIFICATIONS
     ========================================================================== */

  var toastTimer = null;
  var undoCallback = null;

  function showToast(msg, undoFn) {
    clearTimeout(toastTimer);
    el.toastText.textContent = msg;
    undoCallback = undoFn || null;
    el.toastAction.hidden = !undoFn;
    el.toast.hidden = false;
    toastTimer = setTimeout(function () {
      el.toast.hidden = true;
      undoCallback = null;
    }, undoFn ? 6000 : 3000);
  }

  el.toastAction.addEventListener('click', function () {
    el.toast.hidden = true;
    if (undoCallback) {
      undoCallback();
      undoCallback = null;
    }
  });

  /* ==========================================================================
     8. TIME FILTERS, POOL TABS & MONTH NAVIGATION
     ========================================================================== */

  // Area Chart Time Range Buttons
  document.querySelectorAll('.time-btn[data-range]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      document.querySelectorAll('.time-btn[data-range]').forEach(function (b) { b.classList.remove('is-active'); });
      e.target.classList.add('is-active');
      state.chartRange = e.target.getAttribute('data-range');
      renderAreaChart();
    });
  });

  // Volume Chart Time Range Buttons
  document.querySelectorAll('.time-btn[data-vol-range]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      document.querySelectorAll('.time-btn[data-vol-range]').forEach(function (b) { b.classList.remove('is-active'); });
      e.target.classList.add('is-active');
      state.volRange = e.target.getAttribute('data-vol-range');
      renderVolumeChart();
    });
  });

  // Pool Tabs
  el.poolTabs.forEach(function (tab) {
    tab.addEventListener('click', function (e) {
      el.poolTabs.forEach(function (t) { t.classList.remove('is-active'); });
      e.target.classList.add('is-active');
      state.activeTab = e.target.getAttribute('data-tab');
      renderLedgerTable();
    });
  });

  // Search Filters
  function onSearchChange(val) {
    state.searchQuery = val.trim();
    renderLedgerTable();
  }

  el.filterSearch.addEventListener('input', function (e) { onSearchChange(e.target.value); });
  if (el.globalSearch) {
    el.globalSearch.addEventListener('input', function (e) {
      el.filterSearch.value = e.target.value;
      onSearchChange(e.target.value);
    });
  }

  // Category Filter
  el.filterCategory.addEventListener('change', function (e) {
    state.categoryFilter = e.target.value;
    renderLedgerTable();
  });

  // Reset Filters Button
  el.btnResetFilters.addEventListener('click', function () {
    state.activeTab = 'all';
    state.searchQuery = '';
    state.categoryFilter = 'all';
    el.filterSearch.value = '';
    if (el.globalSearch) el.globalSearch.value = '';
    el.filterCategory.value = 'all';
    el.poolTabs.forEach(function (t) {
      t.classList.toggle('is-active', t.getAttribute('data-tab') === 'all');
    });
    renderLedgerTable();
  });

  // Month Navigation Buttons
  el.prevMonth.addEventListener('click', function () {
    state.month -= 1;
    if (state.month < 0) {
      state.month = 11;
      state.year -= 1;
    }
    renderAllViews();
  });

  el.nextMonth.addEventListener('click', function () {
    state.month += 1;
    if (state.month > 11) {
      state.month = 0;
      state.year += 1;
    }
    renderAllViews();
  });

  // Quick Catat Button (focuses form)
  el.btnQuickCatat.addEventListener('click', function () {
    el.entryPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    el.amount.focus();
  });

  // CSV Export
  function exportCsvFile() {
    var key = monthKey(state.year, state.month);
    var activeBiz = getActiveBiz();
    var sorted = Kas.sortLedger(getActiveBizTransactions());
    var saldo = 0;
    var lines = [];

    sorted.forEach(function (tx) {
      saldo += (tx.type === 'income' ? tx.amount : -tx.amount);
      if (tx.date.slice(0, 7) !== key) return;
      lines.push([
        tx.date,
        tx.type === 'income' ? 'Masuk' : 'Keluar',
        tx.category,
        tx.note || '',
        tx.type === 'income' ? tx.amount : '',
        tx.type === 'expense' ? tx.amount : '',
        saldo
      ]);
    });

    if (!lines.length) {
      showToast('Belum ada transaksi di ' + monthName(state.year, state.month) + ' untuk usaha ' + activeBiz.name + ' untuk diunduh.');
      return;
    }

    var csv = [['Tanggal', 'Tipe', 'Kategori', 'Keterangan', 'Pemasukan', 'Pengeluaran', 'Saldo']].concat(lines)
      .map(function (row) {
        return row.map(function (v) {
          var s = String(v);
          return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }).join(';');
      }).join('\r\n');

    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var sanitizedBiz = activeBiz.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    a.href = url;
    a.download = 'utera-kas-' + sanitizedBiz + '-' + key + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    showToast('File ' + a.download + ' berhasil diunduh.');
  }

  el.exportCsv.addEventListener('click', exportCsvFile);
  if (el.miniExport) el.miniExport.addEventListener('click', exportCsvFile);

  // Mobile Sidebar Drawer
  if (el.btnMobileMenu && el.sidebar) {
    el.btnMobileMenu.addEventListener('click', function () {
      el.sidebar.classList.add('mobile-open');
      if (el.sidebarBackdrop) el.sidebarBackdrop.classList.add('mobile-open');
    });

    if (el.sidebarBackdrop) {
      el.sidebarBackdrop.addEventListener('click', function () {
        el.sidebar.classList.remove('mobile-open');
        el.sidebarBackdrop.classList.remove('mobile-open');
      });
    }

    if (el.btnCollapseSidebar) {
      el.btnCollapseSidebar.addEventListener('click', function () {
        el.sidebar.classList.remove('mobile-open');
        if (el.sidebarBackdrop) el.sidebarBackdrop.classList.remove('mobile-open');
      });
    }
  }

  // Topbar quick "Catat Kas" button
  if (el.btnTopCatat) {
    el.btnTopCatat.addEventListener('click', function () {
      el.entryPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      el.amount.focus();
    });
  }

  /* ==========================================================================
     9. MASTER RENDER & BOOTSTRAP
     ========================================================================== */

  function renderAllViews() {
    renderAreaChart();
    renderVolumeChart();
    renderLedgerTable();
    renderBusinessOptions();
  }

  // Initial Form & Categories Setup
  fillFilterCategories();
  setFormType('income');
  el.date.value = todayISO;
  resetForm();
  renderBusinessOptions();
  renderWalletOptions();

  // Master Render
  renderAllViews();
});
