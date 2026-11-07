/**
 * UTERA — SKOR KELAYAKAN USAHA
 * Fintech-grade UI/UX Controller (Stripe, Linear, Ramp inspired)
 * 
 * Strict PRD Scoring Formula:
 * Skor = 30 * (B_catat / 6) + 
 *        25 * min(1, R_baru / R_lama) + 
 *        25 * min(1, max(0, M) / 0.20) + 
 *        20 * (B_laba / 6)
 * 
 * Batas Guardrail Cicilan: <= 30% dari rata-rata laba bersih 6 bulan terakhir
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // --- STATE ---
  var state = {
    activeBizId: localStorage.getItem('utera_active_business_id') || 'biz-1',
    chartViewMode: 'cashflow', // 'cashflow' | 'score'
    businesses: [
      { id: 'biz-1', name: 'Warung Kopi Nusantara', sector: 'Kuliner & Kopi (F&B)', baselineScore: 84 },
      { id: 'biz-2', name: 'Toko Kelontong Berkah', sector: 'Ritel Sembako & Kebutuhan Pokok', baselineScore: 78 },
      { id: 'biz-3', name: 'Laundry Kilat Sejahtera', sector: 'Jasa Binatu & Setrika', baselineScore: 68 }
    ],
    // Baseline 6-Month Historical Finansial (Mei 2026 - Oktober 2026)
    mockHistory: {
      'biz-1': [
        { month: 'Mei', fullMonth: 'Mei 2026', income: 21500000, expense: 15800000, txCount: 42, score: 72 },
        { month: 'Jun', fullMonth: 'Juni 2026', income: 23200000, expense: 16400000, txCount: 48, score: 75 },
        { month: 'Jul', fullMonth: 'Juli 2026', income: 22800000, expense: 16100000, txCount: 51, score: 77 },
        { month: 'Agu', fullMonth: 'Agustus 2026', income: 24100000, expense: 16900000, txCount: 55, score: 79 },
        { month: 'Sep', fullMonth: 'September 2026', income: 25400000, expense: 17200000, txCount: 58, score: 80 },
        { month: 'Okt', fullMonth: 'Oktober 2026', income: 26850000, expense: 17850000, txCount: 64, score: 84 }
      ],
      'biz-2': [
        { month: 'Mei', fullMonth: 'Mei 2026', income: 38000000, expense: 31500000, txCount: 80, score: 70 },
        { month: 'Jun', fullMonth: 'Juni 2026', income: 39500000, expense: 32800000, txCount: 84, score: 72 },
        { month: 'Jul', fullMonth: 'Juli 2026', income: 41000000, expense: 33900000, txCount: 92, score: 74 },
        { month: 'Agu', fullMonth: 'Agustus 2026', income: 40500000, expense: 34100000, txCount: 88, score: 75 },
        { month: 'Sep', fullMonth: 'September 2026', income: 42500000, expense: 35000000, txCount: 96, score: 76 },
        { month: 'Okt', fullMonth: 'Oktober 2026', income: 44000000, expense: 35800000, txCount: 102, score: 78 }
      ],
      'biz-3': [
        { month: 'Mei', fullMonth: 'Mei 2026', income: 14000000, expense: 11200000, txCount: 30, score: 62 },
        { month: 'Jun', fullMonth: 'Juni 2026', income: 15200000, expense: 11800000, txCount: 35, score: 64 },
        { month: 'Jul', fullMonth: 'Juli 2026', income: 14800000, expense: 11600000, txCount: 34, score: 65 },
        { month: 'Agu', fullMonth: 'Agustus 2026', income: 16100000, expense: 12100000, txCount: 38, score: 66 },
        { month: 'Sep', fullMonth: 'September 2026', income: 16800000, expense: 12400000, txCount: 41, score: 67 },
        { month: 'Okt', fullMonth: 'Oktober 2026', income: 17500000, expense: 12700000, txCount: 45, score: 68 }
      ]
    },
    // Loan Simulator Defaults
    simLoanAmount: 25000000, // Rp 25.000.000
    simTenorMonths: 12       // 12 Bulan
  };

  // --- DOM CACHE ---
  var el = {
    // Topbar Controls
    btnBizSelect: document.getElementById('btn-biz-select'),
    bizNameDisplay: document.getElementById('biz-name-display'),
    bizDropdown: document.getElementById('biz-dropdown-menu'),
    btnExportReport: document.getElementById('btn-export-report'),

    // Hero Gauge Section
    gaugeArcFill: document.getElementById('gauge-arc-fill'),
    gaugeScoreVal: document.getElementById('gauge-score-val'),
    heroScoreBadge: document.getElementById('hero-score-badge'),
    heroScoreDelta: document.getElementById('hero-score-delta'),
    heroInsightTitle: document.getElementById('hero-insight-title'),
    heroInsightText: document.getElementById('hero-insight-text'),

    // Hero Foundation Stats
    statAvgProfit: document.getElementById('stat-avg-profit'),
    statManagedVol: document.getElementById('stat-managed-vol'),
    statMarginRatio: document.getElementById('stat-margin-ratio'),

    // Hero Bank Verdict Box
    verdictStatusTitle: document.getElementById('verdict-status-title'),
    verdictStatusDesc: document.getElementById('verdict-status-desc'),
    verdictGuardrailVal: document.getElementById('verdict-guardrail-val'),

    // 4 Indicator Cards
    pilar1Score: document.getElementById('pilar-1-score'),
    pilar1Fill: document.getElementById('pilar-1-fill'),
    pilar1Desc: document.getElementById('pilar-1-desc'),

    pilar2Score: document.getElementById('pilar-2-score'),
    pilar2Fill: document.getElementById('pilar-2-fill'),
    pilar2Desc: document.getElementById('pilar-2-desc'),

    pilar3Score: document.getElementById('pilar-3-score'),
    pilar3Fill: document.getElementById('pilar-3-fill'),
    pilar3Desc: document.getElementById('pilar-3-desc'),

    pilar4Score: document.getElementById('pilar-4-score'),
    pilar4Fill: document.getElementById('pilar-4-fill'),
    pilar4Desc: document.getElementById('pilar-4-desc'),

    // Chart Viewport & Controls
    chartViewport: document.getElementById('chart-interactive-viewport'),
    cashflowSvg: document.getElementById('cashflow-svg'),
    chartTooltip: document.getElementById('chart-tooltip'),
    tabBtnCashflow: document.getElementById('tab-btn-cashflow'),
    tabBtnScore: document.getElementById('tab-btn-score'),
    chartLegendArea: document.getElementById('chart-legend-area'),

    // Guardrail Simulator
    simSafeCapHighlight: document.getElementById('sim-safe-capacity'),
    rangeAmount: document.getElementById('range-loan-amount'),
    rangeAmountVal: document.getElementById('range-amount-val'),
    rangeTenor: document.getElementById('range-loan-tenor'),
    rangeTenorVal: document.getElementById('range-tenor-val'),
    simInstallmentResult: document.getElementById('sim-installment-result'),
    simGuardrailAlert: document.getElementById('sim-guardrail-alert'),

    // Action Checklist
    actionChecklist: document.getElementById('action-checklist-container'),

    // Audit Trail Table
    tableHistoryBody: document.getElementById('table-history-body'),

    // Mobile Navigation
    sidebar: document.getElementById('app-sidebar'),
    btnToggleSidebar: document.getElementById('btn-collapse-sidebar'),
    btnMobileMenu: document.getElementById('btn-mobile-menu')
  };

  // --- UTILS ---
  function formatRupiah(num) {
    if (isNaN(num)) num = 0;
    return 'Rp ' + Math.round(num).toLocaleString('id-ID');
  }

  function formatShortRupiah(num) {
    if (isNaN(num)) num = 0;
    if (num >= 1000000) {
      return 'Rp ' + (num / 1000000).toFixed(1) + 'M';
    }
    return formatRupiah(num);
  }

  function getActiveBiz() {
    for (var i = 0; i < state.businesses.length; i++) {
      if (state.businesses[i].id === state.activeBizId) {
        return state.businesses[i];
      }
    }
    return state.businesses[0];
  }

  // --- MERGE REAL DATA FROM BUKU KAS WARUNG IF AVAILABLE ---
  function getSixMonthData() {
    var bizId = state.activeBizId;
    var base = state.mockHistory[bizId] ? JSON.parse(JSON.stringify(state.mockHistory[bizId])) : [];

    try {
      var raw = localStorage.getItem('utera_kas_transactions_v2');
      if (raw) {
        var txs = JSON.parse(raw);
        if (Array.isArray(txs) && txs.length > 0) {
          var bizTxs = txs.filter(function (t) {
            return !t.businessId || t.businessId === bizId;
          });

          if (bizTxs.length >= 2 && base.length > 0) {
            var totalIn = 0;
            var totalOut = 0;
            var count = 0;

            bizTxs.forEach(function (t) {
              var nominal = Number(t.amount) || 0;
              if (t.type === 'income') totalIn += nominal;
              else if (t.type === 'expense') totalOut += nominal;
              count++;
            });

            if (totalIn > 0 || totalOut > 0) {
              var last = base[base.length - 1];
              last.income = totalIn > 0 ? totalIn : last.income;
              last.expense = totalOut > 0 ? totalOut : last.expense;
              last.txCount = count > 0 ? count : last.txCount;
            }
          }
        }
      }
    } catch (e) {
      console.warn('Gagal membaca transaksi Buku Kas Warung:', e);
    }

    return base;
  }

  // --- STRICT PRD SCORING FORMULA ---
  function evaluateCreditScore(history) {
    var countTotal = history.length;
    if (countTotal === 0) {
      return { totalScore: 0, p1: 0, p2: 0, p3: 0, p4: 0, avgNet: 0, safeInstallment: 0, category: 'Rendah' };
    }

    var bCatat = 0;
    var bLaba = 0;
    var totalNetProfit = 0;
    var totalRevenue = 0;
    var totalExpense = 0;

    history.forEach(function (m) {
      var net = m.income - m.expense;
      if (m.txCount > 0 || m.income > 0) bCatat++;
      if (net > 0) bLaba++;
      totalNetProfit += net;
      totalRevenue += m.income;
      totalExpense += m.expense;
    });

    // Pilar 1: Konsistensi Pencatatan (Bobot 30)
    var p1Score = Math.min(30, Math.round(30 * (bCatat / 6)));

    // Pilar 2: Tren Pemasukan (Bobot 25): Bulan 4..6 vs Bulan 1..3
    var rLama = (history[0].income || 0) + (history[1].income || 0) + (history[2].income || 0);
    var rBaru = (history[3].income || 0) + (history[4].income || 0) + (history[5].income || 0);
    var ratio = 1;
    if (rLama > 0) {
      ratio = rBaru / rLama;
    } else if (rBaru > 0) {
      ratio = 1;
    }
    var p2Score = Math.min(25, Math.round(25 * Math.min(1, ratio)));

    // Pilar 3: Profitabilitas (Bobot 25): Margin laba bersih kumulatif, penuh pada 20%
    var margin = totalRevenue > 0 ? totalNetProfit / totalRevenue : 0;
    var marginRatio = Math.max(0, margin) / 0.20;
    var p3Score = Math.min(25, Math.round(25 * Math.min(1, marginRatio)));

    // Pilar 4: Stabilitas Arus Kas (Bobot 20): B_laba / 6
    var p4Score = Math.min(20, Math.round(20 * (bLaba / 6)));

    // Total Skor 0 - 100
    var totalScore = p1Score + p2Score + p3Score + p4Score;

    // Kategori PRD
    var category = 'Rendah';
    if (totalScore >= 70) category = 'Baik';
    else if (totalScore >= 40) category = 'Cukup';

    var avgNet = totalNetProfit / countTotal;
    var safeInstallment = Math.max(0, avgNet * 0.30); // 30% Guardrail

    return {
      totalScore: totalScore,
      p1: p1Score,
      p2: p2Score,
      p3: p3Score,
      p4: p4Score,
      bCatat: bCatat,
      rLama: rLama,
      rBaru: rBaru,
      totalRevenue: totalRevenue,
      totalNetProfit: totalNetProfit,
      marginPct: (margin * 100).toFixed(1),
      bLaba: bLaba,
      avgNet: avgNet,
      safeInstallment: safeInstallment,
      category: category
    };
  }

  // --- ANIMATED SCORE COUNTER & GAUGE ---
  function animateScoreDisplay(targetScore) {
    var startScore = 0;
    var duration = 900;
    var startTime = null;

    // Arc length for r=95 semi-circle: C = PI * 95 ~ 298.45
    var arcLength = 298.45;
    var targetOffset = arcLength * (1 - (targetScore / 100));

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      // easeOutCubic
      var ease = 1 - Math.pow(1 - progress, 3);
      var currentVal = Math.round(startScore + (targetScore - startScore) * ease);

      el.gaugeScoreVal.textContent = currentVal;
      var currentOffset = arcLength - ((arcLength - targetOffset) * ease);
      el.gaugeArcFill.style.strokeDashoffset = currentOffset;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.gaugeScoreVal.textContent = targetScore;
        el.gaugeArcFill.style.strokeDashoffset = targetOffset;
      }
    }
    requestAnimationFrame(step);
  }

  // --- RENDER VIEWS ---
  function renderAll() {
    var activeBiz = getActiveBiz();
    el.bizNameDisplay.textContent = activeBiz.name;

    var history = getSixMonthData();
    var evalRes = evaluateCreditScore(history);

    // 1. Animate Hero Gauge
    animateScoreDisplay(evalRes.totalScore);

    // Category Badge
    el.heroScoreBadge.className = 'hero-score-badge badge-score-' + evalRes.category.toLowerCase();
    el.heroScoreBadge.textContent = 'Kategori: ' + evalRes.category + ' (' + evalRes.totalScore + '/100)';

    // Delta score tag (+4 poin vs bulan lalu)
    var prevMonthScore = history.length >= 2 ? history[history.length - 2].score : evalRes.totalScore - 4;
    var delta = evalRes.totalScore - prevMonthScore;
    el.heroScoreDelta.innerHTML = (delta >= 0 ? '<span class="material-symbols-rounded">trending_up</span> +' : '<span class="material-symbols-rounded">trending_down</span> ') +
      delta + ' poin vs siklus lalu';

    // Editorial Diagnostic Narrative
    if (evalRes.category === 'Baik') {
      el.heroInsightTitle.textContent = 'Kondisi Finansial Sangat Sehat (Layak KUR)';
      el.heroInsightText.textContent = 'Usaha ' + activeBiz.name + ' menunjukkan pertumbuhan stabil dengan margin laba bersih ' + evalRes.marginPct + '%. Riwayat pembukuan konsisten 6 bulan berturut-turut memenuhi kriteria mitigasi risiko kredit perbankan.';
      el.verdictStatusTitle.innerHTML = '<span class="material-symbols-rounded text-emerald">check_circle</span> Memenuhi Syarat KUR 2026';
      el.verdictStatusDesc.textContent = 'Memenuhi syarat administratif & profil keuangan ideal untuk plafon KUR Mikro (hingga Rp100 Jt) tanpa agunan tambahan.';
    } else if (evalRes.category === 'Cukup') {
      el.heroInsightTitle.textContent = 'Memenuhi Standar Dasar (Perlu Optimasi)';
      el.heroInsightText.textContent = 'Konsistensi pencatatan sudah baik (' + evalRes.bCatat + '/6 bulan), namun efisiensi belanja operasional perlu ditingkatkan agar margin laba bersih mencapai ambang penuh 20% saat bank melakukan verifikasi.';
      el.verdictStatusTitle.innerHTML = '<span class="material-symbols-rounded text-gold">pending_actions</span> Layak Bersyarat (Plafon Terbatas)';
      el.verdictStatusDesc.textContent = 'Bank dapat membatasi plafon pinjaman awal ke skema KUR Super Mikro (hingga Rp10 Jt) hingga margin stabil.';
    } else {
      el.heroInsightTitle.textContent = 'Prioritas Perbaikan Keuangan Usaha';
      el.heroInsightText.textContent = 'Sebagian indikator kelayakan belum memenuhi standar kreditur. Fokuskan pencatatan rutin setiap hari di Buku Kas Warung dan pertahankan arus kas positif selama 3 bulan ke depan.';
      el.verdictStatusTitle.innerHTML = '<span class="material-symbols-rounded text-terracotta">error</span> Belum Siap Pengajuan Bank';
      el.verdictStatusDesc.textContent = 'Perbankan mensyaratkan minimal 6 bulan pencatatan teratur dan laba bersih positif untuk menyetujui KUR.';
    }

    // Hero Foundation Stats
    el.statAvgProfit.textContent = formatRupiah(evalRes.avgNet);
    el.statManagedVol.textContent = formatShortRupiah(evalRes.totalRevenue);
    el.statMarginRatio.textContent = evalRes.marginPct + '%';

    // Safe Installment Guardrail Indicator
    el.verdictGuardrailVal.textContent = formatRupiah(evalRes.safeInstallment) + ' / bln';
    el.simSafeCapHighlight.textContent = formatRupiah(evalRes.safeInstallment);

    // 2. Render 4 Indicator Cards
    // Pillar 1: Konsistensi
    el.pilar1Score.textContent = evalRes.p1;
    el.pilar1Fill.style.width = ((evalRes.p1 / 30) * 100) + '%';
    el.pilar1Desc.textContent = evalRes.bCatat + ' dari 6 bulan aktif mencatatkan kas harian. Target 6 bulan penuh.';

    // Pillar 2: Tren Pemasukan
    el.pilar2Score.textContent = evalRes.p2;
    el.pilar2Fill.style.width = ((evalRes.p2 / 25) * 100) + '%';
    el.pilar2Desc.textContent = 'Omzet 3 bln terakhir (' + formatShortRupiah(evalRes.rBaru) + ') tumbuh terhadap periode lalu (' + formatShortRupiah(evalRes.rLama) + ').';

    // Pillar 3: Profitabilitas
    el.pilar3Score.textContent = evalRes.p3;
    el.pilar3Fill.style.width = ((evalRes.p3 / 25) * 100) + '%';
    el.pilar3Desc.textContent = 'Margin laba bersih kumulatif berada di ' + evalRes.marginPct + '%. Target PRD penuh: 20%.';

    // Pillar 4: Stabilitas Arus Kas
    el.pilar4Score.textContent = evalRes.p4;
    el.pilar4Fill.style.width = ((evalRes.p4 / 20) * 100) + '%';
    el.pilar4Desc.textContent = evalRes.bLaba + ' dari 6 bulan membukukan laba surplus tanpa defisit operasional.';

    // 3. Render Interactive Chart
    renderChart(history);

    // 4. Render Guardrail Simulator
    updateSimulator(evalRes.safeInstallment);

    // 5. Render Recommendations
    renderRecommendations(evalRes);

    // 6. Render Table Audit Trail
    renderTable(history);
  }

  // --- FINANCIAL & SCORE INTERACTIVE SVG CHART ---
  function renderChart(history) {
    var svg = el.cashflowSvg;
    svg.innerHTML = '';

    var svgW = 740;
    var svgH = 220;
    var padL = 40;
    var padR = 20;
    var padT = 20;
    var padB = 35;
    var chartW = svgW - padL - padR;
    var chartH = svgH - padT - padB;

    var mode = state.chartViewMode;

    if (mode === 'cashflow') {
      // Find max revenue & expense for scaling
      var maxVal = 0;
      history.forEach(function (m) {
        if (m.income > maxVal) maxVal = m.income;
        if (m.expense > maxVal) maxVal = m.expense;
      });
      maxVal = Math.ceil((maxVal * 1.15) / 5000000) * 5000000;
      if (maxVal === 0) maxVal = 30000000;

      // Draw Grid Lines (3 horizontal lines)
      var gridG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      for (var g = 0; g <= 3; g++) {
        var yVal = padT + (chartH / 3) * g;
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', padL);
        line.setAttribute('x2', svgW - padR);
        line.setAttribute('y1', yVal);
        line.setAttribute('y2', yVal);
        line.setAttribute('class', 'chart-grid-line');
        gridG.appendChild(line);

        // Y-axis label
        var labelVal = maxVal - (maxVal / 3) * g;
        var txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', padL - 8);
        txt.setAttribute('y', yVal + 4);
        txt.setAttribute('class', 'chart-axis-label');
        txt.setAttribute('text-anchor', 'end');
        txt.textContent = (labelVal / 1000000).toFixed(0) + 'M';
        gridG.appendChild(txt);
      }
      svg.appendChild(gridG);

      // Calculate Points
      var incomePoints = [];
      var expensePoints = [];
      var profitPoints = [];
      var xCoords = [];

      var stepX = chartW / (history.length - 1);

      history.forEach(function (m, idx) {
        var x = padL + (idx * stepX);
        var yInc = padT + chartH - ((m.income / maxVal) * chartH);
        var yExp = padT + chartH - ((m.expense / maxVal) * chartH);
        var net = m.income - m.expense;
        var yNet = padT + chartH - ((net / maxVal) * chartH);

        incomePoints.push({ x: x, y: yInc, data: m });
        expensePoints.push({ x: x, y: yExp, data: m });
        profitPoints.push({ x: x, y: yNet, data: m });
        xCoords.push(x);

        // X-axis month label
        var xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        xLabel.setAttribute('x', x);
        xLabel.setAttribute('y', svgH - 10);
        xLabel.setAttribute('class', 'chart-axis-label');
        xLabel.textContent = m.month;
        svg.appendChild(xLabel);
      });

      // Defs Area Gradient
      var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.innerHTML = '<linearGradient id="areaEmeraldGrad" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#1F6B4F" stop-opacity="0.22"/>' +
        '<stop offset="100%" stop-color="#1F6B4F" stop-opacity="0.00"/>' +
        '</linearGradient>';
      svg.appendChild(defs);

      // Area Fill for Income
      var areaD = 'M ' + incomePoints[0].x + ' ' + (padT + chartH);
      incomePoints.forEach(function (pt) { areaD += ' L ' + pt.x + ' ' + pt.y; });
      areaD += ' L ' + incomePoints[incomePoints.length - 1].x + ' ' + (padT + chartH) + ' Z';

      var areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      areaPath.setAttribute('d', areaD);
      areaPath.setAttribute('fill', 'url(#areaEmeraldGrad)');
      svg.appendChild(areaPath);

      // Income Line (Primary Forest Green)
      var incLineD = 'M ' + incomePoints[0].x + ' ' + incomePoints[0].y;
      for (var i = 1; i < incomePoints.length; i++) {
        incLineD += ' L ' + incomePoints[i].x + ' ' + incomePoints[i].y;
      }
      var incPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      incPath.setAttribute('d', incLineD);
      incPath.setAttribute('class', 'chart-line-income');
      svg.appendChild(incPath);

      // Expense Line (Terracotta Dashed)
      var expLineD = 'M ' + expensePoints[0].x + ' ' + expensePoints[0].y;
      for (var j = 1; j < expensePoints.length; j++) {
        expLineD += ' L ' + expensePoints[j].x + ' ' + expensePoints[j].y;
      }
      var expPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      expPath.setAttribute('d', expLineD);
      expPath.setAttribute('class', 'chart-line-expense');
      svg.appendChild(expPath);

      // Profit Line (Emerald Accent)
      var profLineD = 'M ' + profitPoints[0].x + ' ' + profitPoints[0].y;
      for (var k = 1; k < profitPoints.length; k++) {
        profLineD += ' L ' + profitPoints[k].x + ' ' + profitPoints[k].y;
      }
      var profPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      profPath.setAttribute('d', profLineD);
      profPath.setAttribute('class', 'chart-line-profit');
      svg.appendChild(profPath);

      // Interactive Hover Crosshair Points
      var pointsG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      incomePoints.forEach(function (pt) {
        var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pt.x);
        circle.setAttribute('cy', pt.y);
        circle.setAttribute('r', '4.5');
        circle.setAttribute('class', 'chart-point-dot');
        circle.setAttribute('data-month', pt.data.fullMonth);
        circle.setAttribute('data-inc', pt.data.income);
        circle.setAttribute('data-exp', pt.data.expense);

        circle.addEventListener('mouseenter', function (e) {
          showChartTooltip(e, pt);
        });
        pointsG.appendChild(circle);
      });
      svg.appendChild(pointsG);

    } else {
      // MODE: RIWAYAT SKOR KREDIT (0 - 100)
      var maxScore = 100;
      var gridScoreG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      for (var s = 0; s <= 4; s++) {
        var yScore = padT + (chartH / 4) * s;
        var sLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        sLine.setAttribute('x1', padL);
        sLine.setAttribute('x2', svgW - padR);
        sLine.setAttribute('y1', yScore);
        sLine.setAttribute('y2', yScore);
        sLine.setAttribute('class', 'chart-grid-line');
        gridScoreG.appendChild(sLine);

        var sVal = 100 - 25 * s;
        var sTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        sTxt.setAttribute('x', padL - 8);
        sTxt.setAttribute('y', yScore + 4);
        sTxt.setAttribute('class', 'chart-axis-label');
        sTxt.setAttribute('text-anchor', 'end');
        sTxt.textContent = sVal;
        gridScoreG.appendChild(sTxt);
      }
      svg.appendChild(gridScoreG);

      var scorePts = [];
      var sStepX = chartW / (history.length - 1);

      history.forEach(function (m, idx) {
        var x = padL + (idx * sStepX);
        var y = padT + chartH - ((m.score / maxScore) * chartH);
        scorePts.push({ x: x, y: y, data: m });

        var sLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        sLabel.setAttribute('x', x);
        sLabel.setAttribute('y', svgH - 10);
        sLabel.setAttribute('class', 'chart-axis-label');
        sLabel.textContent = m.month;
        svg.appendChild(sLabel);
      });

      // Defs Gold Gradient for Score
      var defsS = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defsS.innerHTML = '<linearGradient id="areaGoldGrad" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#C98A1B" stop-opacity="0.25"/>' +
        '<stop offset="100%" stop-color="#C98A1B" stop-opacity="0.00"/>' +
        '</linearGradient>';
      svg.appendChild(defsS);

      // Area Fill
      var sAreaD = 'M ' + scorePts[0].x + ' ' + (padT + chartH);
      scorePts.forEach(function (pt) { sAreaD += ' L ' + pt.x + ' ' + pt.y; });
      sAreaD += ' L ' + scorePts[scorePts.length - 1].x + ' ' + (padT + chartH) + ' Z';

      var sAreaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      sAreaPath.setAttribute('d', sAreaD);
      sAreaPath.setAttribute('fill', 'url(#areaGoldGrad)');
      svg.appendChild(sAreaPath);

      // Line Path
      var sLineD = 'M ' + scorePts[0].x + ' ' + scorePts[0].y;
      for (var si = 1; si < scorePts.length; si++) {
        sLineD += ' L ' + scorePts[si].x + ' ' + scorePts[si].y;
      }
      var sPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      sPath.setAttribute('d', sLineD);
      sPath.setAttribute('fill', 'none');
      sPath.setAttribute('stroke', '#C98A1B');
      sPath.setAttribute('stroke-width', '3');
      sPath.setAttribute('stroke-linecap', 'round');
      svg.appendChild(sPath);

      // Points
      var sPointsG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      scorePts.forEach(function (pt) {
        var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', pt.x);
        dot.setAttribute('cy', pt.y);
        dot.setAttribute('r', '5');
        dot.setAttribute('fill', '#FFFFFF');
        dot.setAttribute('stroke', '#C98A1B');
        dot.setAttribute('stroke-width', '3');
        dot.style.cursor = 'pointer';

        dot.addEventListener('mouseenter', function (e) {
          showScoreTooltip(e, pt);
        });
        sPointsG.appendChild(dot);
      });
      svg.appendChild(sPointsG);
    }

    // Hide tooltip on mouse leave
    el.chartViewport.addEventListener('mouseleave', function () {
      el.chartTooltip.hidden = true;
    });
  }

  function showChartTooltip(e, pt) {
    var net = pt.data.income - pt.data.expense;
    var margin = pt.data.income > 0 ? ((net / pt.data.income) * 100).toFixed(1) : '0';

    el.chartTooltip.innerHTML = '<div class="popover-header">' + pt.data.fullMonth + '</div>' +
      '<div class="popover-row"><span>Omzet:</span> <span class="text-emerald">' + formatRupiah(pt.data.income) + '</span></div>' +
      '<div class="popover-row"><span>Beban:</span> <span class="text-terracotta">' + formatRupiah(pt.data.expense) + '</span></div>' +
      '<div class="popover-row"><span>Laba Bersih:</span> <span style="color:#10B981;">' + formatRupiah(net) + '</span></div>' +
      '<div class="popover-row"><span>Margin:</span> <span>' + margin + '%</span></div>';

    var rect = el.chartViewport.getBoundingClientRect();
    var posX = (pt.x / 740) * rect.width;
    el.chartTooltip.style.left = posX + 'px';
    el.chartTooltip.style.top = '14px';
    el.chartTooltip.hidden = false;
  }

  function showScoreTooltip(e, pt) {
    el.chartTooltip.innerHTML = '<div class="popover-header">' + pt.data.fullMonth + '</div>' +
      '<div class="popover-row"><span>Skor Kredit:</span> <strong style="color:#C98A1B; font-size:14px;">' + pt.data.score + ' / 100</strong></div>' +
      '<div class="popover-row"><span>Kategori:</span> <span>' + (pt.data.score >= 70 ? 'Baik' : 'Cukup') + '</span></div>';

    var rect = el.chartViewport.getBoundingClientRect();
    var posX = (pt.x / 740) * rect.width;
    el.chartTooltip.style.left = posX + 'px';
    el.chartTooltip.style.top = '14px';
    el.chartTooltip.hidden = false;
  }

  // --- ACTIONABLE RECOMMENDATIONS (Linear / Ramp Style) ---
  function renderRecommendations(evalRes) {
    var items = [];

    if (evalRes.p1 < 30) {
      items.push({
        priority: 'high',
        pClass: 'p-high',
        pLabel: 'Prioritas Tinggi',
        points: '+5 Poin',
        title: 'Catat Arus Kas Harian Secara Kontinu',
        desc: 'Hindari jeda pencatatan kas lebih dari 3 hari. Bank menilai komitmen operasional dari frekuensi pembukuan.',
        actionText: 'Buka Buku Kas Warung',
        actionUrl: '../Buku-Kas-Warung/index.html'
      });
    }

    if (evalRes.p3 < 20) {
      items.push({
        priority: 'high',
        pClass: 'p-high',
        pLabel: 'Prioritas Tinggi',
        points: '+6 Poin',
        title: 'Tingkatkan Margin Laba Bersih ke Ambang 20%',
        desc: 'Margin saat ini ' + evalRes.marginPct + '%. Tekan belanja bahan baku atau terapkan harga bundling produk terlaris.',
        actionText: 'Evaluasi Biaya Operasional',
        actionUrl: '../Buku-Kas-Warung/index.html'
      });
    }

    if (evalRes.p2 < 20) {
      items.push({
        priority: 'med',
        pClass: 'p-med',
        pLabel: 'Prioritas Sedang',
        points: '+4 Poin',
        title: 'Percepat Laju Pertumbuhan Omzet 3 Bulan Ke Depan',
        desc: 'Pemasukan kuartal berjalan harus lebih tinggi dari kuartal sebelumnya agar mendapat nilai penuh pilar tren.',
        actionText: 'Lihat Grafik Volume Penjualan',
        actionUrl: '../Buku-Kas-Warung/index.html'
      });
    }

    items.push({
      priority: 'ok',
      pClass: 'p-ok',
      pLabel: 'Rekomendasi Siap',
      points: 'Terpenuhi',
      title: 'Validasi Batas Angsuran KUR Maksimal 30% Laba',
      desc: 'Batas cicilan aman warung adalah ' + formatRupiah(evalRes.safeInstallment) + ' / bulan agar arus kas tidak defisit.',
      actionText: 'Sesuaikan Plafon di Simulator',
      actionUrl: '#sim-guardrail'
    });

    items.push({
      priority: 'ok',
      pClass: 'p-ok',
      pLabel: 'Rekomendasi Siap',
      points: 'Administrasi',
      title: 'Lengkapi Berkas NIB & Surat Keterangan Usaha (SKU)',
      desc: 'Dokumen legalitas esensial mempercepat persetujuan proposal permodalan di bank penyalur KUR.',
      actionText: 'Cek Dokumen Legalitas',
      actionUrl: '../dashboard/'
    });

    var html = '';
    items.forEach(function (it) {
      html += '<div class="action-card-item">' +
        '<span class="action-priority-badge ' + it.pClass + '">' + it.pLabel + '</span>' +
        '<div class="action-body">' +
          '<div class="action-title-row">' +
            '<span class="action-title">' + it.title + '</span>' +
            '<span class="action-point-tag">' + it.points + '</span>' +
          '</div>' +
          '<span class="action-desc">' + it.desc + '</span>' +
          '<a href="' + it.actionUrl + '" class="action-btn-link">' +
            '<span>' + it.actionText + '</span>' +
            '<span class="material-symbols-rounded">arrow_forward</span>' +
          '</a>' +
        '</div>' +
      '</div>';
    });

    el.actionChecklist.innerHTML = html;
  }

  // --- LOAN SIMULATOR CONTROLLER ---
  function updateSimulator(safeLimit) {
    var amount = Number(el.rangeAmount.value);
    var tenor = Number(el.rangeTenor.value);

    state.simLoanAmount = amount;
    state.simTenorMonths = tenor;

    el.rangeAmountVal.textContent = formatRupiah(amount);
    el.rangeTenorVal.textContent = tenor + ' Bulan';

    // KUR BRI 2026: 6% flat/eff per tahun estimate
    var pokokBulanan = amount / tenor;
    var bungaBulanan = (amount * 0.06) / 12;
    var totalCicilan = Math.round(pokokBulanan + bungaBulanan);

    el.simInstallmentResult.textContent = formatRupiah(totalCicilan) + ' / bln';

    var isSafe = totalCicilan <= safeLimit;
    if (isSafe) {
      el.simGuardrailAlert.className = 'guardrail-comparison-box is-safe';
      el.simGuardrailAlert.innerHTML = '<span class="material-symbols-rounded">verified</span>' +
        '<div><strong>Cicilan Berada di Zona Aman:</strong> Estimasi angsuran ' + formatRupiah(totalCicilan) + ' berada di bawah batas 30% laba bersih (' + formatRupiah(safeLimit) + '). Usaha Anda memiliki daya bayar yang kuat.</div>';
    } else {
      el.simGuardrailAlert.className = 'guardrail-comparison-box is-danger';
      el.simGuardrailAlert.innerHTML = '<span class="material-symbols-rounded">warning</span>' +
        '<div><strong>Peringatan Guardrail (Risiko Gagal Bayar):</strong> Cicilan ' + formatRupiah(totalCicilan) + ' melebihi 30% kapasitas laba bulanan warung (' + formatRupiah(safeLimit) + '). Pilih tenor lebih panjang atau kurangi nominal pengajuan.</div>';
    }
  }

  // --- AUDIT TRAIL DATA TABLE ---
  function renderTable(history) {
    var html = '';
    history.forEach(function (m, idx) {
      var net = m.income - m.expense;
      var margin = m.income > 0 ? ((net / m.income) * 100).toFixed(1) : '0';
      var isPositive = net >= 0;

      // Delta score
      var prevScore = idx > 0 ? history[idx - 1].score : m.score;
      var scoreDelta = m.score - prevScore;
      var deltaBadge = scoreDelta > 0 ? '<span class="text-emerald" style="font-size:11px; font-weight:700;">(+' + scoreDelta + ')</span>' :
                       scoreDelta < 0 ? '<span class="text-terracotta" style="font-size:11px; font-weight:700;">(' + scoreDelta + ')</span>' : '';

      html += '<tr>' +
        '<td><strong>' + m.fullMonth + '</strong></td>' +
        '<td class="tabular-num text-emerald">' + formatRupiah(m.income) + '</td>' +
        '<td class="tabular-num text-terracotta">' + formatRupiah(m.expense) + '</td>' +
        '<td class="tabular-num ' + (isPositive ? 'text-emerald' : 'text-terracotta') + '">' +
          formatRupiah(net) +
        '</td>' +
        '<td class="tabular-num">' + margin + '%</td>' +
        '<td><span class="status-badge-table ' + (isPositive ? 'badge-score-baik' : 'badge-score-rendah') + '">' +
          (isPositive ? 'Surplus' : 'Defisit') +
        '</span></td>' +
        '<td><strong style="color:var(--text-main);">' + m.score + '</strong> ' + deltaBadge + '</td>' +
      '</tr>';
    });
    el.tableHistoryBody.innerHTML = html;
  }

  // --- EVENT LISTENERS ---
  // Business Profile Selector
  el.btnBizSelect.addEventListener('click', function (e) {
    e.stopPropagation();
    el.bizDropdown.hidden = !el.bizDropdown.hidden;
  });

  document.addEventListener('click', function () {
    el.bizDropdown.hidden = true;
  });

  el.bizDropdown.querySelectorAll('.dropdown-item').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetId = btn.getAttribute('data-biz-id');
      state.activeBizId = targetId;
      localStorage.setItem('utera_active_business_id', targetId);

      el.bizDropdown.querySelectorAll('.dropdown-item').forEach(function (b) {
        b.classList.remove('is-selected');
      });
      btn.classList.add('is-selected');

      renderAll();
    });
  });

  // Chart View Mode Switching
  el.tabBtnCashflow.addEventListener('click', function () {
    state.chartViewMode = 'cashflow';
    el.tabBtnCashflow.classList.add('is-active');
    el.tabBtnScore.classList.remove('is-active');
    el.chartLegendArea.hidden = false;
    renderChart(getSixMonthData());
  });

  el.tabBtnScore.addEventListener('click', function () {
    state.chartViewMode = 'score';
    el.tabBtnScore.classList.add('is-active');
    el.tabBtnCashflow.classList.remove('is-active');
    el.chartLegendArea.hidden = true;
    renderChart(getSixMonthData());
  });

  // Simulator Sliders
  el.rangeAmount.addEventListener('input', function () {
    var history = getSixMonthData();
    var evalRes = evaluateCreditScore(history);
    updateSimulator(evalRes.safeInstallment);
  });

  el.rangeTenor.addEventListener('input', function () {
    var history = getSixMonthData();
    var evalRes = evaluateCreditScore(history);
    updateSimulator(evalRes.safeInstallment);
  });

  // Print/Export Report
  el.btnExportReport.addEventListener('click', function () {
    window.print();
  });

  // Mobile Sidebar Toggle
  if (el.btnToggleSidebar) {
    el.btnToggleSidebar.addEventListener('click', function () {
      el.sidebar.classList.toggle('is-open');
    });
  }

  if (el.btnMobileMenu) {
    el.btnMobileMenu.addEventListener('click', function () {
      el.sidebar.classList.toggle('is-open');
    });
  }

  // --- INITIALIZE ---
  renderAll();
});
