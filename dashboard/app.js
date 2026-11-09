/**
 * UTERA Dashboard Logic
 * antislop-code compliant: concise, purposeful logic for UMKM financial calculations.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Transaksi diambil dari penyimpanan bersama Buku Kas Warung ---
  const Kas = window.UteraKas;
  const RECENT_LIMIT = 5;

  function describeDate(iso) {
    const today = Kas.toISODate(new Date());
    const y = new Date();
    y.setDate(y.getDate() - 1);
    if (iso === today) return 'Hari ini';
    if (iso === Kas.toISODate(y)) return 'Kemarin';
    const p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function loadRecent() {
    return Kas.sortLedger(Kas.load()).reverse().slice(0, RECENT_LIMIT).map(tx => ({
      id: tx.id,
      time: describeDate(tx.date),
      category: tx.category,
      desc: tx.note || tx.category,
      type: tx.type,
      amount: tx.amount
    }));
  }

  let transactions = loadRecent();

  // DOM Elements
  const txTableBody = document.getElementById('tx-table-body');
  const badgeTotalTx = document.getElementById('badge-total-tx');
  const txCountDisplay = document.getElementById('tx-count-display');
  const filterTxType = document.getElementById('filter-tx-type');

  // Metric Cards Elements
  const valSaldo = document.getElementById('val-saldo');
  const valPemasukan = document.getElementById('val-pemasukan');
  const valPengeluaran = document.getElementById('val-pengeluaran');
  const valMaxCicilan = document.getElementById('val-max-cicilan');
  const valSkor = document.getElementById('val-skor');
  const navPillSkor = document.getElementById('nav-pill-skor');
  // Modal Elements
  const modalBackdrop = document.getElementById('modal-tx-backdrop');
  const btnOpenModal = document.getElementById('btn-open-tx-modal');
  const btnAddTxRow = document.getElementById('btn-add-tx-row');
  const btnCloseModal = document.getElementById('btn-close-tx-modal');
  const btnCancelTx = document.getElementById('btn-cancel-tx');
  const formNewTx = document.getElementById('form-new-tx');
  const labelIncome = document.getElementById('label-type-income');
  const labelExpense = document.getElementById('label-type-expense');

  // Sidebar Mobile Toggle
  const sidebar = document.getElementById('app-sidebar');
  const btnMobileMenu = document.getElementById('btn-mobile-menu');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const btnCollapseSidebar = document.getElementById('btn-collapse-sidebar');

  // Helper: Format Indonesian Rupiah
  function formatRupiah(number) {
    return 'Rp ' + Number(number).toLocaleString('id-ID');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Calculate & Update Metrics
  function recalculateMetrics() {
    const allTx = (typeof Kas !== 'undefined' && Kas.load) ? Kas.load() : [];
    let totalIncome = 0;
    let totalExpense = 0;

    allTx.forEach(tx => {
      if (tx.type === 'income') {
        totalIncome += tx.amount;
      } else {
        totalExpense += tx.amount;
      }
    });

    const netProfit = totalIncome - totalExpense;
    const maxInstallment30Pct = Math.max(0, Math.round(netProfit * 0.30));

    // Dynamic PRD Score Formula (Pillar 2: Consistency + Cashflow Health)
    let score = 0;
    if (totalIncome > 0) {
      const marginRatio = netProfit / totalIncome;
      score = Math.min(96, Math.max(40, Math.round(50 + (marginRatio * 45))));
    } else if (allTx.length > 0) {
      score = 50;
    } else {
      score = 0; // Akun baru yang belum memiliki transaksi
    }

    if (valPemasukan) valPemasukan.textContent = formatRupiah(totalIncome);
    if (valPengeluaran) valPengeluaran.textContent = formatRupiah(totalExpense);
    if (valSaldo) valSaldo.textContent = formatRupiah(netProfit);
    if (valMaxCicilan) valMaxCicilan.textContent = formatRupiah(maxInstallment30Pct) + ' / bln';
    if (valSkor) valSkor.textContent = score;
    if (navPillSkor) navPillSkor.textContent = score;
    if (badgeTotalTx) {
      badgeTotalTx.textContent = allTx.length;
    }

    // Skor status badge
    const badgeSkorStatus = document.querySelector('.badge-status-good');
    if (badgeSkorStatus) {
      if (allTx.length === 0) {
        badgeSkorStatus.textContent = 'Belum Ada Transaksi';
        badgeSkorStatus.style.background = '#F1F5F9';
        badgeSkorStatus.style.color = '#64748B';
      } else if (score >= 70) {
        badgeSkorStatus.textContent = 'Layak KUR Mikro';
        badgeSkorStatus.style.background = '';
        badgeSkorStatus.style.color = '';
      } else {
        badgeSkorStatus.textContent = 'Perlu Peningkatan';
        badgeSkorStatus.style.background = '#FEF3C7';
        badgeSkorStatus.style.color = '#B45309';
      }
    }

    // Chart highlight number
    const chartHighlight = document.getElementById('chart-highlight-number');
    if (chartHighlight) {
      chartHighlight.textContent = formatRupiah(totalIncome);
    }

    // Dynamic Guardrail Meter & Capacity Formula
    const capFormula = document.querySelector('.capacity-formula');
    if (capFormula) {
      capFormula.textContent = `30% x Rata-rata Laba Bersih (${formatRupiah(netProfit)})`;
    }
    const meterFill = document.querySelector('.meter-bar-fill');
    const meterActive = document.querySelector('.meter-labels .text-safe');
    const meterMax = document.querySelector('.meter-labels span:last-child');

    let savedInstallment = 0;
    try {
      const savedRaw = localStorage.getItem('utera_saved_guardrail');
      if (savedRaw) {
        const s = JSON.parse(savedRaw);
        if (s && s.installment) savedInstallment = Number(s.installment) || 0;
      }
    } catch (e) {}

    if (allTx.length === 0 || netProfit <= 0) {
      if (meterFill) meterFill.style.width = '0%';
      if (meterActive) meterActive.textContent = 'Cicilan Aktif: Rp 0';
      if (meterMax) meterMax.textContent = 'Maks Rp 0';
    } else {
      if (meterMax) meterMax.textContent = 'Maks ' + formatRupiah(maxInstallment30Pct);
      if (savedInstallment > 0) {
        const fillPct = Math.min(100, Math.round((savedInstallment / maxInstallment30Pct) * 100));
        if (meterFill) {
          meterFill.style.width = fillPct + '%';
          meterFill.className = fillPct <= 100 ? 'meter-bar-fill safe' : 'meter-bar-fill danger';
        }
        if (meterActive) meterActive.textContent = 'Simulasi Teruji: ' + formatRupiah(savedInstallment);
      } else {
        if (meterFill) meterFill.style.width = '0%';
        if (meterActive) meterActive.textContent = 'Cicilan Aktif: Rp 0';
      }
    }

    // Dynamic Guardrail Financing Status Cards
    const loanOptions = document.querySelectorAll('.guardrail-actions-list .loan-option-card');
    if (loanOptions.length >= 2) {
      // Card 1: KUR BRI 6% (Cicilan ~ Rp 2.216.000)
      const briStatus = loanOptions[0].querySelector('.loan-status');
      if (briStatus) {
        if (allTx.length === 0 || netProfit <= 0) {
          briStatus.className = 'loan-status';
          briStatus.style.color = '#94A3B8';
          briStatus.textContent = '○ Belum Ada Saldo Kas';
        } else if (maxInstallment30Pct >= 2216000) {
          briStatus.className = 'loan-status text-emerald';
          briStatus.style.color = '';
          briStatus.textContent = '✓ Masuk Batas Kas';
        } else {
          briStatus.className = 'loan-status text-terracotta';
          briStatus.style.color = '';
          briStatus.textContent = '⚠️ Melebihi Batas 30%';
        }
      }

      // Card 2: Pinjaman Koperasi Usaha (Cicilan ~ Rp 2.291.000)
      const kopStatus = loanOptions[1].querySelector('.loan-status');
      if (kopStatus) {
        if (allTx.length === 0 || netProfit <= 0) {
          kopStatus.className = 'loan-status';
          kopStatus.style.color = '#94A3B8';
          kopStatus.textContent = '○ Belum Ada Saldo Kas';
        } else if (maxInstallment30Pct >= 2291000) {
          kopStatus.className = 'loan-status text-emerald';
          kopStatus.style.color = '';
          kopStatus.textContent = '✓ Masuk Batas Kas';
        } else {
          kopStatus.className = 'loan-status text-terracotta';
          kopStatus.style.color = '';
          kopStatus.textContent = '⚠️ Melebihi Batas 30%';
        }
      }
    }

    // Render Dynamic Sub-panels
    renderMonthlyCashflowChart(allTx, 'omzet');
    renderSalesDistribution(allTx);
    renderLegalitasChecklist(allTx);
  }

  // 1. Dynamic Monthly Cashflow Chart Renderer
  function renderMonthlyCashflowChart(allTx, mode = 'omzet') {
    const container = document.getElementById('dashboard-chart-columns');
    if (!container) return;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    if (!allTx || allTx.length === 0) {
      container.innerHTML = `
        <div class="chart-col">
          <div class="col-bars"><div class="bar bar-income" style="height:6px;" title="Rp 0"></div><div class="bar bar-expense" style="height:6px;" title="Rp 0"></div></div>
          <span class="col-label">Bulan -3</span>
        </div>
        <div class="chart-col">
          <div class="col-bars"><div class="bar bar-income" style="height:6px;" title="Rp 0"></div><div class="bar bar-expense" style="height:6px;" title="Rp 0"></div></div>
          <span class="col-label">Bulan -2</span>
        </div>
        <div class="chart-col">
          <div class="col-bars"><div class="bar bar-income" style="height:6px;" title="Rp 0"></div><div class="bar bar-expense" style="height:6px;" title="Rp 0"></div></div>
          <span class="col-label">Bulan Lalu</span>
        </div>
        <div class="chart-col active-month">
          <div class="col-bars"><div class="bar bar-income highlight" style="height:6px;" title="Rp 0"><span class="bar-tooltip">Rp 0</span></div><div class="bar bar-expense" style="height:6px;" title="Rp 0"></div></div>
          <span class="col-label font-bold">Kini</span>
        </div>
        <div class="chart-col projected">
          <div class="col-bars"><div class="bar bar-income dashed" style="height:6px;"></div><div class="bar bar-expense dashed" style="height:6px;"></div></div>
          <span class="col-label">Target</span>
        </div>
      `;
      const trendPill = document.querySelector('.chart-summary-header .trend-pill');
      if (trendPill) {
        trendPill.innerHTML = '<span class="material-symbols-rounded trend-icon">horizontal_rule</span><span>0% Belum ada data</span>';
      }
      const healthBanner = document.querySelector('.chart-footer-banner');
      if (healthBanner) {
        healthBanner.innerHTML = '<div class="health-indicator"><span class="status-circle" style="background:#94A3B8;"></span><strong>Mulai Pembukuan:</strong> Catat transaksi kas harian pertama Anda untuk mengaktifkan grafik arus kas dan analisis kelayakan KUR.</div>';
      }
      const chartHighlight = document.getElementById('chart-highlight-number');
      if (chartHighlight) chartHighlight.textContent = 'Rp 0';
      return;
    }

    // Determine 4-month timeline ending with current month
    let refYear = 2026;
    let refMonth = 10; // default October 2026 based on project context
    
    // Find latest transaction date
    allTx.forEach(tx => {
      if (tx.date) {
        const parts = tx.date.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(y) && !isNaN(m)) {
          if (y > refYear || (y === refYear && m > refMonth)) {
            refYear = y;
            refMonth = m;
          }
        }
      }
    });

    // Build array of 4 consecutive months leading to (refYear, refMonth)
    const displayKeys = [];
    for (let offset = 3; offset >= 0; offset--) {
      let dMonth = refMonth - offset;
      let dYear = refYear;
      while (dMonth <= 0) {
        dMonth += 12;
        dYear -= 1;
      }
      const key = `${dYear}-${String(dMonth).padStart(2, '0')}`;
      displayKeys.push(key);
    }

    // Group actual transactions into monthsMap
    const monthsMap = {};
    displayKeys.forEach(k => {
      monthsMap[k] = { key: k, income: 0, expense: 0 };
    });

    allTx.forEach(tx => {
      const key = tx.date ? tx.date.slice(0, 7) : `${refYear}-${String(refMonth).padStart(2, '0')}`;
      if (!monthsMap[key]) monthsMap[key] = { key, income: 0, expense: 0 };
      if (tx.type === 'income') monthsMap[key].income += tx.amount;
      else monthsMap[key].expense += tx.amount;
    });

    let maxVal = 100000;
    displayKeys.forEach(k => {
      const m = monthsMap[k];
      maxVal = Math.max(maxVal, m.income, m.expense, Math.abs(m.income - m.expense));
    });

    container.innerHTML = displayKeys.map((k, idx) => {
      const m = monthsMap[k];
      const isLatest = idx === displayKeys.length - 1;
      const parts = k.split('-');
      const mIdx = parseInt(parts[1], 10) - 1;
      const mName = monthNames[mIdx] || k;
      const label = isLatest ? `${mName} (Kini)` : mName;

      const net = m.income - m.expense;
      const displayVal = mode === 'omzet' ? m.income : net;

      // Bar heights in percent (min 6% for zero so baseline is visible)
      const incBarValue = mode === 'omzet' ? m.income : Math.max(0, net);
      const incHeight = incBarValue > 0 ? Math.max(8, Math.min(94, Math.round((incBarValue / maxVal) * 94))) : 6;
      const expHeight = m.expense > 0 ? Math.max(8, Math.min(94, Math.round((m.expense / maxVal) * 94))) : 6;

      return `
        <div class="chart-col ${isLatest ? 'active-month' : ''}">
          <div class="col-bars">
            <div class="bar bar-income ${isLatest ? 'highlight' : ''}" style="height:${incHeight}%;" title="${mode === 'omzet' ? 'Pemasukan' : 'Laba Bersih'} ${mName}: ${formatRupiah(displayVal)}">
              ${isLatest ? `<span class="bar-tooltip">${formatRupiah(displayVal)}</span>` : ''}
            </div>
            <div class="bar bar-expense" style="height:${expHeight}%;" title="Pengeluaran ${mName}: ${formatRupiah(m.expense)}"></div>
          </div>
          <span class="col-label ${isLatest ? 'font-bold' : ''}">${escapeHtml(label)}</span>
        </div>
      `;
    }).join('') + `
      <div class="chart-col projected">
        <div class="col-bars">
          <div class="bar bar-income dashed" style="height: 52%;" title="Proyeksi Pertumbuhan Target"></div>
          <div class="bar bar-expense dashed" style="height: 32%;"></div>
        </div>
        <span class="col-label">Target (Est.)</span>
      </div>
    `;

    // Update Big Highlight Number
    const latestMonth = monthsMap[displayKeys[displayKeys.length - 1]];
    const chartHighlight = document.getElementById('chart-highlight-number');
    if (chartHighlight) {
      chartHighlight.textContent = formatRupiah(mode === 'omzet' ? latestMonth.income : (latestMonth.income - latestMonth.expense));
    }

    // Trend Pill
    const trendPill = document.querySelector('.chart-summary-header .trend-pill');
    if (trendPill) {
      const curVal = mode === 'omzet' ? latestMonth.income : (latestMonth.income - latestMonth.expense);
      const prevMonth = monthsMap[displayKeys[displayKeys.length - 2]];
      const prevVal = prevMonth ? (mode === 'omzet' ? prevMonth.income : (prevMonth.income - prevMonth.expense)) : 0;
      const prevName = prevMonth ? (monthNames[parseInt(prevMonth.key.split('-')[1], 10) - 1] || 'bulan lalu') : 'bulan lalu';

      if (prevVal > 0) {
        const pct = Math.round(((curVal - prevVal) / prevVal) * 100);
        const isUp = pct >= 0;
        trendPill.className = `trend-pill ${isUp ? 'trend-up' : 'trend-down'}`;
        trendPill.innerHTML = `<span class="material-symbols-rounded trend-icon">${isUp ? 'trending_up' : 'trending_down'}</span><span>${isUp ? '+' : ''}${pct}% dibanding ${prevName}</span>`;
      } else if (curVal > 0) {
        trendPill.className = 'trend-pill trend-up';
        trendPill.innerHTML = `<span class="material-symbols-rounded trend-icon">trending_up</span><span>Omzet bulan aktif tercatat</span>`;
      } else {
        trendPill.className = 'trend-pill';
        trendPill.innerHTML = `<span class="material-symbols-rounded trend-icon">horizontal_rule</span><span>0% Belum ada transaksi</span>`;
      }
    }

    // Health Banner
    const healthBanner = document.querySelector('.chart-footer-banner');
    if (healthBanner) {
      if (latestMonth.income > 0) {
        const margin = Math.round(((latestMonth.income - latestMonth.expense) / latestMonth.income) * 100);
        const isHealthy = margin >= 20;
        const isStable = margin >= 0;
        healthBanner.innerHTML = `
          <div class="health-indicator">
            <span class="status-circle" style="background:${isHealthy ? '#10B981' : (isStable ? '#F59E0B' : '#EF4444')};"></span>
            <strong>${isHealthy ? 'Arus Kas Positif Sehat:' : (isStable ? 'Arus Kas Cukup Stabil:' : 'Arus Kas Defisit:')}</strong>
            Margin laba bersih bulan ini mencapai <strong>${margin}%</strong>. ${isHealthy ? 'Memenuhi syarat kelayakan KUR Bank.' : (isStable ? 'Tingkatkan efisiensi belanja kas.' : 'Kurangi beban operasional untuk memulihkan kas.')}
          </div>
        `;
      } else {
        healthBanner.innerHTML = `
          <div class="health-indicator">
            <span class="status-circle" style="background:#94A3B8;"></span>
            <strong>Mulai Pembukuan:</strong> Catat transaksi kas harian pertama Anda untuk mengaktifkan grafik arus kas dan analisis kelayakan KUR.
          </div>
        `;
      }
    }
  }

  // 2. Dynamic Sales Distribution Renderer
  function renderSalesDistribution(allTx) {
    const container = document.getElementById('distribution-bars-wrap');
    if (!container) return;

    const incomeTx = (allTx || []).filter(t => t.type === 'income');
    if (incomeTx.length === 0) {
      container.innerHTML = `
        <div style="padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 0.8125rem;">
          <span class="material-symbols-rounded" style="font-size: 32px; color: #94A3B8; margin-bottom: 6px; display: block;">point_of_sale</span>
          Belum ada data penjualan tercatat.<br>Catat transaksi kasir pertama Anda di <a href="../Buku-Kas-Warung/" style="color:var(--primary); font-weight:600;">Buku Kas Warung</a>.
        </div>
      `;
      return;
    }

    const catMap = {};
    let totalOmzet = 0;
    incomeTx.forEach(t => {
      const c = t.category || 'Penjualan';
      catMap[c] = (catMap[c] || 0) + t.amount;
      totalOmzet += t.amount;
    });

    const colors = ['bg-emerald', 'bg-gold', 'bg-blue', 'bg-purple'];
    const sortedCats = Object.keys(catMap).sort((a, b) => catMap[b] - catMap[a]);

    container.innerHTML = sortedCats.map((cat, idx) => {
      const amt = catMap[cat];
      const pct = totalOmzet > 0 ? Math.round((amt / totalOmzet) * 100) : 0;
      const color = colors[idx % colors.length];

      return `
        <div class="dist-row">
          <div class="dist-info">
            <span class="dist-dot ${color}"></span>
            <span class="dist-name">${escapeHtml(cat)}</span>
            <span class="dist-pct">${pct}%</span>
          </div>
          <div class="dist-track">
            <div class="dist-fill ${color}" style="width: ${pct}%;"></div>
          </div>
          <span class="dist-amount tabular-nums">${formatRupiah(amt)}</span>
        </div>
      `;
    }).join('');
  }

  // 3. Dynamic Legalitas Checklist Renderer
  function renderLegalitasChecklist(allTx) {
    const container = document.getElementById('legalitas-status-card');
    if (!container) return;

    let hasNIB = false;
    let hasHalalOrCert = false;

    try {
      const profRaw = localStorage.getItem('utera_profil_usaha');
      if (profRaw) {
        const profs = JSON.parse(profRaw);
        if (Array.isArray(profs) && profs[0]) {
          if (profs[0].nib && profs[0].nib.punya) hasNIB = true;
        }
      }
      const legRaw = localStorage.getItem('utera.legalitas.v1');
      if (legRaw) {
        const leg = JSON.parse(legRaw);
        if (leg.nib && leg.nib.nomor) hasNIB = true;
        if (Array.isArray(leg.dokumen) && leg.dokumen.some(d => d.kategori === 'halal' || d.kategori === 'pirt')) {
          hasHalalOrCert = true;
        }
      }
    } catch (e) {}

    const monthsSet = new Set();
    (allTx || []).forEach(t => { if (t.date) monthsSet.add(t.date.slice(0, 7)); });
    const has3MonthsKas = monthsSet.size >= 3;
    const hasActiveTx = (allTx || []).length > 0;

    let readyCount = 0;
    if (hasNIB) readyCount++;
    if (has3MonthsKas) readyCount++;
    if (hasActiveTx) readyCount++;
    if (hasHalalOrCert) readyCount++;

    container.innerHTML = `
      <div class="legalitas-header">
        <strong>Status Kelengkapan Berkas KUR</strong>
        <span class="badge-pill-progress">${readyCount} dari 4 Siap</span>
      </div>
      <ul class="checklist-legalitas">
        <li class="${hasNIB ? 'checked' : 'pending'}">${hasNIB ? '✓ NIB OSS-RBA Terdaftar Resmi' : '○ NIB OSS-RBA (Belum Ada - <a href="../legalitas-&-nib/">Daftar</a>)'}</li>
        <li class="${has3MonthsKas ? 'checked' : 'pending'}">${has3MonthsKas ? '✓ Riwayat Pembukuan Kas > 3 Bulan' : `○ Riwayat Kas (${monthsSet.size}/3 Bulan Tercatat)`}</li>
        <li class="${hasActiveTx ? 'checked' : 'pending'}">${hasActiveTx ? '✓ Rekening & Kas Operasional Usaha Aktif' : '○ Rekening & Arus Kas Usaha (Belum Ada Transaksi)'}</li>
        <li class="${hasHalalOrCert ? 'checked' : 'pending'}">${hasHalalOrCert ? '✓ Sertifikasi Produk / Halal / PIRT Lengkap' : '○ Sertifikasi Produk / PIRT / Halal (Opsional)'}</li>
      </ul>
    `;
  }

  // Render Table
  function renderTransactions(filter = 'all') {
    if (!txTableBody) return;
    txTableBody.innerHTML = '';

    const filtered = transactions.filter(t => {
      if (filter === 'all') return true;
      return t.type === filter;
    });

    if (filtered.length === 0) {
      const emptyText = transactions.length === 0
        ? 'Belum ada transaksi. Catat yang pertama di <a href="../Buku-Kas-Warung/">Buku Kas Warung</a>.'
        : 'Belum ada data transaksi untuk filter ini.';
      txTableBody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding:28px; color:var(--text-muted)">${emptyText}</td></tr>`;
      if (txCountDisplay) txCountDisplay.textContent = 'Menampilkan 0 transaksi';
      return;
    }

    filtered.forEach(tx => {
      const tr = document.createElement('tr');
      const isIncome = tx.type === 'income';

      // Assign badge classes based on category
      let catClass = 'chip-food';
      if (tx.category.includes('Bahan')) catClass = 'chip-supply';
      if (tx.category.includes('Operasional')) catClass = 'chip-utility';

      tr.innerHTML = `
        <td class="text-muted">${tx.time}</td>
        <td><span class="chip-cat ${catClass}">${escapeHtml(tx.category)}</span></td>
        <td><strong>${escapeHtml(tx.desc)}</strong></td>
        <td>
          <span class="badge-type ${isIncome ? 'income' : 'expense'}">
            ${isIncome ? 'Masuk (Kasir)' : 'Keluar (Biaya)'}
          </span>
        </td>
        <td class="text-right font-semibold ${isIncome ? 'text-emerald' : 'text-terracotta'} tabular-nums">
          ${isIncome ? '+' : '-'} ${formatRupiah(tx.amount)}
        </td>
        <td class="text-center">
          <button type="button" class="btn-icon-del" data-id="${tx.id}" aria-label="Hapus catatan">
            <span class="material-symbols-rounded" style="font-size:16px;">delete</span>
          </button>
        </td>
      `;

      txTableBody.appendChild(tr);
    });

    if (txCountDisplay) {
      txCountDisplay.textContent = `Menampilkan ${filtered.length} transaksi terbaru dari ${Kas.load().length} catatan kas`;
    }

    // Attach Delete Handlers
    txTableBody.querySelectorAll('.btn-icon-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (!Kas.save(Kas.load().filter(t => t.id !== id))) return;
        transactions = loadRecent();
        renderTransactions(filterTxType ? filterTxType.value : 'all');
        recalculateMetrics();
      });
    });
  }

  // Event Listeners for Filters
  if (filterTxType) {
    filterTxType.addEventListener('change', (e) => {
      renderTransactions(e.target.value);
    });
  }

  // Modal Open/Close Controls
  function openModal() {
    if (modalBackdrop) {
      modalBackdrop.classList.add('open');
      modalBackdrop.setAttribute('aria-hidden', 'false');
      const inputAmount = document.getElementById('input-tx-amount');
      if (inputAmount) setTimeout(() => inputAmount.focus(), 50);
    }
  }

  function closeModal() {
    if (modalBackdrop) {
      modalBackdrop.classList.remove('open');
      modalBackdrop.setAttribute('aria-hidden', 'true');
      if (formNewTx) formNewTx.reset();
      setTypeActive('income');
    }
  }

  if (btnOpenModal) btnOpenModal.addEventListener('click', openModal);
  if (btnAddTxRow) btnAddTxRow.addEventListener('click', openModal);
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancelTx) btnCancelTx.addEventListener('click', closeModal);

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeModal();
    });
  }

  // Type Radio Buttons in Modal
  const selectCat = document.getElementById('select-tx-cat');

  function fillModalCategories(type) {
    if (!selectCat) return;
    selectCat.innerHTML = Kas.CATEGORIES[type]
      .map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }

  function setTypeActive(type) {
    fillModalCategories(type);
    if (type === 'income') {
      labelIncome?.classList.add('active');
      labelExpense?.classList.remove('active');
    } else {
      labelExpense?.classList.add('active');
      labelIncome?.classList.remove('active');
    }
  }

  labelIncome?.addEventListener('click', () => setTypeActive('income'));
  labelExpense?.addEventListener('click', () => setTypeActive('expense'));

  // Form Submit: Add New Transaction
  if (formNewTx) {
    formNewTx.addEventListener('submit', (e) => {
      e.preventDefault();
      const type = formNewTx.elements['tx_type'].value;
      const amount = Number(document.getElementById('input-tx-amount').value);
      const category = document.getElementById('select-tx-cat').value;
      const desc = document.getElementById('input-tx-desc').value.trim();

      if (!amount || amount <= 0 || !desc) return;

      const store = Kas.load();
      store.push({
        id: Kas.newId(),
        date: Kas.toISODate(new Date()),
        type,
        category,
        note: desc,
        amount,
        createdAt: Date.now()
      });
      if (!Kas.save(store)) {
        alert('Transaksi belum tersimpan: penyimpanan browser menolak perubahan.');
        return;
      }

      transactions = loadRecent();

      renderTransactions(filterTxType ? filterTxType.value : 'all');
      recalculateMetrics();
      closeModal();
    });
  }

  // Chart Mode Toggles (Omzet vs Laba Bersih)
  const btnChartOmzet = document.getElementById('btn-chart-omzet');
  const btnChartLaba = document.getElementById('btn-chart-laba');
  const chartHighlightNumber = document.getElementById('chart-highlight-number');

  btnChartOmzet?.addEventListener('click', () => {
    btnChartOmzet.classList.add('active');
    btnChartLaba?.classList.remove('active');
    const all = (typeof Kas !== 'undefined' && Kas.load) ? Kas.load() : [];
    let inc = 0;
    all.forEach(t => { if (t.type === 'income') inc += t.amount; });
    if (chartHighlightNumber) chartHighlightNumber.textContent = formatRupiah(inc);
    renderMonthlyCashflowChart(all, 'omzet');
  });

  btnChartLaba?.addEventListener('click', () => {
    btnChartLaba.classList.add('active');
    btnChartOmzet?.classList.remove('active');
    const all = (typeof Kas !== 'undefined' && Kas.load) ? Kas.load() : [];
    let inc = 0, exp = 0;
    all.forEach(t => { if (t.type === 'income') inc += t.amount; else exp += t.amount; });
    if (chartHighlightNumber) chartHighlightNumber.textContent = formatRupiah(inc - exp);
    renderMonthlyCashflowChart(all, 'laba');
  });

  // Mobile Menu Drawer Toggle
  btnMobileMenu?.addEventListener('click', () => {
    sidebar?.classList.add('mobile-open');
    sidebarBackdrop?.classList.add('mobile-open');
  });

  sidebarBackdrop?.addEventListener('click', () => {
    sidebar?.classList.remove('mobile-open');
    sidebarBackdrop?.classList.remove('mobile-open');
  });

  btnCollapseSidebar?.addEventListener('click', () => {
    sidebar?.classList.remove('mobile-open');
    sidebarBackdrop?.classList.remove('mobile-open');
  });

  // Export Laporan Action
  const btnExport = document.getElementById('btn-export-laporan');
  btnExport?.addEventListener('click', () => {
    window.print();
  });

  // Sinkronisasi Hasil Simulasi Guardrail Terakhir (jika tersimpan dari modul /guardrail/)
  function syncSavedGuardrail() {
    try {
      const savedRaw = localStorage.getItem('utera_saved_guardrail');
      if (!savedRaw) return;
      const parsed = JSON.parse(savedRaw);
      const firstCard = document.querySelector('.panel-guardrail .loan-option-card:first-child');
      if (firstCard && parsed.program) {
        const strongTitle = firstCard.querySelector('.loan-info strong');
        const spanSub = firstCard.querySelector('.loan-info span');
        const spanInstallment = firstCard.querySelector('.loan-installment');
        const spanStatus = firstCard.querySelector('.loan-status');

        if (strongTitle) strongTitle.textContent = parsed.program + ' (Hasil Uji)';
        if (spanSub) spanSub.textContent = `Plafon ${formatRupiah(parsed.plafon)} • Tenor ${parsed.tenor} Bln`;
        if (spanInstallment) spanInstallment.textContent = `${formatRupiah(parsed.installment)}/bln`;
        if (spanStatus) {
          const isSafe = (parsed.ratio || 0) <= 30;
          spanStatus.className = `loan-status ${isSafe ? 'text-emerald' : 'text-terracotta'}`;
          spanStatus.textContent = isSafe ? '✓ Lolos Batas 30% Kas' : '⚠️ Melebihi Batas Kas';
        }
      }
    } catch (e) {
      // Abaikan jika tidak ada data tersimpan
    }
  }

  // Sinkronkan Nama Pemilik & Usaha Pengguna
  function renderUserProfile() {
    let userName = localStorage.getItem('utera_user_name');
    let bizName = localStorage.getItem('utera_nama_usaha');
    const userEmail = localStorage.getItem('utera_user_email');

    try {
      const profRaw = localStorage.getItem('utera_profil_usaha');
      if (profRaw) {
        const profs = JSON.parse(profRaw);
        if (Array.isArray(profs) && profs[0]) {
          if (profs[0].nama_pemilik) userName = profs[0].nama_pemilik;
          if (profs[0].nama_usaha) bizName = profs[0].nama_usaha;
        }
      }
    } catch (e) {}

    if (!userName && userEmail) {
      userName = userEmail.split('@')[0];
    }

    if (userName) {
      const elUserName = document.querySelector('.user-name-label');
      if (elUserName) elUserName.textContent = userName;

      const elAvatar = document.querySelector('.user-avatar-circle');
      if (elAvatar) {
        const initials = userName.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
        elAvatar.textContent = initials || 'U';
      }
    }

    const dropName = document.getElementById('dropdown-user-name');
    if (dropName) dropName.textContent = userName || 'Pemilik Usaha';
    const dropEmail = document.getElementById('dropdown-user-email');
    if (dropEmail) dropEmail.textContent = userEmail || 'Akun Tamu (Demo)';

    if (bizName) {
      const elBizName = document.getElementById('sidebar-business-name');
      if (elBizName) elBizName.textContent = bizName;
    }
  }

  // User Topbar Dropdown Toggle
  const btnUserDropdown = document.getElementById('btn-user-dropdown');
  const userDropdownMenu = document.getElementById('user-dropdown-menu');

  if (btnUserDropdown && userDropdownMenu) {
    btnUserDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdownMenu.classList.toggle('show');
      btnUserDropdown.setAttribute('aria-expanded', userDropdownMenu.classList.contains('show'));
    });

    document.addEventListener('click', (e) => {
      if (!userDropdownMenu.contains(e.target) && !btnUserDropdown.contains(e.target)) {
        userDropdownMenu.classList.remove('show');
        btnUserDropdown.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Topbar direct logout button
  const topbarLogout = document.getElementById('topbar-btn-logout');
  if (topbarLogout) {
    topbarLogout.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.uteraLogout) {
        window.uteraLogout('../auth/index.html?mode=login');
      }
    });
  }

  // Initial Boot
  renderUserProfile();
  fillModalCategories('income');
  renderTransactions();
  recalculateMetrics();
  syncSavedGuardrail();
});
