/**
 * UTERA Simulasi KUR 2026 & KUR Planner
 * Module: simulasi-kur/app.js
 * Implementation: Pure Vanilla JS, Zero framework dependencies
 */

(function () {
  'use strict';

  // --- 1. STATE & CONSTANTS ---
  const DEFAULT_NET_PROFIT = 18450000; // Rp 18.450.000 from Buku Kas Warung
  const GUARDRAIL_PERCENT = 0.30;      // 30% Safe Ceiling
  const COMMERCIAL_RATE = 0.13;        // 13% p.a. suku bunga komersial pasar

  const KUR_TIERS = {
    'kur-super': {
      id: 'kur-super',
      name: 'KUR Super Mikro',
      rate: 0.03,
      rateDisplay: '3.0%',
      minPlafon: 1000000,
      maxPlafon: 10000000,
      defaultPlafon: 10000000,
      defaultTenor: 12,
      ticks: ['Rp 1 Jt', 'Rp 3 Jt', 'Rp 5 Jt', 'Rp 10 Jt']
    },
    'kur-mikro': {
      id: 'kur-mikro',
      name: 'KUR Mikro Bank',
      rate: 0.06,
      rateDisplay: '6.0%',
      minPlafon: 10000000,
      maxPlafon: 100000000,
      defaultPlafon: 50000000,
      defaultTenor: 24,
      ticks: ['Rp 10 Jt', 'Rp 30 Jt', 'Rp 50 Jt (Rekomendasi)', 'Rp 100 Jt']
    },
    'kur-kecil': {
      id: 'kur-kecil',
      name: 'KUR Kecil (Ekspansi)',
      rate: 0.06,
      rateDisplay: '6.0%',
      minPlafon: 100000000,
      maxPlafon: 500000000,
      defaultPlafon: 150000000,
      defaultTenor: 36,
      ticks: ['Rp 100 Jt', 'Rp 200 Jt', 'Rp 350 Jt', 'Rp 500 Jt']
    }
  };

  const BANKS = {
    'bri': 'Bank BRI',
    'mandiri': 'Bank Mandiri',
    'bni': 'Bank BNI'
  };

  let state = {
    netProfit: DEFAULT_NET_PROFIT,
    score: 84,
    currentTier: 'kur-mikro',
    selectedBank: 'bri',
    plafon: 50000000,
    tenorMonths: 24,
    allocations: {
      kulakan: 60,
      alat: 30,
      darurat: 10
    }
  };

  // --- 2. DOM ELEMENTS ---
  const el = {
    // Top KPIs
    valSkorKur: document.getElementById('val-skor-kur'),
    valGuardrailKur: document.getElementById('val-guardrail-kur'),
    valCicilanKur: document.getElementById('val-cicilan-kur'),
    valRatioKur: document.getElementById('val-ratio-kur'),
    valSubKur: document.getElementById('val-sub-kur'),
    valStatusPengajuan: document.getElementById('val-status-pengajuan'),
    badgeStatusPengajuan: document.getElementById('badge-status-pengajuan'),
    valDescPengajuan: document.getElementById('val-desc-pengajuan'),

    // Simulator Controls
    rangePlafonKur: document.getElementById('range-plafon-kur'),
    displayPlafonKur: document.getElementById('display-plafon-kur'),
    plafonTicks: document.getElementById('plafon-ticks'),
    displayTenorKur: document.getElementById('display-tenor-kur'),
    tenorSelectorKur: document.getElementById('tenor-selector-kur'),
    displayRateKur: document.getElementById('display-rate-kur'),
    valSubsidiHemat: document.getElementById('val-subsidi-hemat'),
    btnResetKur: document.getElementById('btn-reset-kur'),

    // Gauge & Risk Banner
    statusChipKur: document.getElementById('status-chip-kur'),
    statusChipTextKur: document.getElementById('status-chip-text-kur'),
    gaugePctKur: document.getElementById('gauge-pct-kur'),
    trackFillKur: document.getElementById('track-fill-kur'),
    riskBannerKur: document.getElementById('risk-banner-kur'),
    riskTitleKur: document.getElementById('risk-title-kur'),
    riskDescKur: document.getElementById('risk-desc-kur'),
    riskIconKur: document.getElementById('risk-icon-kur'),

    // Amortization Breakdown
    valPokokKur: document.getElementById('val-pokok-kur'),
    valBungaKur: document.getElementById('val-bunga-kur'),
    valTotalKur: document.getElementById('val-total-kur'),
    valAkumulasiKur: document.getElementById('val-akumulasi-kur'),
    btnSaveKur: document.getElementById('btn-save-kur'),

    // KUR Planner
    plannerTotalStatus: document.getElementById('planner-total-status'),
    plannerTotalPct: document.getElementById('planner-total-pct'),
    sliderAlloc1: document.getElementById('slider-alloc-1'),
    sliderAlloc2: document.getElementById('slider-alloc-2'),
    sliderAlloc3: document.getElementById('slider-alloc-3'),
    inputPct1: document.getElementById('input-pct-1'),
    inputPct2: document.getElementById('input-pct-2'),
    inputPct3: document.getElementById('input-pct-3'),
    plannerValNominal1: document.getElementById('planner-val-nominal-1'),
    plannerValNominal2: document.getElementById('planner-val-nominal-2'),
    plannerValNominal3: document.getElementById('planner-val-nominal-3'),
    displayAllocTotal: document.getElementById('display-alloc-total'),
    seg1: document.getElementById('seg-1'),
    seg2: document.getElementById('seg-2'),
    seg3: document.getElementById('seg-3'),

    // Checklist
    checklistProgressText: document.getElementById('checklist-progress-text'),
    checklistFillBar: document.getElementById('checklist-fill-bar'),
    itemDocNpwp: document.getElementById('item-doc-npwp'),
    badgeNpwpStatus: document.getElementById('badge-npwp-status'),
    descNpwpStatus: document.getElementById('desc-npwp-status'),

    // Proposal Preview
    prevPlafon: document.getElementById('prev-plafon'),
    prevTenor: document.getElementById('prev-tenor'),
    prevCicilan: document.getElementById('prev-cicilan'),
    prevRasio: document.getElementById('prev-rasio'),
    btnPrintKurReport: document.getElementById('btn-print-kur-report'),
    btnExportKurPdf: document.getElementById('btn-export-kur-pdf'),

    // Mobile Sidebar Drawer
    appSidebar: document.getElementById('app-sidebar'),
    btnMobileMenu: document.getElementById('btn-mobile-menu'),
    sidebarBackdrop: document.getElementById('sidebar-backdrop'),
    btnCollapseSidebar: document.getElementById('btn-collapse-sidebar'),
    globalSearch: document.getElementById('global-search')
  };

  // --- 3. FORMATTERS ---
  function formatRupiah(num) {
    const val = Math.round(num);
    return 'Rp ' + val.toLocaleString('id-ID');
  }

  function parseRupiah(str) {
    const cleaned = String(str).replace(/[^0-9]/g, '');
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? 0 : num;
  }

  // --- 4. CALCULATION ENGINE ---
  /**
   * Annuity formula: P * (r * (1 + r)^n) / ((1 + r)^n - 1)
   */
  function calculateInstallment(principal, annualRate, months) {
    if (months <= 0 || principal <= 0) return { total: 0, pokok: 0, bunga: 0, totalKumulatif: 0 };

    const monthlyRate = annualRate / 12;
    if (monthlyRate === 0) {
      const pokok = Math.round(principal / months);
      return { total: pokok, pokok: pokok, bunga: 0, totalKumulatif: principal };
    }

    const factor = Math.pow(1 + monthlyRate, months);
    const total = Math.round(principal * (monthlyRate * factor) / (factor - 1));
    const pokok = Math.round(principal / months);
    const bunga = Math.max(0, total - pokok);
    const totalKumulatif = total * months;

    return { total, pokok, bunga, totalKumulatif };
  }

  // --- 5. RENDER & UPDATE UI ---
  function updateUI() {
    const tier = KUR_TIERS[state.currentTier];
    const calc = calculateInstallment(state.plafon, tier.rate, state.tenorMonths);
    const calcCommercial = calculateInstallment(state.plafon, COMMERCIAL_RATE, state.tenorMonths);
    const subsidySavings = Math.max(0, calcCommercial.totalKumulatif - calc.totalKumulatif);

    const guardrailLimit = Math.round(state.netProfit * GUARDRAIL_PERCENT);
    const ratio = (calc.total / state.netProfit) * 100;
    const remainingCash = Math.max(0, state.netProfit - calc.total);
    const remainingPct = ((remainingCash / state.netProfit) * 100).toFixed(1);

    // Update Top KPIs
    if (el.valSkorKur) el.valSkorKur.innerHTML = `${state.score}<small class="score-denom">/100</small>`;
    if (el.valGuardrailKur) el.valGuardrailKur.textContent = formatRupiah(guardrailLimit);
    if (el.valCicilanKur) el.valCicilanKur.textContent = formatRupiah(calc.total);
    if (el.valRatioKur) el.valRatioKur.textContent = `${ratio.toFixed(1)}% Laba`;
    if (el.valSubKur) {
      el.valSubKur.textContent = `Plafon ${formatRupiah(state.plafon)} • Tenor ${state.tenorMonths} Bulan (${tier.rateDisplay} p.a.)`;
    }

    // Update Slider & Text
    if (el.rangePlafonKur) {
      el.rangePlafonKur.min = tier.minPlafon;
      el.rangePlafonKur.max = tier.maxPlafon;
      el.rangePlafonKur.value = state.plafon;
    }
    if (el.displayPlafonKur) {
      el.displayPlafonKur.value = state.plafon.toLocaleString('id-ID');
    }
    if (el.displayTenorKur) {
      const years = (state.tenorMonths / 12).toFixed(state.tenorMonths % 12 === 0 ? 0 : 1);
      el.displayTenorKur.textContent = `${state.tenorMonths} Bulan (${years} Tahun)`;
    }
    if (el.displayRateKur) {
      el.displayRateKur.textContent = tier.rateDisplay;
    }
    if (el.valSubsidiHemat) {
      el.valSubsidiHemat.textContent = `Hemat ${formatRupiah(subsidySavings)} vs Bank Non-KUR`;
    }

    // Update Slider Ticks
    if (el.plafonTicks && tier.ticks) {
      el.plafonTicks.innerHTML = tier.ticks.map(t => `<span>${t}</span>`).join('');
    }

    // Update Breakdown
    if (el.valPokokKur) el.valPokokKur.textContent = formatRupiah(calc.pokok);
    if (el.valBungaKur) el.valBungaKur.textContent = formatRupiah(calc.bunga);
    if (el.valTotalKur) el.valTotalKur.textContent = formatRupiah(calc.total);
    if (el.valAkumulasiKur) el.valAkumulasiKur.textContent = formatRupiah(calc.totalKumulatif);

    // Update Gauge Center Stat
    if (el.gaugePctKur) {
      el.gaugePctKur.textContent = ratio.toFixed(1).replace('.', ',') + '%';
      el.gaugePctKur.classList.remove('warning', 'danger');
      if (ratio > 30) {
        el.gaugePctKur.classList.add('danger');
      } else if (ratio > 20) {
        el.gaugePctKur.classList.add('warning');
      }
    }

    // Update Progress Bar Track
    if (el.trackFillKur) {
      const barPercent = Math.min(100, (ratio / 30) * 100);
      el.trackFillKur.style.width = `${barPercent}%`;

      el.trackFillKur.className = '';
      if (ratio <= 20) {
        el.trackFillKur.className = 'track-fill-safe';
      } else if (ratio <= 30) {
        el.trackFillKur.className = 'track-fill-warning';
      } else {
        el.trackFillKur.className = 'track-fill-danger';
      }
    }

    // Status Indicator & Risk Banner
    if (ratio <= 20) {
      if (el.statusChipKur) {
        el.statusChipKur.className = 'status-indicator-chip safe';
        if (el.statusChipTextKur) el.statusChipTextKur.textContent = 'Kapasitas Aman';
      }
      if (el.riskBannerKur) {
        el.riskBannerKur.className = 'risk-banner safe';
        if (el.riskTitleKur) el.riskTitleKur.textContent = 'Angsuran Sangat Ringan & Aman';
        if (el.riskDescKur) {
          el.riskDescKur.textContent = `Angsuran ${formatRupiah(calc.total)}/bulan hanya memakan ${ratio.toFixed(1)}% dari laba bersih kas warung Anda (${formatRupiah(state.netProfit)}). Likuiditas warung tetap terlindungi dengan cadangan kas ${remainingPct}%.`;
        }
        if (el.riskIconKur) el.riskIconKur.innerHTML = '<span class="material-symbols-rounded">check_circle</span>';
      }
    } else if (ratio <= 30) {
      if (el.statusChipKur) {
        el.statusChipKur.className = 'status-indicator-chip warning';
        if (el.statusChipTextKur) el.statusChipTextKur.textContent = 'Mendekati Batas 30%';
      }
      if (el.riskBannerKur) {
        el.riskBannerKur.className = 'risk-banner warning';
        if (el.riskTitleKur) el.riskTitleKur.textContent = 'Beban Cicilan Berada di Ambang Batas';
        if (el.riskDescKur) {
          el.riskDescKur.textContent = `Angsuran ${formatRupiah(calc.total)}/bulan memakan ${ratio.toFixed(1)}% laba bersih kas. Masih dapat disetujui bank, namun disarankan memilih tenor yang lebih panjang agar kasir warung tetap leluasa.`;
        }
        if (el.riskIconKur) el.riskIconKur.innerHTML = '<span class="material-symbols-rounded">warning</span>';
      }
    } else {
      if (el.statusChipKur) {
        el.statusChipKur.className = 'status-indicator-chip danger';
        if (el.statusChipTextKur) el.statusChipTextKur.textContent = 'Melampaui Pagar Aman';
      }
      if (el.riskBannerKur) {
        el.riskBannerKur.className = 'risk-banner danger';
        if (el.riskTitleKur) el.riskTitleKur.textContent = 'Peringatan: Berisiko Gangguan Kas!';
        if (el.riskDescKur) {
          el.riskDescKur.textContent = `Beban cicilan ${formatRupiah(calc.total)}/bulan melampaui plafon 30% batas aman kas warung (${ratio.toFixed(1)}%). Segera tingkatkan tenor pinjaman atau turunkan plafon pengajuan agar tidak gagal bayar.`;
        }
        if (el.riskIconKur) el.riskIconKur.innerHTML = '<span class="material-symbols-rounded">error</span>';
      }
    }

    // Status Administrasi Card
    if (el.valStatusPengajuan && el.badgeStatusPengajuan && el.valDescPengajuan) {
      if (state.score >= 70 && ratio <= 30) {
        el.valStatusPengajuan.textContent = 'Memenuhi Syarat';
        el.badgeStatusPengajuan.className = 'badge-status-safe';
        el.badgeStatusPengajuan.textContent = 'Siap Diajukan';
        el.valDescPengajuan.textContent = 'Skor kelayakan & rasio beban kas memenuhi kriteria kredit Himbara.';
      } else if (state.score < 70) {
        el.valStatusPengajuan.textContent = 'Belum Siap';
        el.badgeStatusPengajuan.className = 'badge-status-warning';
        el.badgeStatusPengajuan.textContent = 'Perlu Perbaikan';
        el.valDescPengajuan.textContent = 'Tingkatkan konsistensi pencatatan kas harian di Buku Kas Warung.';
      } else {
        el.valStatusPengajuan.textContent = 'Cicilan Berlebih';
        el.badgeStatusPengajuan.className = 'badge-status-danger';
        el.badgeStatusPengajuan.textContent = 'Beban Kas > 30%';
        el.valDescPengajuan.textContent = 'Pilih tenor lebih panjang agar beban angsuran masuk batas aman.';
      }
    }

    // Update KUR Planner Allocations
    updatePlannerUI();

    // Update Proposal Preview
    if (el.prevPlafon) el.prevPlafon.textContent = formatRupiah(state.plafon);
    if (el.prevTenor) el.prevTenor.textContent = `${state.tenorMonths} Bulan`;
    if (el.prevCicilan) el.prevCicilan.textContent = `${formatRupiah(calc.total)} / bln`;
    if (el.prevRasio) {
      el.prevRasio.textContent = `${ratio.toFixed(1)}% (${ratio <= 30 ? 'Di Bawah Batas 30%' : 'Melebihi Batas 30%'})`;
      el.prevRasio.className = `p-val font-semibold ${ratio <= 30 ? 'text-emerald' : 'text-terracotta'}`;
    }

    // Dynamic NPWP Requirement (Required if plafon > 50jt)
    if (el.itemDocNpwp && el.badgeNpwpStatus && el.descNpwpStatus) {
      if (state.plafon > 50000000) {
        el.badgeNpwpStatus.className = 'doc-status-badge pending';
        el.badgeNpwpStatus.textContent = 'Wajib Dilampirkan';
        el.descNpwpStatus.innerHTML = '<strong class="text-terracotta">Wajib untuk pinjaman di atas Rp 50 Juta</strong> sesuai Peraturan Menko Perekonomian.';
      } else {
        el.badgeNpwpStatus.className = 'doc-status-badge ready';
        el.badgeNpwpStatus.textContent = 'Opsional';
        el.descNpwpStatus.textContent = 'Plafon s.d. Rp 50 Juta tidak diwajibkan menyertakan NPWP.';
      }
    }
  }

  // --- 6. KUR PLANNER UI LOGIC ---
  function updatePlannerUI() {
    const totalPct = state.allocations.kulakan + state.allocations.alat + state.allocations.darurat;
    
    if (el.plannerTotalPct) el.plannerTotalPct.textContent = `${totalPct}%`;
    if (el.plannerTotalStatus) {
      el.plannerTotalStatus.classList.toggle('error', totalPct !== 100);
    }

    const nom1 = Math.round(state.plafon * (state.allocations.kulakan / 100));
    const nom2 = Math.round(state.plafon * (state.allocations.alat / 100));
    const nom3 = Math.round(state.plafon * (state.allocations.darurat / 100));

    if (el.plannerValNominal1) el.plannerValNominal1.textContent = formatRupiah(nom1);
    if (el.plannerValNominal2) el.plannerValNominal2.textContent = formatRupiah(nom2);
    if (el.plannerValNominal3) el.plannerValNominal3.textContent = formatRupiah(nom3);

    if (el.inputPct1) el.inputPct1.value = state.allocations.kulakan;
    if (el.inputPct2) el.inputPct2.value = state.allocations.alat;
    if (el.inputPct3) el.inputPct3.value = state.allocations.darurat;

    if (el.sliderAlloc1) el.sliderAlloc1.value = state.allocations.kulakan;
    if (el.sliderAlloc2) el.sliderAlloc2.value = state.allocations.alat;
    if (el.sliderAlloc3) el.sliderAlloc3.value = state.allocations.darurat;

    if (el.displayAllocTotal) el.displayAllocTotal.textContent = formatRupiah(state.plafon);

    // Stacked segments
    if (el.seg1) el.seg1.style.width = `${state.allocations.kulakan}%`;
    if (el.seg2) el.seg2.style.width = `${state.allocations.alat}%`;
    if (el.seg3) el.seg3.style.width = `${state.allocations.darurat}%`;
  }

  // --- 7. CHECKLIST PROGRESS LOGIC ---
  function updateChecklistProgress() {
    const checkboxes = document.querySelectorAll('.doc-checkbox');
    let checkedCount = 0;
    checkboxes.forEach(cb => {
      if (cb.checked) checkedCount++;
      const parentCard = cb.closest('.doc-check-item');
      if (parentCard) {
        parentCard.classList.toggle('ready', cb.checked);
      }
    });

    const total = checkboxes.length;
    const pct = ((checkedCount / total) * 100).toFixed(1);

    if (el.checklistProgressText) {
      el.checklistProgressText.textContent = `${checkedCount} dari ${total} Siap (${Math.round(pct)}%)`;
    }
    if (el.checklistFillBar) {
      el.checklistFillBar.style.width = `${pct}%`;
    }
  }

  // --- 8. EVENT LISTENERS ---
  function setupEvents() {
    // Plafon Slider
    if (el.rangePlafonKur) {
      el.rangePlafonKur.addEventListener('input', function (e) {
        state.plafon = parseInt(e.target.value, 10);
        updateUI();
      });
    }

    // Plafon Input Field
    if (el.displayPlafonKur) {
      el.displayPlafonKur.addEventListener('blur', function (e) {
        const val = parseRupiah(e.target.value);
        const tier = KUR_TIERS[state.currentTier];
        state.plafon = Math.max(tier.minPlafon, Math.min(tier.maxPlafon, val));
        updateUI();
      });

      el.displayPlafonKur.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') e.target.blur();
      });
    }

    // KUR Tier Selector Cards (Super Mikro, Mikro, Kecil)
    const tierButtons = document.querySelectorAll('.kur-program-card');
    tierButtons.forEach(btn => {
      btn.addEventListener('click', function () {
        const tierId = this.dataset.tier;
        if (!KUR_TIERS[tierId]) return;

        tierButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        state.currentTier = tierId;
        const t = KUR_TIERS[tierId];
        state.plafon = t.defaultPlafon;
        state.tenorMonths = t.defaultTenor;

        // Sync Tenor Pills
        document.querySelectorAll('.tenor-pill').forEach(pill => {
          pill.classList.toggle('active', parseInt(pill.dataset.months, 10) === state.tenorMonths);
        });

        updateUI();
      });
    });

    // Bank Selector Pills
    const bankButtons = document.querySelectorAll('.bank-pill');
    bankButtons.forEach(btn => {
      btn.addEventListener('click', function () {
        bankButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        state.selectedBank = this.dataset.bank;
      });
    });

    // Tenor Pills
    const tenorPills = document.querySelectorAll('.tenor-pill');
    tenorPills.forEach(pill => {
      pill.addEventListener('click', function () {
        tenorPills.forEach(p => p.classList.remove('active'));
        this.classList.add('active');
        state.tenorMonths = parseInt(this.dataset.months, 10);
        updateUI();
      });
    });

    // Reset Simulation
    if (el.btnResetKur) {
      el.btnResetKur.addEventListener('click', function () {
        state.currentTier = 'kur-mikro';
        state.selectedBank = 'bri';
        state.plafon = 50000000;
        state.tenorMonths = 24;
        state.allocations = { kulakan: 60, alat: 30, darurat: 10 };

        tierButtons.forEach(b => b.classList.toggle('active', b.dataset.tier === 'kur-mikro'));
        bankButtons.forEach(b => b.classList.toggle('active', b.dataset.bank === 'bri'));
        tenorPills.forEach(p => p.classList.toggle('active', parseInt(p.dataset.months, 10) === 24));

        updateUI();
      });
    }

    // KUR Planner Slider 1 (Kulakan)
    el.sliderAlloc1?.addEventListener('input', function (e) {
      state.allocations.kulakan = parseInt(e.target.value, 10);
      updatePlannerUI();
    });

    // KUR Planner Slider 2 (Alat)
    el.sliderAlloc2?.addEventListener('input', function (e) {
      state.allocations.alat = parseInt(e.target.value, 10);
      updatePlannerUI();
    });

    // KUR Planner Slider 3 (Darurat)
    el.sliderAlloc3?.addEventListener('input', function (e) {
      state.allocations.darurat = parseInt(e.target.value, 10);
      updatePlannerUI();
    });

    // KUR Planner Number Inputs
    el.inputPct1?.addEventListener('change', function (e) {
      state.allocations.kulakan = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
      updatePlannerUI();
    });
    el.inputPct2?.addEventListener('change', function (e) {
      state.allocations.alat = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
      updatePlannerUI();
    });
    el.inputPct3?.addEventListener('change', function (e) {
      state.allocations.darurat = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
      updatePlannerUI();
    });

    // Checklist Checkbox Listeners
    document.querySelectorAll('.doc-checkbox').forEach(cb => {
      cb.addEventListener('change', updateChecklistProgress);
    });

    // Save KUR Simulation to Portfolio & Guardrail
    if (el.btnSaveKur) {
      el.btnSaveKur.addEventListener('click', function () {
        const tier = KUR_TIERS[state.currentTier];
        const calc = calculateInstallment(state.plafon, tier.rate, state.tenorMonths);
        const simData = {
          date: new Date().toISOString(),
          programId: state.currentTier,
          program: `${tier.name} (${BANKS[state.selectedBank] || 'Bank BRI'})`,
          plafon: state.plafon,
          tenor: state.tenorMonths,
          installment: calc.total,
          ratio: (calc.total / state.netProfit) * 100,
          allocations: state.allocations
        };

        try {
          localStorage.setItem('utera_saved_kur_sim', JSON.stringify(simData));
          // Synchronize with shared guardrail storage for dashboard preview
          localStorage.setItem('utera_saved_guardrail', JSON.stringify(simData));
          if (window.uteraSupabase) {
            window.uteraSupabase.from('profil_usaha').select('id').limit(1).then(({ data }) => {
              const profilId = data && data[0] ? data[0].id : null;
              window.uteraSupabase.from('legalitas_dokumen').insert([{
                profil_id: profilId,
                kategori: 'simulasi_kur',
                nama_dokumen: 'Simulasi KUR ' + simData.type + ' (Rp ' + simData.amount.toLocaleString('id-ID') + ')',
                nomor_dokumen: 'KUR-' + Date.now().toString(36).toUpperCase()
              }]).then(() => console.log('☁️ Simulasi KUR tersimpan di Supabase Cloud.')).catch(() => {});
            }).catch(() => {});
          }
        } catch (e) {
          console.warn('Storage save error:', e);
        }

        const originalText = el.btnSaveKur.innerHTML;
        el.btnSaveKur.innerHTML = '<span class="material-symbols-rounded btn-icon">check</span><span>Tersimpan di Portofolio!</span>';
        el.btnSaveKur.style.background = 'var(--emerald)';

        setTimeout(() => {
          el.btnSaveKur.innerHTML = originalText;
          el.btnSaveKur.style.background = '';
        }, 2200);
      });
    }

    // Print & Export Handlers
    el.btnPrintKurReport?.addEventListener('click', () => window.print());
    el.btnExportKurPdf?.addEventListener('click', () => window.print());

    // Mobile Sidebar Drawer
    if (el.btnMobileMenu && el.appSidebar && el.sidebarBackdrop) {
      el.btnMobileMenu.addEventListener('click', () => {
        el.appSidebar.classList.add('open');
        el.sidebarBackdrop.classList.add('active');
      });

      el.sidebarBackdrop.addEventListener('click', () => {
        el.appSidebar.classList.remove('open');
        el.sidebarBackdrop.classList.remove('active');
      });

      el.btnCollapseSidebar?.addEventListener('click', () => {
        el.appSidebar.classList.remove('open');
        el.sidebarBackdrop.classList.remove('active');
      });
    }

    // Global Search Focus Shortcut (Cmd+F / Ctrl+F)
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        if (el.globalSearch) {
          e.preventDefault();
          el.globalSearch.focus();
        }
      }
    });
  }

  // --- 9. INITIALIZATION ---
  function init() {
    // 1. Integrasi Satu Sumber Data dari Buku Kas Warung (UteraKas)
    try {
      if (window.UteraKas && typeof window.UteraKas.load === 'function') {
        const allTx = window.UteraKas.load();
        
        // Update badge jumlah transaksi di sidebar
        const sidebarBadge = document.getElementById('sidebar-badge-tx');
        if (sidebarBadge && allTx.length > 0) {
          sidebarBadge.textContent = allTx.length;
        }

        // Hitung rata-rata laba bersih bulanan riil
        if (allTx.length > 0) {
          let inc = 0;
          let exp = 0;
          const monthsSet = new Set();

          allTx.forEach(tx => {
            if (tx.date && tx.date.length >= 7) {
              monthsSet.add(tx.date.substring(0, 7));
            }
            if (tx.type === 'income') inc += (tx.amount || 0);
            else if (tx.type === 'expense') exp += (tx.amount || 0);
          });

          const monthCount = Math.max(1, monthsSet.size);
          const computedAvgProfit = Math.round((inc - exp) / monthCount);
          if (computedAvgProfit > 1000000) {
            state.netProfit = computedAvgProfit;
          }
        }
      }
    } catch (e) {
      console.warn('Gagal membaca data kas:', e);
    }

    // 2. Baca skor kelayakan jika ada di localStorage
    try {
      const storedScore = localStorage.getItem('utera_skor_value');
      if (storedScore) {
        const parsed = parseInt(storedScore, 10);
        if (!isNaN(parsed) && parsed > 0) {
          state.score = parsed;
        }
      }
    } catch (e) {
      // Gunakan default 84
    }

    // 3. Pulihkan simulasi terakhir jika ada
    try {
      const savedRaw = localStorage.getItem('utera_saved_kur_sim');
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        if (saved.plafon && saved.tenor) {
          state.plafon = saved.plafon;
          state.tenorMonths = saved.tenor;
          if (saved.programId && KUR_TIERS[saved.programId]) {
            state.currentTier = saved.programId;
          }
          if (saved.allocations) {
            state.allocations = saved.allocations;
          }
        }
      }
    } catch (e) {
      // Gunakan default
    }

    setupEvents();
    updateUI();
    updateChecklistProgress();

    // Dynamic User Profile Sync
    try {
      let userName = localStorage.getItem('utera_user_name');
      let bizName = localStorage.getItem('utera_nama_usaha');
      const userEmail = localStorage.getItem('utera_user_email');
      const profRaw = localStorage.getItem('utera_profil_usaha');
      if (profRaw) {
        const profs = JSON.parse(profRaw);
        if (Array.isArray(profs) && profs[0]) {
          if (profs[0].nama_pemilik) userName = profs[0].nama_pemilik;
          if (profs[0].nama_usaha) bizName = profs[0].nama_usaha;
        }
      }
      if (!userName && userEmail) userName = userEmail.split('@')[0];
      if (userName) {
        const elUserName = document.querySelector('.user-name-label');
        if (elUserName) elUserName.textContent = userName;
        const elAvatar = document.querySelector('.user-avatar-circle');
        if (elAvatar) {
          const initials = userName.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
          elAvatar.textContent = initials || 'U';
        }
      }
      if (bizName) {
        const elBizName = document.querySelector('.business-title');
        if (elBizName) elBizName.textContent = bizName;
      }
    } catch (e) {}
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
