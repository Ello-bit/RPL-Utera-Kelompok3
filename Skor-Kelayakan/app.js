/**
 * UTERA Skor Kelayakan — Calculation & UI Logic
 * Implements F6: score formula from PRD §Kriteria KUR dan Skor Kelayakan
 *
 * Skor = 30·(B_catat/6) + 25·min(1, R_baru/R_lama) + 25·min(1, M/0.20) + 20·(B_laba/6)
 *
 * B_catat  = months with transactions out of last 6
 * R_baru   = income total for last 3 months
 * R_lama   = income total for 3 months before that
 * M        = net profit margin (net/income)
 * B_laba   = months with positive net profit out of last 6
 *
 * Categories: Rendah (<40), Cukup (40–69), Baik (>=70)
 */

document.addEventListener('DOMContentLoaded', () => {

  // --- Monthly Financial Data (6 months: May–Oct 2026) ---
  // Represents stored transaction aggregates per month
  const monthlyData = [
    { bulan: 'Mei',       pemasukan: 14200000, pengeluaran: 12600000, tercatat: true },
    { bulan: 'Juni',      pemasukan: 16500000, pengeluaran: 14800000, tercatat: true },
    { bulan: 'Juli',      pemasukan: 18400000, pengeluaran: 19100000, tercatat: true },
    { bulan: 'Agustus',   pemasukan: 20400000, pengeluaran: 18100000, tercatat: true },
    { bulan: 'September', pemasukan: 22100000, pengeluaran: 19600000, tercatat: true },
    { bulan: 'Oktober',   pemasukan: 24850000, pengeluaran: 21100000, tercatat: true },
  ];

  function formatRupiah(number) {
    return 'Rp ' + Number(number).toLocaleString('id-ID');
  }

  function formatRupiahShort(number) {
    if (number >= 1000000) {
      return 'Rp ' + (number / 1000000).toFixed(1).replace('.', ',') + 'M';
    }
    return formatRupiah(number);
  }

  // --- Calculate Score Components ---
  function calculateScore(data) {
    const totalMonths = 6;

    // K1: Konsistensi Pencatatan (30 pts)
    const bCatat = data.filter(m => m.tercatat).length;
    const k1Raw = bCatat / totalMonths;
    const k1Score = Math.round(30 * k1Raw);

    // K2: Tren Pemasukan (25 pts)
    // Last 3 months vs previous 3 months
    const rLama = data.slice(0, 3).reduce((s, m) => s + m.pemasukan, 0);
    const rBaru = data.slice(3, 6).reduce((s, m) => s + m.pemasukan, 0);
    let k2Ratio;
    if (rLama === 0 && rBaru > 0) {
      k2Ratio = 1;
    } else if (rLama === 0 && rBaru === 0) {
      k2Ratio = 0;
    } else {
      k2Ratio = Math.min(1, rBaru / rLama);
    }
    const k2Score = Math.round(25 * k2Ratio);

    // K3: Profitabilitas (25 pts)
    // Net profit margin across all 6 months
    const totalPemasukan = data.reduce((s, m) => s + m.pemasukan, 0);
    const totalPengeluaran = data.reduce((s, m) => s + m.pengeluaran, 0);
    const totalLaba = totalPemasukan - totalPengeluaran;
    const margin = totalPemasukan > 0 ? Math.max(0, totalLaba) / totalPemasukan : 0;
    const k3Ratio = Math.min(1, margin / 0.20);
    const k3Score = Math.round(25 * k3Ratio);

    // K4: Stabilitas Arus Kas (20 pts)
    const bLaba = data.filter(m => (m.pemasukan - m.pengeluaran) > 0).length;
    const k4Raw = bLaba / totalMonths;
    const k4Score = Math.round(20 * k4Raw);

    const totalScore = k1Score + k2Score + k3Score + k4Score;

    let category, categoryClass;
    if (totalScore >= 70) {
      category = 'Baik';
      categoryClass = 'skor-baik';
    } else if (totalScore >= 40) {
      category = 'Cukup';
      categoryClass = 'skor-cukup';
    } else {
      category = 'Rendah';
      categoryClass = 'skor-rendah';
    }

    return {
      total: totalScore,
      category,
      categoryClass,
      k1: { score: k1Score, max: 30, ratio: k1Raw, detail: `${bCatat} dari ${totalMonths} bulan tercatat` },
      k2: { score: k2Score, max: 25, ratio: k2Ratio, rBaru, rLama, detail: rBaru >= rLama ? `Pemasukan naik: ${formatRupiahShort(rBaru)} vs ${formatRupiahShort(rLama)}` : `Pemasukan turun: ${formatRupiahShort(rBaru)} vs ${formatRupiahShort(rLama)}` },
      k3: { score: k3Score, max: 25, ratio: k3Ratio, margin, detail: `Margin laba bersih: ${(margin * 100).toFixed(1)}% (target 20%)` },
      k4: { score: k4Score, max: 20, ratio: k4Raw, bLaba, detail: `${bLaba} dari ${totalMonths} bulan laba positif` },
      totals: { pemasukan: totalPemasukan, pengeluaran: totalPengeluaran, laba: totalLaba, margin },
    };
  }

  const result = calculateScore(monthlyData);

  // --- Render Score Ring ---
  const circumference = 2 * Math.PI * 52; // r=52
  const fillPct = result.total / 100;
  const offset = circumference * (1 - fillPct);

  const ringFill = document.getElementById('ring-fill');
  if (ringFill) {
    ringFill.setAttribute('stroke-dasharray', circumference.toFixed(2));
    ringFill.setAttribute('stroke-dashoffset', offset.toFixed(2));
    ringFill.classList.remove('skor-rendah', 'skor-cukup', 'skor-baik');
    if (result.total >= 70) ringFill.classList.add('skor-baik');
    else if (result.total >= 40) ringFill.classList.add('skor-cukup');
    else ringFill.classList.add('skor-rendah');
  }

  // Score number
  const skorNumber = document.getElementById('skor-number');
  if (skorNumber) skorNumber.textContent = result.total;

  // Nav pill
  const navSkor = document.getElementById('nav-skor-value');
  if (navSkor) navSkor.textContent = result.total;

  // Spectrum pointer & tag
  const spectrumPointer = document.getElementById('spectrum-pointer');
  if (spectrumPointer) {
    spectrumPointer.style.left = `${Math.min(98, Math.max(2, result.total))}%`;
    const pointerTag = spectrumPointer.querySelector('.pointer-tag');
    if (pointerTag) pointerTag.innerHTML = `Anda: ${result.total} &starf;`;
  }
  // Category badge
  const catBadge = document.getElementById('skor-category-badge');
  if (catBadge) {
    catBadge.textContent = result.category;
    catBadge.className = 'skor-category-badge ' + result.categoryClass;
  }

  // Verdict text
  const verdict = document.getElementById('skor-verdict');
  if (verdict) {
    if (result.category === 'Baik') {
      verdict.textContent = 'Keuangan usaha Anda menunjukkan pola yang konsisten dan sehat. Usaha ini siap untuk pengajuan KUR Mikro.';
    } else if (result.category === 'Cukup') {
      verdict.textContent = 'Keuangan usaha cukup stabil, tetapi ada beberapa area yang perlu diperbaiki sebelum pengajuan KUR.';
    } else {
      verdict.textContent = 'Keuangan usaha belum cukup konsisten. Perbaiki pencatatan dan stabilitas arus kas terlebih dahulu.';
    }
  }

  // Kategori highlight
  document.querySelectorAll('.kategori-row').forEach(el => el.classList.remove('active'));
  if (result.category === 'Baik') document.getElementById('kat-baik')?.classList.add('active');
  else if (result.category === 'Cukup') document.getElementById('kat-cukup')?.classList.add('active');
  else document.getElementById('kat-rendah')?.classList.add('active');

  // --- Render Component Scores ---
  function renderKomponen(id, data) {
    const scoreEl = document.querySelector(`#${id}-score .komponen-score-val`);
    if (scoreEl) scoreEl.textContent = data.score;

    const bar = document.getElementById(`${id}-bar`);
    if (bar) bar.style.width = Math.round(data.ratio * 100) + '%';

    const detail = document.getElementById(`${id}-detail`);
    if (detail) detail.textContent = data.detail;

    const pct = document.getElementById(`${id}-pct`);
    if (pct) pct.textContent = Math.round(data.ratio * 100) + '%';
  }

  renderKomponen('k1', result.k1);
  renderKomponen('k2', result.k2);
  renderKomponen('k3', result.k3);
  renderKomponen('k4', result.k4);

  // --- Render Monthly History Table ---
  const tableBody = document.getElementById('riwayat-table-body');
  const tableFoot = document.getElementById('riwayat-table-foot');

  if (tableBody) {
    tableBody.innerHTML = '';
    monthlyData.forEach((m, i) => {
      const laba = m.pemasukan - m.pengeluaran;
      const margin = m.pemasukan > 0 ? (laba / m.pemasukan) * 100 : 0;
      const isLast3 = i >= 3;
      const isDefisit = laba < 0;

      const labaClass = isDefisit ? 'text-terracotta' : 'text-emerald';
      let marginClass = 'pill-good';
      if (margin >= 20) marginClass = 'pill-good';
      else if (margin >= 10) marginClass = 'pill-ok';
      else if (margin >= 0) marginClass = 'pill-low';
      else marginClass = 'pill-neg';

      const tr = document.createElement('tr');
      if (i === 3) {
        tr.classList.add('row-period-divider');
      }
      tr.innerHTML = `
        <td>
          <div class="month-title-wrap">
            <span class="month-name font-bold">${m.bulan} 2026</span>
            <span class="period-sub-chip ${isLast3 ? 'chip-q2' : 'chip-q1'}">
              ${isLast3 ? '3 Bln Terakhir (R_baru)' : '3 Bln Awal (R_lama)'}
            </span>
          </div>
        </td>
        <td class="text-right tabular-nums font-semibold">${formatRupiah(m.pemasukan)}</td>
        <td class="text-right tabular-nums text-muted">${formatRupiah(m.pengeluaran)}</td>
        <td class="text-right tabular-nums ${labaClass}" style="font-weight:700">
          ${laba >= 0 ? '+' : ''}${formatRupiah(laba)}
          ${isDefisit ? '<span class="tag-note" title="Pengeluaran investasi modal/mesin warung">Alat</span>' : ''}
        </td>
        <td class="text-right tabular-nums">
          <span class="table-margin-badge ${marginClass}">${margin.toFixed(1)}%</span>
        </td>
        <td class="text-center">
          ${m.tercatat 
            ? '<span class="status-recorded-pill"><span class="material-symbols-rounded">check_circle</span> Aktif</span>' 
            : '<span class="status-missing-pill"><span class="material-symbols-rounded">cancel</span> Kosong</span>'}
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  if (tableFoot) {
    const totalLaba = result.totals.laba;
    const avgMargin = result.totals.margin * 100;
    tableFoot.innerHTML = `
      <tr class="table-tfoot-row">
        <td><strong>Total 6 Bulan</strong></td>
        <td class="text-right tabular-nums font-bold text-primary">${formatRupiah(result.totals.pemasukan)}</td>
        <td class="text-right tabular-nums font-bold text-muted">${formatRupiah(result.totals.pengeluaran)}</td>
        <td class="text-right tabular-nums font-bold text-emerald">+${formatRupiah(totalLaba)}</td>
        <td class="text-right tabular-nums font-bold"><span class="table-margin-badge pill-ok">${avgMargin.toFixed(1)}%</span></td>
        <td class="text-center"><span class="status-recorded-pill">6/6 Lengkap</span></td>
      </tr>
    `;
  }

  // --- Render History Chart ---
  const chartCols = document.getElementById('riwayat-chart-columns');
  if (chartCols) {
    const maxVal = 25000000;
    chartCols.innerHTML = '';
    monthlyData.forEach((m, i) => {
      const isLast3 = i >= 3;
      const incomeH = Math.min(100, Math.round((m.pemasukan / maxVal) * 100));
      const laba = m.pemasukan - m.pengeluaran;
      const isDefisit = laba < 0;
      const labaH = isDefisit 
        ? Math.max(10, Math.round((Math.abs(laba) / maxVal) * 100))
        : Math.max(6, Math.round((laba / maxVal) * 100));
      
      const incomeTag = (m.pemasukan / 1000000).toFixed(1).replace('.', ',') + ' Jt';
      const labaTag = isDefisit 
        ? `-${(Math.abs(laba) / 1000).toFixed(0)} Rb`
        : `+${(laba / 1000000).toFixed(1).replace('.', ',')} Jt`;

      const col = document.createElement('div');
      col.className = 'chart-col';
      col.innerHTML = `
        <div class="col-amount-tags">
          <span class="tag-income" title="Pemasukan ${m.bulan}: ${formatRupiah(m.pemasukan)}">${incomeTag}</span>
          <span class="tag-laba ${isDefisit ? 'text-terracotta' : 'text-emerald'}" title="Laba ${m.bulan}: ${formatRupiah(laba)}">${labaTag}</span>
        </div>
        <div class="col-bars">
          <div class="bar bar-income" style="height:${incomeH}%;" title="Pemasukan ${m.bulan}: ${formatRupiah(m.pemasukan)}"></div>
          <div class="bar ${isDefisit ? 'bar-defisit' : 'bar-laba'}" style="height:${labaH}%;" title="${isDefisit ? 'Defisit' : 'Laba'} ${m.bulan}: ${formatRupiah(laba)}"></div>
        </div>
        <div class="col-footer-info">
          <span class="col-month-label">${m.bulan}</span>
          <span class="col-period-tag ${isLast3 ? 'tag-q2' : 'tag-q1'}">${isLast3 ? 'R_baru' : 'R_lama'}</span>
        </div>
      `;
      chartCols.appendChild(col);
    });
  }

  // Chart/Table toggle
  const btnTable = document.getElementById('btn-view-table');
  const btnChart = document.getElementById('btn-view-chart');
  const tableWrap = document.getElementById('riwayat-table-wrap');
  const chartWrap = document.getElementById('riwayat-chart-wrap');

  btnTable?.addEventListener('click', () => {
    btnTable.classList.add('active');
    btnChart?.classList.remove('active');
    if (tableWrap) tableWrap.style.display = '';
    if (chartWrap) chartWrap.style.display = 'none';
  });

  btnChart?.addEventListener('click', () => {
    btnChart.classList.add('active');
    btnTable?.classList.remove('active');
    if (tableWrap) tableWrap.style.display = 'none';
    if (chartWrap) chartWrap.style.display = '';
  });

  // --- Render Recommendations ---
  const rekomList = document.getElementById('rekomendasi-list');
  if (rekomList) {
    rekomList.innerHTML = '';
    const recs = [];

    if (result.k1.ratio < 1) {
      recs.push({
        icon: 'edit_calendar',
        iconBg: 'bg-primary-soft',
        iconColor: 'text-primary',
        title: 'Lengkapi pencatatan bulanan',
        desc: `Anda baru mencatat ${result.k1.detail}. Pastikan setiap bulan ada minimal 1 transaksi tercatat.`,
        priority: 'high',
      });
    }

    if (result.k3.ratio < 1) {
      const currentMargin = (result.k3.margin * 100).toFixed(1);
      recs.push({
        icon: 'account_balance_wallet',
        iconBg: 'bg-gold-soft',
        iconColor: 'text-gold',
        title: 'Tingkatkan margin laba bersih',
        desc: `Margin saat ini ${currentMargin}%, target minimal 20%. Pertimbangkan efisiensi biaya operasional atau naikkan harga jual.`,
        priority: currentMargin < 10 ? 'high' : 'medium',
      });
    }

    if (result.k4.ratio < 1) {
      recs.push({
        icon: 'speed',
        iconBg: 'bg-blue-soft',
        iconColor: 'text-blue',
        title: 'Jaga arus kas tetap positif',
        desc: `${result.k4.detail}. Pastikan setiap bulan pemasukan lebih besar dari pengeluaran.`,
        priority: 'medium',
      });
    }

    if (result.k2.ratio < 1) {
      recs.push({
        icon: 'trending_up',
        iconBg: 'bg-emerald-soft',
        iconColor: 'text-emerald',
        title: 'Pertahankan tren pemasukan naik',
        desc: 'Pemasukan 3 bulan terakhir lebih rendah dari 3 bulan sebelumnya. Fokus pada strategi penjualan.',
        priority: 'medium',
      });
    }

    if (recs.length === 0) {
      recs.push({
        icon: 'check_circle',
        iconBg: 'bg-emerald-soft',
        iconColor: 'text-emerald',
        title: 'Semua komponen skor optimal',
        desc: 'Pertahankan konsistensi pencatatan dan stabilitas keuangan usaha Anda.',
        priority: 'done',
      });
    }

    recs.forEach(r => {
      const item = document.createElement('div');
      item.className = 'rekom-item';

      let priorityHTML = '';
      if (r.priority === 'high') {
        priorityHTML = '<span class="rekom-priority priority-high">Prioritas Tinggi</span>';
      } else if (r.priority === 'medium') {
        priorityHTML = '<span class="rekom-priority priority-medium">Prioritas Sedang</span>';
      } else if (r.priority === 'done') {
        priorityHTML = '<span class="rekom-check done"><span class="material-symbols-rounded" style="font-size:13px;">check_circle</span> Tercapai</span>';
      } else {
        priorityHTML = '<span class="rekom-priority priority-low">Prioritas Rendah</span>';
      }

      item.innerHTML = `
        <div class="rekom-icon-wrap ${r.iconBg}">
          <span class="material-symbols-rounded ${r.iconColor}" style="font-size:18px;">${r.icon}</span>
        </div>
        <div class="rekom-content">
          <span class="rekom-title">${r.title}</span>
          <span class="rekom-desc">${r.desc}</span>
          ${priorityHTML}
        </div>
      `;
      rekomList.appendChild(item);
    });
  }

  // --- Render KUR Status ---
  const kurCard = document.getElementById('kur-status-card');
  const kurBody = document.getElementById('kur-status-body');
  if (kurCard && kurBody) {
    kurCard.classList.remove('status-baik', 'status-cukup', 'status-rendah');
    if (result.category === 'Baik') {
      kurCard.classList.add('status-baik');
      kurBody.innerHTML = `
        <span class="kur-status-label" style="color:var(--emerald)">Memenuhi Syarat</span>
        <span class="kur-status-desc">Skor kelayakan ${result.total}/100 (${result.category}). Syarat keuangan untuk pengajuan KUR terpenuhi. Pastikan syarat administratif (NIB, e-KTP, dll) juga lengkap.</span>
      `;
    } else if (result.category === 'Cukup') {
      kurCard.classList.add('status-cukup');
      kurBody.innerHTML = `
        <span class="kur-status-label" style="color:var(--gold)">Belum Siap</span>
        <span class="kur-status-desc">Skor kelayakan ${result.total}/100 (${result.category}). Syarat keuangan hampir terpenuhi. Ikuti rekomendasi perbaikan di atas untuk menaikkan skor ke kategori Baik.</span>
      `;
    } else {
      kurCard.classList.add('status-rendah');
      kurBody.innerHTML = `
        <span class="kur-status-label" style="color:var(--terracotta)">Belum Memenuhi</span>
        <span class="kur-status-desc">Skor kelayakan ${result.total}/100 (${result.category}). Keuangan usaha perlu perbaikan signifikan sebelum mengajukan KUR. Mulai dari konsistensi pencatatan.</span>
      `;
    }
  }

  // --- Mobile Sidebar Toggle ---
  const sidebar = document.getElementById('app-sidebar');
  const btnMobileMenu = document.getElementById('btn-mobile-menu');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const btnCollapse = document.getElementById('btn-collapse-sidebar');

  btnMobileMenu?.addEventListener('click', () => {
    sidebar?.classList.add('mobile-open');
    sidebarBackdrop?.classList.add('mobile-open');
  });

  sidebarBackdrop?.addEventListener('click', () => {
    sidebar?.classList.remove('mobile-open');
    sidebarBackdrop?.classList.remove('mobile-open');
  });

  btnCollapse?.addEventListener('click', () => {
    sidebar?.classList.remove('mobile-open');
    sidebarBackdrop?.classList.remove('mobile-open');
  });

  // Escape closes sidebar
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar?.classList.contains('mobile-open')) {
      sidebar.classList.remove('mobile-open');
      sidebarBackdrop?.classList.remove('mobile-open');
    }
  });
});
