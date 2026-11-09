/**
 * UTERA · Laporan Siap Bank
 * Pure business logic: transaction aggregation, PRD scoring, readiness evaluation, and formatting.
 */
(function (global) {
  'use strict';

  const M = global.LaporanModels;

  /* ---------------- Formatting Helpers ---------------- */

  function formatRupiah(amount) {
    const num = Math.round(Number(amount) || 0);
    const sign = num < 0 ? '-' : '';
    const abs = Math.abs(num);
    return `${sign}Rp ${abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  }

  const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  function formatDateIndo(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatMonthYear(yearMonthStr) {
    // yearMonthStr format: 'YYYY-MM'
    if (!yearMonthStr || !/^\d{4}-\d{2}$/.test(yearMonthStr)) return yearMonthStr;
    const [y, m] = yearMonthStr.split('-').map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
  }

  /* ---------------- Financial Aggregation ---------------- */

  function parseTxDate(d) {
    if (!d) return new Date();
    if (typeof d === 'number') return new Date(d);
    return new Date(d);
  }

  function filterTransactionsByPeriod(transactions, monthsCount, referenceDate = new Date()) {
    if (!Array.isArray(transactions) || transactions.length === 0) return [];
    
    // Sort transactions ascending by date
    const sorted = transactions.slice().sort((a, b) => {
      const da = new Date(a.date || a.createdAt || 0).getTime();
      const db = new Date(b.date || b.createdAt || 0).getTime();
      return da - db;
    });

    if (monthsCount >= 12 && sorted.length > 0) {
      return sorted;
    }

    // Determine the latest transaction date in data as baseline anchor
    let anchor = referenceDate;
    if (sorted.length > 0) {
      const lastTx = sorted[sorted.length - 1];
      const lastTxDate = new Date(lastTx.date || lastTx.createdAt);
      if (!isNaN(lastTxDate.getTime())) {
        anchor = lastTxDate;
      }
    }

    // Cutoff: anchor date minus monthsCount months
    const cutoff = new Date(anchor);
    cutoff.setMonth(cutoff.getMonth() - monthsCount);
    cutoff.setDate(1);
    cutoff.setHours(0, 0, 0, 0);

    return sorted.filter((tx) => {
      const d = new Date(tx.date || tx.createdAt);
      return !isNaN(d.getTime()) && d >= cutoff;
    });
  }

  function aggregateMonthly(transactions) {
    const map = new Map();

    transactions.forEach((tx) => {
      const d = new Date(tx.date || tx.createdAt);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      
      if (!map.has(key)) {
        map.set(key, { key, pemasukan: 0, pengeluaran: 0, count: 0 });
      }
      const item = map.get(key);
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'income') {
        item.pemasukan += amount;
      } else if (tx.type === 'expense') {
        item.pengeluaran += amount;
      }
      item.count += 1;
    });

    const result = Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
    result.forEach((item) => {
      item.labaBersih = item.pemasukan - item.pengeluaran;
      item.label = formatMonthYear(item.key);
      item.labelShort = (() => {
        const [, m] = item.key.split('-').map(Number);
        return MONTH_SHORT[m - 1];
      })();
    });
    return result;
  }

  function computeFinancialSummary(transactions) {
    let totalPemasukan = 0;
    let totalPengeluaran = 0;

    transactions.forEach((tx) => {
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'income') totalPemasukan += amount;
      else if (tx.type === 'expense') totalPengeluaran += amount;
    });

    const labaBersih = totalPemasukan - totalPengeluaran;
    const marginLaba = totalPemasukan > 0 ? (labaBersih / totalPemasukan) : 0;
    const monthlyList = aggregateMonthly(transactions);
    const monthsWithTx = monthlyList.length;

    const rataPemasukan = monthsWithTx > 0 ? Math.round(totalPemasukan / monthsWithTx) : 0;
    const rataPengeluaran = monthsWithTx > 0 ? Math.round(totalPengeluaran / monthsWithTx) : 0;
    const rataLabaBersih = monthsWithTx > 0 ? Math.round(labaBersih / monthsWithTx) : 0;

    // Guardrail rule from PRD: maximum safe debt installment is 30% of average monthly net profit
    const guardrailMaxCicilan = Math.max(0, Math.round(rataLabaBersih * 0.30));

    return {
      totalPemasukan,
      totalPengeluaran,
      labaBersih,
      marginLaba,
      monthsCount: monthsWithTx,
      rataPemasukan,
      rataPengeluaran,
      rataLabaBersih,
      guardrailMaxCicilan,
      monthlyList,
    };
  }

  /* ---------------- PRD Creditworthiness Score ---------------- */

  /**
   * PRD Formula:
   * Skor = 30*(B_catat/6) + 25*min(1, R_baru/R_lama) + 25*min(1, max(0, M)/0.20) + 20*(B_laba/6)
   */
  function calculatePrdScore(monthlyData) {
    const last6 = (monthlyData || []).slice(-6);
    const bCatat = last6.filter((m) => (m.pemasukan > 0 || m.pengeluaran > 0)).length;
    const k1 = Math.round(30 * (bCatat / 6));

    // Trend: first 3 of 6 vs last 3 of 6
    const half1 = last6.slice(0, 3);
    const half2 = last6.slice(3, 6);
    const rLama = half1.reduce((sum, m) => sum + m.pemasukan, 0);
    const rBaru = half2.reduce((sum, m) => sum + m.pemasukan, 0);

    let k2Ratio = 1;
    if (rLama > 0) {
      k2Ratio = Math.min(1, rBaru / rLama);
    } else if (rBaru > 0) {
      k2Ratio = 1;
    } else {
      k2Ratio = 0.5;
    }
    const k2 = Math.round(25 * k2Ratio);

    // Margin profit
    const totIn = last6.reduce((s, m) => s + m.pemasukan, 0);
    const totOut = last6.reduce((s, m) => s + m.pengeluaran, 0);
    const net = totIn - totOut;
    const margin = totIn > 0 ? (net / totIn) : 0;
    const k3 = Math.round(25 * Math.min(1, Math.max(0, margin) / 0.20));

    // Cash flow stability: months with positive net profit
    const bLaba = last6.filter((m) => m.labaBersih > 0).length;
    const k4 = Math.round(20 * (bLaba / 6));

    const total = Math.min(100, Math.max(0, k1 + k2 + k3 + k4));

    let kategori = 'Baik';
    let tone = 'green';
    let ringkasan = 'Kondisi keuangan sehat dan konsisten untuk persiapan pengajuan pembiayaan.';

    if (total < 40) {
      kategori = 'Rendah';
      tone = 'red';
      ringkasan = 'Pencatatan kas dan stabilitas arus kas perlu ditingkatkan sebelum pengajuan.';
    } else if (total < 70) {
      kategori = 'Cukup';
      tone = 'gold';
      ringkasan = 'Usaha memiliki potensi, disarankan memperkuat margin laba dan konsistensi transaksi.';
    }

    return {
      total,
      kategori,
      tone,
      ringkasan,
      komponen: {
        k1_konsistensi: { score: k1, max: 30, label: 'Konsistensi Pencatatan', detail: `${bCatat} dari 6 bulan tercatat` },
        k2_tren: { score: k2, max: 25, label: 'Tren Omzet', detail: rBaru >= rLama ? 'Stabil / Meningkat' : 'Mengalami penurunan' },
        k3_profitabilitas: { score: k3, max: 25, label: 'Profitabilitas Usaha', detail: `Margin laba ${(margin * 100).toFixed(1)}%` },
        k4_stabilitas: { score: k4, max: 20, label: 'Stabilitas Arus Kas', detail: `${bLaba} dari 6 bulan surplus kas` },
      },
    };
  }

  /* ---------------- Readiness Assessment (4 Pillars) ---------------- */

  function assessReportReadiness(data) {
    const { profile, transactions, legalitas, score } = data;

    const checks = [
      {
        pillarId: 'profil',
        title: 'Profil Usaha Lengkap',
        description: 'Nama usaha, pemilik, dan jenis usaha terdata resmi.',
        link: '../profil-usaha/index.html',
        linkText: 'Lengkapi Profil',
        isComplete: Boolean(profile && profile.nama_usaha && profile.nama_pemilik && profile.jenis_usaha),
        note: (profile && profile.nama_usaha)
          ? `${profile.nama_usaha} (${profile.jenis_usaha || 'Sektor Usaha'})`
          : 'Nama atau sektor usaha belum diisi di Profil Usaha.',
      },
      {
        pillarId: 'keuangan',
        title: 'Riwayat Transaksi Kas Warung',
        description: 'Pencatatan arus kas operasional minimal 3 transaksi.',
        link: '../Buku-Kas-Warung/index.html',
        linkText: 'Catat Kas Warung',
        isComplete: Array.isArray(transactions) && transactions.length >= 3,
        note: Array.isArray(transactions) && transactions.length > 0
          ? `${transactions.length} transaksi kas tercatat.`
          : 'Belum ada transaksi di Buku Kas Warung.',
      },
      {
        pillarId: 'legalitas',
        title: 'Legalitas Usaha & NIB',
        description: 'Nomor Induk Berusaha (NIB 13 digit) dari OSS RBA.',
        link: '../legalitas-&-nib/index.html',
        linkText: 'Kelola Legalitas',
        isComplete: Boolean(
          (legalitas && legalitas.nib && legalitas.nib.nomor) ||
          (profile && profile.nib && profile.nib.punya && profile.nib.nomor)
        ),
        note: (() => {
          const num = (legalitas && legalitas.nib && legalitas.nib.nomor) || (profile && profile.nib && profile.nib.nomor);
          return num ? `NIB: ${num}` : 'NIB belum didaftarkan di modul Legalitas & NIB.';
        })(),
      },
      {
        pillarId: 'skor',
        title: 'Skor Kelayakan Usaha',
        description: 'Hasil evaluasi kelayakan usaha terhitung dari arus kas.',
        link: '../Skor-Kelayakan/index.html',
        linkText: 'Cek Skor Kelayakan',
        isComplete: Boolean(score && typeof score.total === 'number' && score.total > 0),
        note: score ? `Skor: ${score.total}/100 (${score.kategori})` : 'Skor kelayakan belum dihitung.',
      },
    ];

    const completedCount = checks.filter((c) => c.isComplete).length;
    const totalCount = checks.length;
    const missing = checks.filter((c) => !c.isComplete);

    let status = M.REPORT_STATUS.SIAP_DIBUAT;
    let badgeTone = 'green';
    let badgeLabel = 'Siap Dibuat';
    let summaryText = 'Semua data usaha lengkap. Laporan siap dicetak atau diunduh untuk perbankan.';

    if (completedCount <= 1) {
      status = M.REPORT_STATUS.BELUM_SIAP;
      badgeTone = 'red';
      badgeLabel = 'Belum Siap';
      summaryText = 'Data utama belum mencukupi untuk menyusun laporan keuangan yang layak bagi bank.';
    } else if (completedCount < totalCount) {
      status = M.REPORT_STATUS.PERLU_DILENGKAPI;
      badgeTone = 'gold';
      badgeLabel = 'Perlu Dilengkapi';
      summaryText = `${missing.length} dari 4 pilar data perlu dilengkapi agar berkas pengajuan kredit lebih kuat.`;
    }

    return {
      status,
      badgeTone,
      badgeLabel,
      summaryText,
      completedCount,
      totalCount,
      checks,
      missing,
    };
  }

  global.LaporanLogic = Object.freeze({
    formatRupiah,
    formatDateIndo,
    formatMonthYear,
    filterTransactionsByPeriod,
    aggregateMonthly,
    computeFinancialSummary,
    calculatePrdScore,
    assessReportReadiness,
  });
})(window);

