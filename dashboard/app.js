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

    if (bizName) {
      const elBizName = document.getElementById('sidebar-business-name');
      if (elBizName) elBizName.textContent = bizName;
    }
  }

  // Initial Boot
  renderUserProfile();
  fillModalCategories('income');
  renderTransactions();
  recalculateMetrics();
  syncSavedGuardrail();
});
