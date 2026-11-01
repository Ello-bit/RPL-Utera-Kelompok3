/**
 * UTERA Guardrail 30% Arus Kas & Simulasi Pembiayaan
 * Module: guardrail/app.js
 * Implementation: Pure Vanilla JS, Zero framework dependency
 */

(function () {
  'use strict';

  // --- 1. STATE & CONSTANTS ---
  const DEFAULT_NET_PROFIT = 18450000; // Rp 18.450.000 from Buku Kas Warung
  const GUARDRAIL_PERCENT = 0.30;      // 30% Safe Ceiling

  const PROGRAMS = {
    'kur-mikro': {
      id: 'kur-mikro',
      name: 'KUR Mikro Bank (BRI / Mandiri)',
      sub: 'Bunga subsidi pemerintah 6% p.a.',
      rate: 0.06,
      rateDisplay: '6.0%',
      method: 'anuitas',
      minPlafon: 5000000,
      maxPlafon: 100000000,
      defaultPlafon: 50000000,
      defaultTenor: 24
    },
    'kur-super': {
      id: 'kur-super',
      name: 'KUR Super Mikro',
      sub: 'Bunga subsidi 3% p.a.',
      rate: 0.03,
      rateDisplay: '3.0%',
      method: 'anuitas',
      minPlafon: 1000000,
      maxPlafon: 10000000,
      defaultPlafon: 10000000,
      defaultTenor: 12
    },
    'koperasi': {
      id: 'koperasi',
      name: 'Pinjaman Koperasi Usaha',
      sub: 'Bunga jasa 9% p.a. flat',
      rate: 0.09,
      rateDisplay: '9.0%',
      method: 'flat',
      minPlafon: 3000000,
      maxPlafon: 50000000,
      defaultPlafon: 25000000,
      defaultTenor: 12
    }
  };

  let state = {
    netProfit: DEFAULT_NET_PROFIT,
    currentProgram: 'kur-mikro',
    plafon: 50000000,
    tenorMonths: 24
  };

  // --- 2. DOM ELEMENTS ---
  const el = {
    valNetProfit: document.getElementById('val-net-profit'),
    valGuardrailLimit: document.getElementById('val-guardrail-limit'),
    valEstInstallment: document.getElementById('val-est-installment'),
    valRatioBadge: document.getElementById('val-ratio-badge'),
    valInstallmentSub: document.getElementById('val-installment-sub'),
    valRemainingCash: document.getElementById('val-remaining-cash'),

    rangePlafon: document.getElementById('range-plafon'),
    displayPlafon: document.getElementById('display-plafon'),
    displayTenor: document.getElementById('display-tenor'),
    tenorSelector: document.getElementById('tenor-selector'),
    displayInterestRate: document.getElementById('display-interest-rate'),

    statusChip: document.getElementById('status-chip'),
    statusChipText: document.getElementById('status-chip-text'),
    gaugePct: document.getElementById('gauge-pct'),
    trackFill: document.getElementById('track-fill'),
    riskBanner: document.getElementById('risk-banner'),
    riskTitle: document.getElementById('risk-title'),
    riskDesc: document.getElementById('risk-desc'),
    riskIcon: document.getElementById('risk-icon'),

    valPrincipal: document.getElementById('val-principal'),
    valInterest: document.getElementById('val-interest'),
    valTotalInstallment: document.getElementById('val-total-installment'),

    comparisonTbody: document.getElementById('comparison-tbody'),
    allocVal1: document.getElementById('alloc-val-1'),
    allocVal2: document.getElementById('alloc-val-2'),
    allocVal3: document.getElementById('alloc-val-3'),

    btnResetSim: document.getElementById('btn-reset-sim'),
    btnSaveSim: document.getElementById('btn-save-simulation'),
    btnExportPdf: document.getElementById('btn-export-pdf'),
    btnMobileMenu: document.getElementById('btn-mobile-menu'),
    appSidebar: document.getElementById('app-sidebar'),
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
    const cleaned = str.replace(/[^0-9]/g, '');
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? 0 : num;
  }

  // --- 4. FINANCIAL CALCULATION ENGINE ---
  /**
   * Calculate monthly installment:
   * - Anuitas: P * (r * (1 + r)^n) / ((1 + r)^n - 1)
   * - Flat: (P / n) + (P * r)
   */
  function calculateInstallment(principal, annualRate, months, method) {
    if (months <= 0 || principal <= 0) return { total: 0, pokok: 0, bunga: 0 };

    const monthlyRate = annualRate / 12;

    if (method === 'flat') {
      const pokok = principal / months;
      const bunga = principal * monthlyRate;
      return {
        pokok: Math.round(pokok),
        bunga: Math.round(bunga),
        total: Math.round(pokok + bunga)
      };
    } else {
      // Anuitas
      if (monthlyRate === 0) {
        const pokok = principal / months;
        return { pokok: Math.round(pokok), bunga: 0, total: Math.round(pokok) };
      }
      const factor = Math.pow(1 + monthlyRate, months);
      const total = principal * (monthlyRate * factor) / (factor - 1);
      const pokok = principal / months;
      const bunga = total - pokok;
      return {
        pokok: Math.round(pokok),
        bunga: Math.round(bunga),
        total: Math.round(total)
      };
    }
  }

  // --- 5. RENDER & UPDATE UI ---
  function updateUI() {
    const prog = PROGRAMS[state.currentProgram];
    const calc = calculateInstallment(state.plafon, prog.rate, state.tenorMonths, prog.method);
    const guardrailLimit = state.netProfit * GUARDRAIL_PERCENT;
    const ratio = (calc.total / state.netProfit) * 100;
    const remainingCash = Math.max(0, state.netProfit - calc.total);
    const remainingPct = ((remainingCash / state.netProfit) * 100).toFixed(1);

    // Update KPI Header Cards
    if (el.valNetProfit) el.valNetProfit.textContent = formatRupiah(state.netProfit);
    if (el.valGuardrailLimit) el.valGuardrailLimit.textContent = formatRupiah(guardrailLimit);
    if (el.valEstInstallment) el.valEstInstallment.textContent = formatRupiah(calc.total);
    if (el.valRatioBadge) el.valRatioBadge.textContent = `${ratio.toFixed(1)}% dari laba`;
    if (el.valInstallmentSub) {
      el.valInstallmentSub.textContent = `Plafon ${formatRupiah(state.plafon)} • Tenor ${state.tenorMonths} bulan`;
    }
    if (el.valRemainingCash) el.valRemainingCash.textContent = formatRupiah(remainingCash);

    // Update Slider & Text
    if (el.rangePlafon) {
      el.rangePlafon.min = prog.minPlafon;
      el.rangePlafon.max = prog.maxPlafon;
      el.rangePlafon.value = state.plafon;
    }
    if (el.displayPlafon) {
      el.displayPlafon.value = state.plafon.toLocaleString('id-ID');
    }
    if (el.displayTenor) {
      const years = (state.tenorMonths / 12).toFixed(state.tenorMonths % 12 === 0 ? 0 : 1);
      el.displayTenor.textContent = `${state.tenorMonths} Bulan (${years} Tahun)`;
    }
    if (el.displayInterestRate) {
      el.displayInterestRate.textContent = prog.rateDisplay;
    }

    // Update Breakdown
    if (el.valPrincipal) el.valPrincipal.textContent = formatRupiah(calc.pokok);
    if (el.valInterest) el.valInterest.textContent = formatRupiah(calc.bunga);
    if (el.valTotalInstallment) el.valTotalInstallment.textContent = formatRupiah(calc.total);

    // Update Gauge Center Stat
    if (el.gaugePct) {
      el.gaugePct.textContent = ratio.toFixed(1).replace('.', ',') + '%';
      el.gaugePct.classList.remove('warning', 'danger');
      if (ratio > 30) {
        el.gaugePct.classList.add('danger');
      } else if (ratio > 20) {
        el.gaugePct.classList.add('warning');
      }
    }

    // Update Visual Multi-segment Progress Bar
    // The bar max scale is 45% (so 30% threshold sits exactly at 30/45 = 66.6% or 100% of 30%)
    if (el.trackFill) {
      // Map 0 - 30% to 0 - 100% of the safe track width
      const barPercent = Math.min(100, (ratio / 30) * 100);
      el.trackFill.style.width = `${barPercent}%`;

      el.trackFill.className = '';
      if (ratio <= 20) {
        el.trackFill.className = 'track-fill-safe';
      } else if (ratio <= 30) {
        el.trackFill.className = 'track-fill-warning';
      } else {
        el.trackFill.className = 'track-fill-danger';
      }
    }

    // Update Status Indicator Chip & Risk Banner
    if (ratio <= 20) {
      // Safe Condition
      if (el.statusChip) {
        el.statusChip.className = 'status-indicator-chip safe';
        if (el.statusChipText) el.statusChipText.textContent = 'Kondisi Aman';
      }
      if (el.riskBanner) {
        el.riskBanner.className = 'risk-banner safe';
        if (el.riskTitle) el.riskTitle.textContent = 'Kapasitas Likuiditas Sangat Baik';
        if (el.riskDesc) {
          el.riskDesc.textContent = `Angsuran ${formatRupiah(calc.total)}/bulan hanya memakan ${ratio.toFixed(1)}% laba bersih kas warung. Anda masih memiliki bantalan kas ${remainingPct}% (${formatRupiah(remainingCash)}) untuk mengamankan operasional harian warung.`;
        }
        if (el.riskIcon) el.riskIcon.innerHTML = '<span class="material-symbols-rounded">check_circle</span>';
      }
    } else if (ratio <= 30) {
      // Warning Condition
      if (el.statusChip) {
        el.statusChip.className = 'status-indicator-chip warning';
        if (el.statusChipText) el.statusChipText.textContent = 'Batas Waspada';
      }
      if (el.riskBanner) {
        el.riskBanner.className = 'risk-banner warning';
        if (el.riskTitle) el.riskTitle.textContent = 'Mendekati Batas Pagar Aman (30%)';
        if (el.riskDesc) {
          el.riskDesc.textContent = `Angsuran ${formatRupiah(calc.total)}/bulan memakan ${ratio.toFixed(1)}% laba kas Anda. Tetap aman namun disarankan menjaga stabilitas pengeluaran agar cadangan modal harian tidak terganggu.`;
        }
        if (el.riskIcon) el.riskIcon.innerHTML = '<span class="material-symbols-rounded">warning</span>';
      }
    } else {
      // Danger Condition
      if (el.statusChip) {
        el.statusChip.className = 'status-indicator-chip danger';
        if (el.statusChipText) el.statusChipText.textContent = 'Melampaui Batas (Berisiko)';
      }
      if (el.riskBanner) {
        el.riskBanner.className = 'risk-banner danger';
        if (el.riskTitle) el.riskTitle.textContent = 'Risiko Gangguan Likuiditas Kas!';
        if (el.riskDesc) {
          el.riskDesc.textContent = `Beban cicilan ${formatRupiah(calc.total)}/bulan melampaui plafon aman 30% (${ratio.toFixed(1)}%). Segera tingkatkan tenor pinjaman atau kurangi nominal plafon agar warung tidak gagal bayar.`;
        }
        if (el.riskIcon) el.riskIcon.innerHTML = '<span class="material-symbols-rounded">error</span>';
      }
    }

    // Update KUR Planner Allocations (F10 PRD)
    const alloc1 = Math.round(state.plafon * 0.60);
    const alloc2 = Math.round(state.plafon * 0.30);
    const alloc3 = Math.round(state.plafon * 0.10);

    if (el.allocVal1) el.allocVal1.textContent = `${formatRupiah(alloc1)} (60%)`;
    if (el.allocVal2) el.allocVal2.textContent = `${formatRupiah(alloc2)} (30%)`;
    if (el.allocVal3) el.allocVal3.textContent = `${formatRupiah(alloc3)} (10%)`;
  }

  // --- 6. EVENT LISTENERS ---
  function setupEvents() {
    // Range Slider
    if (el.rangePlafon) {
      el.rangePlafon.addEventListener('input', function (e) {
        state.plafon = parseInt(e.target.value, 10);
        updateUI();
      });
    }

    // Plafon Text Input
    if (el.displayPlafon) {
      el.displayPlafon.addEventListener('blur', function (e) {
        const val = parseRupiah(e.target.value);
        const prog = PROGRAMS[state.currentProgram];
        state.plafon = Math.max(prog.minPlafon, Math.min(prog.maxPlafon, val));
        updateUI();
      });

      el.displayPlafon.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.target.blur();
        }
      });
    }

    // Program Tabs Selection
    const programButtons = document.querySelectorAll('.program-tab');
    programButtons.forEach(btn => {
      btn.addEventListener('click', function () {
        const progId = this.dataset.program;
        if (!PROGRAMS[progId]) return;

        programButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        state.currentProgram = progId;
        const p = PROGRAMS[progId];
        state.plafon = p.defaultPlafon;
        state.tenorMonths = p.defaultTenor;

        // Sync tenor pills
        document.querySelectorAll('.tenor-pill').forEach(pill => {
          pill.classList.toggle('active', parseInt(pill.dataset.months, 10) === state.tenorMonths);
        });

        updateUI();
      });
    });

    // Tenor Pills Selection
    const tenorPills = document.querySelectorAll('.tenor-pill');
    tenorPills.forEach(pill => {
      pill.addEventListener('click', function () {
        tenorPills.forEach(p => p.classList.remove('active'));
        this.classList.add('active');
        state.tenorMonths = parseInt(this.dataset.months, 10);
        updateUI();
      });
    });

    // Reset Simulation Button
    if (el.btnResetSim) {
      el.btnResetSim.addEventListener('click', function () {
        state.currentProgram = 'kur-mikro';
        state.plafon = 50000000;
        state.tenorMonths = 24;

        programButtons.forEach(b => {
          b.classList.toggle('active', b.dataset.program === 'kur-mikro');
        });
        tenorPills.forEach(p => {
          p.classList.toggle('active', parseInt(p.dataset.months, 10) === 24);
        });

        updateUI();
      });
    }

    // Save Simulation to Portfolio
    if (el.btnSaveSim) {
      el.btnSaveSim.addEventListener('click', function () {
        const prog = PROGRAMS[state.currentProgram];
        const calc = calculateInstallment(state.plafon, prog.rate, state.tenorMonths, prog.method);
        const simData = {
          date: new Date().toISOString(),
          programId: state.currentProgram,
          program: prog.name,
          plafon: state.plafon,
          tenor: state.tenorMonths,
          installment: calc.total,
          ratio: (calc.total / state.netProfit) * 100
        };

        try {
          localStorage.setItem('utera_saved_guardrail', JSON.stringify(simData));
        } catch (e) {
          console.warn('Storage save error:', e);
        }

        const originalText = el.btnSaveSim.innerHTML;
        el.btnSaveSim.innerHTML = '<span class="material-symbols-rounded btn-icon">check</span><span>Tersimpan di Portofolio!</span>';
        el.btnSaveSim.style.background = 'var(--emerald)';

        setTimeout(() => {
          el.btnSaveSim.innerHTML = originalText;
          el.btnSaveSim.style.background = '';
        }, 2200);
      });
    }

    // Export PDF / Print Result
    if (el.btnExportPdf) {
      el.btnExportPdf.addEventListener('click', function () {
        window.print();
      });
    }

    // Mobile Sidebar Drawer
    if (el.btnMobileMenu && el.appSidebar && el.sidebarBackdrop) {
      el.btnMobileMenu.addEventListener('click', function () {
        el.appSidebar.classList.add('open');
        el.sidebarBackdrop.classList.add('active');
      });

      el.sidebarBackdrop.addEventListener('click', function () {
        el.appSidebar.classList.remove('open');
        el.sidebarBackdrop.classList.remove('active');
      });

      if (el.btnCollapseSidebar) {
        el.btnCollapseSidebar.addEventListener('click', function () {
          el.appSidebar.classList.remove('open');
          el.sidebarBackdrop.classList.remove('active');
        });
      }
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

  // --- 7. INITIALIZATION & DATA INTEGRATION ---
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

        // Hitung rata-rata laba bersih bulanan riil dari catatan kas
        if (allTx.length > 0) {
          let inc = 0;
          let exp = 0;
          const monthsSet = new Set();

          allTx.forEach(tx => {
            if (tx.date && tx.date.length >= 7) {
              monthsSet.add(tx.date.substring(0, 7)); // 'YYYY-MM'
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
      console.warn('Gagal membaca data live Buku Kas:', e);
    }

    // 2. Pulihkan simulasi terakhir yang tersimpan di browser jika ada
    try {
      const savedRaw = localStorage.getItem('utera_saved_guardrail');
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        if (saved.plafon && saved.tenor) {
          state.plafon = saved.plafon;
          state.tenorMonths = saved.tenor;
          if (saved.programId && PROGRAMS[saved.programId]) {
            state.currentProgram = saved.programId;
          }
        }
      }
    } catch (e) {
      // Gunakan default
    }

    // Sinkronkan tab program yang aktif
    document.querySelectorAll('.program-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.program === state.currentProgram);
    });

    // Sinkronkan pill tenor yang aktif
    document.querySelectorAll('.tenor-pill').forEach(pill => {
      pill.classList.toggle('active', parseInt(pill.dataset.months, 10) === state.tenorMonths);
    });

    setupEvents();
    updateUI();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
