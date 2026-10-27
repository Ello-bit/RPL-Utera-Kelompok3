/**
 * UTERA Dashboard Logic
 * antislop-code compliant: concise, purposeful logic for UMKM financial calculations.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Initial Realistic UMKM Warung Transactions ---
  let transactions = [
    {
      id: 1,
      time: 'Hari ini, 13:45',
      category: 'Penjualan Minuman',
      desc: 'Pesanan 15 Cup Kopi Susu Gula Aren',
      type: 'income',
      amount: 270000
    },
    {
      id: 2,
      time: 'Hari ini, 11:20',
      category: 'Penjualan Makanan',
      desc: 'Roti Bakar Coklat Keju & Camilan',
      type: 'income',
      amount: 185000
    },
    {
      id: 3,
      time: 'Hari ini, 09:10',
      category: 'Bahan Baku',
      desc: 'Kulakan Biji Kopi Robusta & Susu UHT',
      type: 'expense',
      amount: 450000
    },
    {
      id: 4,
      time: 'Kemarin, 20:30',
      category: 'Penjualan Minuman',
      desc: 'Rekap Kasir Shift Malam Warung',
      type: 'income',
      amount: 1420000
    },
    {
      id: 5,
      time: 'Kemarin, 14:00',
      category: 'Operasional',
      desc: 'Token Listrik PLN Warung Bulanan',
      type: 'expense',
      amount: 200000
    }
  ];

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

  // Calculate & Update Metrics
  function recalculateMetrics() {
    let baseIncome = 22975000;  // Base historical month income
    let baseExpense = 5750000;  // Base historical month expense

    // Add recent ledger
    transactions.forEach(tx => {
      if (tx.type === 'income') {
        baseIncome += tx.amount;
      } else {
        baseExpense += tx.amount;
      }
    });

    const netProfit = baseIncome - baseExpense;
    const maxInstallment30Pct = Math.round(netProfit * 0.30);

    // Dynamic PRD Score Formula (Pillar 2: Consistency + Cashflow Health)
    // 50 pts consistency + 34 pts profit margin ratio (caps at 100)
    const marginRatio = netProfit / (baseIncome || 1);
    const score = Math.min(96, Math.max(65, Math.round(50 + (marginRatio * 45))));

    if (valPemasukan) valPemasukan.textContent = formatRupiah(baseIncome);
    if (valPengeluaran) valPengeluaran.textContent = formatRupiah(baseExpense);
    if (valSaldo) valSaldo.textContent = formatRupiah(netProfit);
    if (valMaxCicilan) valMaxCicilan.textContent = formatRupiah(maxInstallment30Pct) + ' / bln';
    if (valSkor) valSkor.textContent = score;
    if (badgeTotalTx) badgeTotalTx.textContent = transactions.length;
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
      txTableBody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding:28px; color:var(--text-muted)">Belum ada data transaksi untuk filter ini.</td></tr>`;
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
        <td><span class="chip-cat ${catClass}">${tx.category}</span></td>
        <td><strong>${tx.desc}</strong></td>
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
      txCountDisplay.textContent = `Menampilkan ${filtered.length} dari ${transactions.length} transaksi kas`;
    }

    // Attach Delete Handlers
    txTableBody.querySelectorAll('.btn-icon-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.currentTarget.getAttribute('data-id'));
        transactions = transactions.filter(t => t.id !== id);
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
  function setTypeActive(type) {
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

      const now = new Date();
      const timeStr = `Hari ini, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      transactions.unshift({
        id: Date.now(),
        time: timeStr,
        category,
        desc,
        type,
        amount
      });

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
    if (chartHighlightNumber) chartHighlightNumber.textContent = 'Rp 24.850.000';
  });

  btnChartLaba?.addEventListener('click', () => {
    btnChartLaba.classList.add('active');
    btnChartOmzet?.classList.remove('active');
    if (chartHighlightNumber) chartHighlightNumber.textContent = 'Rp 18.450.000';
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

  // Quick Simulation Alert
  const btnQuickSim = document.getElementById('btn-quick-simulasi');
  btnQuickSim?.addEventListener('click', () => {
    const inputPlaf = prompt('Masukkan rencana plafon pinjaman usaha (Rp):', '50000000');
    if (inputPlaf) {
      const plaf = Number(inputPlaf);
      const estCicilan = Math.round((plaf * 1.06) / 24);
      const max30 = Math.round(18450000 * 0.30);
      const isSafe = estCicilan <= max30;
      alert(`Hasil Uji Guardrail Kas UTERA:\n\n• Plafon: ${formatRupiah(plaf)}\n• Estimasi Angsuran (Tenor 24 bln, Bunga 6%): ${formatRupiah(estCicilan)}/bln\n• Batas Aman 30% Kas Anda: ${formatRupiah(max30)}/bln\n\nStatus: ${isSafe ? '✅ AMAN (Beban cicilan di bawah 30% laba)' : '⚠️ MELEBIHI GUARDRAIL (Risiko mengganggu kasir operasional)'}`);
    }
  });

  // Initial Boot
  renderTransactions();
  recalculateMetrics();
});
