/**
 * UTERA Buku Kas Warung (F4: tambah, ubah, hapus, lihat riwayat transaksi).
 */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var Kas = window.UteraKas;
  var $ = function (id) { return document.getElementById(id); };

  var el = {
    monthLabel: $('month-label'),
    prevMonth: $('btn-prev-month'),
    nextMonth: $('btn-next-month'),
    exportBtn: $('btn-export'),
    openEntry: $('btn-open-entry'),
    bottomEntry: $('btn-bottom-entry'),
    notice: $('notice-region'),
    sumIncome: $('sum-income'),
    sumExpense: $('sum-expense'),
    sumNet: $('sum-net'),
    sumNetNote: $('sum-net-note'),
    ledgerTitle: $('ledger-title'),
    caption: $('table-caption'),
    body: $('ledger-body'),
    foot: $('ledger-foot'),
    search: $('filter-search'),
    filterCategory: $('filter-category'),
    panel: $('entry-panel'),
    panelTitle: $('entry-title'),
    closeEntry: $('btn-close-entry'),
    backdrop: $('sheet-backdrop'),
    form: $('entry-form'),
    amount: $('input-amount'),
    amountWrap: $('input-amount').parentElement,
    date: $('input-date'),
    category: $('input-category'),
    note: $('input-note'),
    submit: $('btn-submit'),
    cancel: $('btn-cancel'),
    errAmount: $('err-amount'),
    errDate: $('err-date'),
    errCategory: $('err-category'),
    errForm: $('err-form'),
    toast: $('toast'),
    toastText: $('toast-text'),
    toastAction: $('toast-action')
  };

  var MAX_AMOUNT = 999999999999;
  var sheetQuery = window.matchMedia('(max-width: 1180px)');

  var today = new Date();
  var todayISO = Kas.toISODate(today);

  var state = {
    all: Kas.load(),
    year: today.getFullYear(),
    month: today.getMonth(),
    q: '',
    type: 'all',
    category: 'all',
    editingId: null,
    highlightId: null,
    lastFocus: null
  };

  /* ---------- Util ---------- */

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function monthKey(y, m) { return y + '-' + String(m + 1).padStart(2, '0'); }

  function monthName(y, m) {
    return new Date(y, m, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }

  function parseISO(iso) {
    var p = iso.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function shortDate(iso) {
    return parseISO(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }

  function signed(tx) { return tx.type === 'income' ? tx.amount : -tx.amount; }

  function digitsOnly(v) { return v.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12); }

  function filtersActive() { return state.q !== '' || state.type !== 'all' || state.category !== 'all'; }

  function isCurrentOrFutureMonth() {
    return state.year > today.getFullYear() ||
      (state.year === today.getFullYear() && state.month >= today.getMonth());
  }

  /* ---------- Kategori ---------- */

  function fillCategoryOptions(type, selected) {
    var list = Kas.CATEGORIES[type];
    el.category.innerHTML = '<option value="">Pilih kategori</option>' + list.map(function (c) {
      return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
    }).join('');
    if (selected && list.indexOf(selected) !== -1) el.category.value = selected;
  }

  function fillFilterCategories() {
    var all = Kas.CATEGORIES.income.concat(Kas.CATEGORIES.expense);
    el.filterCategory.innerHTML = '<option value="all">Semua kategori</option>' + all.map(function (c) {
      return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
    }).join('');
  }

  /* ---------- Pemberitahuan ---------- */

  function renderNotices() {
    var html = '';
    var readError = Kas.state.readError;

    if (readError === 'corrupt') {
      html += '<div class="notice notice-error" role="alert">' +
        '<span class="material-symbols-rounded" aria-hidden="true">error</span>' +
        '<p>Data buku kas di browser ini rusak dan tidak bisa dibaca. Transaksi baru tetap bisa dicatat, tetapi akan menimpa data lama.</p>' +
        '<button type="button" class="btn btn-outline" data-action="clear-corrupt">Kosongkan data rusak</button></div>';
    } else if (readError === 'unavailable') {
      html += '<div class="notice notice-error" role="alert">' +
        '<span class="material-symbols-rounded" aria-hidden="true">error</span>' +
        '<p>Penyimpanan browser tidak bisa dipakai (misalnya mode penyamaran). Catatan hanya tersimpan sampai halaman ini ditutup.</p></div>';
    }

    if (state.all.some(function (t) { return t.sample; })) {
      html += '<div class="notice notice-sample">' +
        '<span class="material-symbols-rounded" aria-hidden="true">info</span>' +
        '<p>Sebagian baris adalah <strong>data contoh</strong> untuk mencoba fitur, bukan transaksi warung Anda.</p>' +
        '<button type="button" class="btn btn-outline" data-action="clear-sample">Hapus data contoh</button></div>';
    }

    el.notice.innerHTML = html;
  }

  /* ---------- Render lembar kas ---------- */

  function render() {
    var key = monthKey(state.year, state.month);
    var label = monthName(state.year, state.month);

    el.monthLabel.textContent = label;
    el.ledgerTitle.textContent = 'Lembar kas ' + label;
    el.caption.textContent = 'Transaksi kas ' + label;
    el.nextMonth.disabled = isCurrentOrFutureMonth();

    var sorted = Kas.sortLedger(state.all);
    var carry = 0;
    var hasEarlier = false;
    var monthRows = [];

    sorted.forEach(function (tx) {
      var k = tx.date.slice(0, 7);
      if (k < key) { carry += signed(tx); hasEarlier = true; }
      else if (k === key) monthRows.push(tx);
    });

    // Saldo berjalan dihitung dari semua transaksi bulan ini, sebelum filter
    var running = carry;
    var totalIn = 0;
    var totalOut = 0;
    var saldoById = {};
    monthRows.forEach(function (tx) {
      running += signed(tx);
      saldoById[tx.id] = running;
      if (tx.type === 'income') totalIn += tx.amount; else totalOut += tx.amount;
    });

    renderRekap(totalIn, totalOut);

    var q = state.q.toLowerCase();
    var shown = monthRows.filter(function (tx) {
      if (state.type !== 'all' && tx.type !== state.type) return false;
      if (state.category !== 'all' && tx.category !== state.category) return false;
      if (q && (tx.note || '').toLowerCase().indexOf(q) === -1 && tx.category.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });

    if (shown.length === 0) {
      renderEmpty(monthRows.length, label);
      el.foot.innerHTML = '';
      renderNotices();
      return;
    }

    var rows = '';
    if (!filtersActive() && hasEarlier) {
      rows += '<tr class="row-carry">' +
        '<td class="c-date"></td>' +
        '<td class="c-desc">Saldo dari bulan sebelumnya</td>' +
        '<td class="c-num c-in"></td><td class="c-num"></td>' +
        '<td class="c-num c-saldo' + (carry < 0 ? ' is-negative' : '') + '">' + (carry < 0 ? '- ' : '') + Kas.formatRupiah(carry) + '</td>' +
        '<td class="c-act"></td></tr>';
    }

    var prevDate = null;
    shown.forEach(function (tx) {
      var isIn = tx.type === 'income';
      var amount = Kas.formatRupiah(tx.amount);
      var saldo = saldoById[tx.id];
      var dateCell;

      if (tx.date === prevDate) {
        dateCell = '<span class="ditto" aria-hidden="true">&#12291;</span><span class="sr-only date-full">' + shortDate(tx.date) + '</span>';
      } else {
        dateCell = shortDate(tx.date) + (tx.date === todayISO ? '<span class="today-mark">Hari ini</span>' : '');
      }
      prevDate = tx.date;

      var classes = [];
      if (tx.id === state.editingId) classes.push('is-editing');
      if (tx.id === state.highlightId) classes.push('is-new');

      var desc = tx.note ? escapeHtml(tx.note) : escapeHtml(tx.category);
      var label = tx.note || tx.category;

      rows += '<tr data-id="' + tx.id + '"' + (classes.length ? ' class="' + classes.join(' ') + '"' : '') + '>' +
        '<td class="c-date">' + dateCell + '</td>' +
        '<td class="c-desc"><strong>' + desc + '</strong>' +
          '<span class="cat">' + escapeHtml(tx.category) + '</span>' +
          (tx.sample ? ' <span class="sample-tag">· contoh</span>' : '') + '</td>' +
        '<td class="c-num c-in">' + (isIn ? amount : '') + '</td>' +
        '<td class="c-num c-out">' + (isIn ? '' : amount) + '</td>' +
        '<td class="c-num c-saldo' + (saldo < 0 ? ' is-negative' : '') + '">' + (saldo < 0 ? '- ' : '') + Kas.formatRupiah(saldo) + '</td>' +
        '<td class="c-act">' +
          '<button type="button" class="row-btn edit" data-action="edit" aria-label="Ubah transaksi ' + escapeHtml(label) + '">' +
            '<span class="material-symbols-rounded" aria-hidden="true">edit</span></button> ' +
          '<button type="button" class="row-btn del" data-action="delete" aria-label="Hapus transaksi ' + escapeHtml(label) + '">' +
            '<span class="material-symbols-rounded" aria-hidden="true">delete</span></button>' +
        '</td></tr>';
    });
    el.body.innerHTML = rows;

    var footIn = totalIn, footOut = totalOut, footLabel = 'Jumlah bulan ini', footSaldo = running;
    if (filtersActive()) {
      footIn = 0; footOut = 0;
      shown.forEach(function (tx) { if (tx.type === 'income') footIn += tx.amount; else footOut += tx.amount; });
      footLabel = 'Jumlah yang ditampilkan';
      footSaldo = null;
    }

    el.foot.innerHTML = '<tr>' +
      '<td class="c-date"></td>' +
      '<td class="foot-label">' + footLabel + '</td>' +
      '<td class="c-num c-in f-in"><span class="is-income">' + Kas.formatRupiah(footIn) + '</span></td>' +
      '<td class="c-num f-out"><span class="is-expense">' + Kas.formatRupiah(footOut) + '</span></td>' +
      '<td class="c-num f-saldo">' + (footSaldo === null ? '' : '<span>' + (footSaldo < 0 ? '- ' : '') + Kas.formatRupiah(footSaldo) + '</span>') + '</td>' +
      '<td class="c-act"></td></tr>';

    state.highlightId = null;
    renderNotices();
  }

  function renderRekap(totalIn, totalOut) {
    var net = totalIn - totalOut;
    el.sumIncome.textContent = Kas.formatRupiah(totalIn);
    el.sumExpense.textContent = Kas.formatRupiah(totalOut);
    el.sumNet.textContent = (net < 0 ? '- ' : '') + Kas.formatRupiah(net);
    el.sumNet.className = 'num ' + (net < 0 ? 'is-expense' : 'is-income');

    if (totalIn === 0 && totalOut === 0) {
      el.sumNetNote.textContent = 'Belum ada transaksi di bulan ini.';
    } else if (net < 0) {
      el.sumNetNote.textContent = 'Rugi: pengeluaran lebih besar dari pemasukan.';
    } else {
      el.sumNetNote.textContent = 'Pemasukan dikurangi pengeluaran bulan ini.';
    }
  }

  function renderEmpty(monthCount, label) {
    var title, text, actions = '';

    if (monthCount > 0) {
      title = 'Tidak ada transaksi yang cocok.';
      text = 'Coba kata kunci lain atau tampilkan semua jenis dan kategori.';
      actions = '<button type="button" class="btn btn-secondary" data-action="reset-filter">Hapus filter</button>';
    } else if (state.all.length === 0) {
      title = 'Belum ada transaksi bulan ini.';
      text = 'Catat yang pertama. Saldo dan laba bersih akan terhitung otomatis.';
      actions = '<button type="button" class="btn btn-primary" data-action="open-entry">Catat transaksi</button>' +
        '<button type="button" class="btn btn-outline" data-action="load-sample">Isi data contoh</button>';
    } else if (isCurrentOrFutureMonth()) {
      title = 'Belum ada transaksi bulan ini.';
      text = 'Catat yang pertama.';
      actions = '<button type="button" class="btn btn-primary" data-action="open-entry">Catat transaksi</button>';
    } else {
      title = 'Tidak ada transaksi di ' + label + '.';
      text = 'Pilih bulan lain atau kembali ke bulan ini.';
      actions = '<button type="button" class="btn btn-secondary" data-action="go-today">Ke bulan ini</button>';
    }

    el.body.innerHTML = '<tr class="row-state"><td colspan="6">' +
      '<p class="state-title">' + title + '</p>' +
      '<p class="state-text">' + text + '</p>' +
      '<div class="state-actions">' + actions + '</div></td></tr>';
  }

  /* ---------- Simpan ---------- */

  function persist(next, failMessage) {
    if (!Kas.save(next)) {
      var reason = Kas.state.writeError === 'quota'
        ? 'Penyimpanan browser penuh.'
        : 'Penyimpanan browser menolak perubahan.';
      showToast(failMessage + ' ' + reason);
      return false;
    }
    state.all = next;
    if (Kas.state.readError === 'corrupt') Kas.state.readError = null;
    return true;
  }

  /* ---------- Form ---------- */

  function setFieldError(input, errEl, message, wrap) {
    errEl.textContent = message || '';
    (wrap || input).classList.toggle('is-invalid', !!message);
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function clearErrors() {
    setFieldError(el.amount, el.errAmount, '', el.amountWrap);
    setFieldError(el.date, el.errDate, '');
    setFieldError(el.category, el.errCategory, '');
    el.errForm.textContent = '';
  }

  function currentType() {
    return el.form.querySelector('input[name="type"]:checked').value;
  }

  function setType(type) {
    el.form.querySelector('input[name="type"][value="' + type + '"]').checked = true;
  }

  function resetForm(keepDateAndType) {
    var type = currentType();
    var date = el.date.value;
    el.form.reset();
    clearErrors();
    setType(keepDateAndType ? type : 'income');
    el.date.value = keepDateAndType && date ? date : todayISO;
    fillCategoryOptions(currentType());
  }

  function validate() {
    clearErrors();
    var firstInvalid = null;
    var amount = Number(digitsOnly(el.amount.value));

    if (!amount) {
      setFieldError(el.amount, el.errAmount, 'Isi nominal lebih dari Rp 0.', el.amountWrap);
      firstInvalid = firstInvalid || el.amount;
    } else if (amount > MAX_AMOUNT) {
      setFieldError(el.amount, el.errAmount, 'Nominal terlalu besar.', el.amountWrap);
      firstInvalid = firstInvalid || el.amount;
    }

    if (!el.date.value) {
      setFieldError(el.date, el.errDate, 'Pilih tanggal transaksi.');
      firstInvalid = firstInvalid || el.date;
    } else if (el.date.value > todayISO) {
      setFieldError(el.date, el.errDate, 'Tanggal tidak boleh setelah hari ini.');
      firstInvalid = firstInvalid || el.date;
    }

    if (!el.category.value) {
      setFieldError(el.category, el.errCategory, 'Pilih kategori.');
      firstInvalid = firstInvalid || el.category;
    }

    if (firstInvalid) { firstInvalid.focus(); return null; }

    return {
      type: currentType(),
      amount: amount,
      date: el.date.value,
      category: el.category.value,
      note: el.note.value.trim()
    };
  }

  function startEdit(id) {
    var tx = state.all.find(function (t) { return t.id === id; });
    if (!tx) return;

    state.editingId = id;
    setType(tx.type);
    fillCategoryOptions(tx.type, tx.category);
    el.amount.value = tx.amount.toLocaleString('id-ID');
    el.date.value = tx.date;
    el.note.value = tx.note || '';
    clearErrors();

    el.panel.classList.add('is-editing');
    el.panelTitle.textContent = 'Ubah transaksi';
    el.submit.textContent = 'Simpan perubahan';
    el.cancel.textContent = 'Batal ubah';

    render();
    openEntry();
  }

  function stopEdit() {
    state.editingId = null;
    el.panel.classList.remove('is-editing');
    el.panelTitle.textContent = 'Catat transaksi';
    el.submit.textContent = 'Catat transaksi';
    el.cancel.textContent = 'Batal';
  }

  el.form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = validate();
    if (!data) return;

    var next;
    var savedId;
    var wasEditing = !!state.editingId;

    if (wasEditing) {
      savedId = state.editingId;
      next = state.all.map(function (t) {
        if (t.id !== savedId) return t;
        var updated = Object.assign({}, t, data, { updatedAt: Date.now() });
        delete updated.sample;
        return updated;
      });
    } else {
      savedId = Kas.newId();
      next = state.all.concat([Object.assign({ id: savedId, createdAt: Date.now() }, data)]);
    }

    if (!persist(next, 'Transaksi belum tersimpan.')) {
      el.errForm.textContent = 'Transaksi belum tersimpan. Coba lagi atau hapus beberapa data lama.';
      return;
    }

    var d = parseISO(data.date);
    state.year = d.getFullYear();
    state.month = d.getMonth();
    state.highlightId = savedId;

    stopEdit();
    resetForm(true);
    render();
    showToast(wasEditing ? 'Perubahan disimpan.' : 'Transaksi dicatat.');

    if (sheetQuery.matches) closeEntry();
    else el.amount.focus();
  });

  el.cancel.addEventListener('click', function () {
    if (state.editingId) {
      stopEdit();
      resetForm(false);
      render();
    } else {
      resetForm(false);
    }
    if (sheetQuery.matches) closeEntry();
  });

  el.form.addEventListener('change', function (e) {
    if (e.target.name === 'type') {
      fillCategoryOptions(e.target.value, el.category.value);
      setFieldError(el.category, el.errCategory, '');
    }
  });

  // Format ribuan saat mengetik: "250000" jadi "250.000"
  el.amount.addEventListener('input', function () {
    var d = digitsOnly(el.amount.value);
    el.amount.value = d ? Number(d).toLocaleString('id-ID') : '';
    if (d) setFieldError(el.amount, el.errAmount, '', el.amountWrap);
  });

  el.date.addEventListener('change', function () { setFieldError(el.date, el.errDate, ''); });
  el.category.addEventListener('change', function () { setFieldError(el.category, el.errCategory, ''); });

  /* ---------- Panel / lembar bawah ---------- */

  function openEntry() {
    if (sheetQuery.matches) {
      if (!el.panel.classList.contains('is-open')) state.lastFocus = document.activeElement;
      el.panel.classList.add('is-open');
      el.panel.setAttribute('role', 'dialog');
      el.panel.setAttribute('aria-modal', 'true');
      el.backdrop.hidden = false;
      document.body.style.overflow = 'hidden';
    } else {
      el.panel.scrollIntoView({ block: 'nearest' });
    }
    setTimeout(function () { el.amount.focus(); }, 60);
  }

  function closeEntry() {
    if (!el.panel.classList.contains('is-open')) return;
    el.panel.classList.remove('is-open');
    el.panel.removeAttribute('role');
    el.panel.removeAttribute('aria-modal');
    el.backdrop.hidden = true;
    document.body.style.overflow = '';
    if (state.lastFocus && document.body.contains(state.lastFocus)) state.lastFocus.focus();
  }

  el.openEntry.addEventListener('click', openEntry);
  el.bottomEntry.addEventListener('click', openEntry);
  el.closeEntry.addEventListener('click', closeEntry);
  el.backdrop.addEventListener('click', closeEntry);

  document.addEventListener('keydown', function (e) {
    if (!el.panel.classList.contains('is-open')) return;

    if (e.key === 'Escape') { closeEntry(); return; }

    if (e.key === 'Tab') {
      var focusables = el.panel.querySelectorAll('button, input, select, [tabindex]:not([tabindex="-1"])');
      var list = Array.prototype.filter.call(focusables, function (n) { return !n.disabled && n.offsetParent !== null; });
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  sheetQuery.addEventListener('change', function (e) { if (!e.matches) closeEntry(); });

  /* ---------- Aksi baris dan tombol dinamis ---------- */

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    var row = btn.closest('tr[data-id]');

    if (action === 'edit' && row) startEdit(row.getAttribute('data-id'));
    if (action === 'delete' && row) deleteTx(row.getAttribute('data-id'));
    if (action === 'open-entry') openEntry();
    if (action === 'reset-filter') resetFilters();
    if (action === 'go-today') { state.year = today.getFullYear(); state.month = today.getMonth(); render(); }
    if (action === 'load-sample') loadSample();
    if (action === 'clear-sample') clearSample();
    if (action === 'clear-corrupt') { Kas.clearCorrupt(); state.all = []; render(); showToast('Data rusak sudah dikosongkan.'); }
  });

  function deleteTx(id) {
    var index = state.all.findIndex(function (t) { return t.id === id; });
    if (index === -1) return;
    var removed = state.all[index];
    var next = state.all.filter(function (t) { return t.id !== id; });

    if (!persist(next, 'Transaksi belum terhapus.')) return;

    if (state.editingId === id) { stopEdit(); resetForm(false); }
    render();
    $('ledger').focus();

    showToast('Transaksi dihapus.', function () {
      var restored = state.all.concat([removed]);
      if (persist(restored, 'Transaksi belum dikembalikan.')) {
        state.highlightId = removed.id;
        render();
        showToast('Transaksi dikembalikan.');
      }
    });
  }

  /* ---------- Filter dan bulan ---------- */

  function resetFilters() {
    state.q = ''; state.type = 'all'; state.category = 'all';
    el.search.value = '';
    el.filterCategory.value = 'all';
    document.querySelector('input[name="filter-type"][value="all"]').checked = true;
    render();
  }

  el.search.addEventListener('input', function () { state.q = el.search.value.trim(); render(); });
  el.filterCategory.addEventListener('change', function () { state.category = el.filterCategory.value; render(); });
  document.querySelectorAll('input[name="filter-type"]').forEach(function (r) {
    r.addEventListener('change', function () { state.type = r.value; render(); });
  });

  el.prevMonth.addEventListener('click', function () {
    state.month -= 1;
    if (state.month < 0) { state.month = 11; state.year -= 1; }
    render();
  });

  el.nextMonth.addEventListener('click', function () {
    if (isCurrentOrFutureMonth()) return;
    state.month += 1;
    if (state.month > 11) { state.month = 0; state.year += 1; }
    render();
  });

  /* ---------- Unduh CSV ---------- */

  el.exportBtn.addEventListener('click', function () {
    var key = monthKey(state.year, state.month);
    var sorted = Kas.sortLedger(state.all);
    var saldo = 0;
    var lines = [];

    sorted.forEach(function (tx) {
      saldo += signed(tx);
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
      showToast('Belum ada transaksi di ' + monthName(state.year, state.month) + ' untuk diunduh.');
      return;
    }

    // Pemisah titik koma agar langsung terbaca Excel berbahasa Indonesia
    var csv = [['Tanggal', 'Jenis', 'Kategori', 'Keterangan', 'Masuk', 'Keluar', 'Saldo']].concat(lines)
      .map(function (row) {
        return row.map(function (v) {
          var s = String(v);
          return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }).join(';');
      }).join('\r\n');

    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'utera-buku-kas-' + key + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    showToast('File ' + a.download + ' diunduh.');
  });

  /* ---------- Data contoh (berlabel, bisa dihapus) ---------- */

  function loadSample() {
    var plan = [
      [-2, 3, 'income', 'Penjualan', 'Rekap kasir', 1250000],
      [-2, 4, 'expense', 'Bahan baku / kulakan', 'Kulakan gula, kopi, susu', 640000],
      [-2, 15, 'expense', 'Operasional', 'Token listrik', 200000],
      [-2, 20, 'income', 'Penjualan', 'Rekap kasir', 1480000],
      [-1, 2, 'income', 'Penjualan', 'Rekap kasir', 1390000],
      [-1, 5, 'expense', 'Bahan baku / kulakan', 'Kulakan beras dan minyak', 720000],
      [-1, 12, 'expense', 'Gaji karyawan', 'Upah mingguan', 350000],
      [-1, 22, 'income', 'Pendapatan lain', 'Titipan kue tetangga', 150000],
      [0, 1, 'income', 'Penjualan', 'Rekap kasir', 980000],
      [0, 1, 'expense', 'Bahan baku / kulakan', 'Kulakan telur dan mi instan', 410000],
      [0, 3, 'expense', 'Peralatan', 'Termos es baru', 185000]
    ];

    var created = Date.now();
    var sample = [];
    plan.forEach(function (p, i) {
      var d = new Date(today.getFullYear(), today.getMonth() + p[0], p[1]);
      if (d > today) d = new Date(today);
      sample.push({
        id: Kas.newId() + i,
        date: Kas.toISODate(d),
        type: p[2],
        category: p[3],
        note: p[4],
        amount: p[5],
        createdAt: created + i,
        sample: true
      });
    });

    if (persist(state.all.concat(sample), 'Data contoh belum tersimpan.')) {
      render();
      showToast('Data contoh ditambahkan.');
    }
  }

  function clearSample() {
    var next = state.all.filter(function (t) { return !t.sample; });
    if (persist(next, 'Data contoh belum terhapus.')) {
      if (state.editingId && !next.some(function (t) { return t.id === state.editingId; })) { stopEdit(); resetForm(false); }
      render();
      showToast('Data contoh dihapus.');
    }
  }

  /* ---------- Toast ---------- */

  var toastTimer = null;
  var toastUndo = null;

  function showToast(text, undo) {
    clearTimeout(toastTimer);
    el.toastText.textContent = text;
    toastUndo = undo || null;
    el.toastAction.hidden = !undo;
    el.toast.hidden = false;
    toastTimer = setTimeout(hideToast, undo ? 6000 : 3000);
  }

  function hideToast() {
    el.toast.hidden = true;
    toastUndo = null;
  }

  el.toastAction.addEventListener('click', function () {
    var fn = toastUndo;
    hideToast();
    if (fn) fn();
  });

  /* ---------- Mulai ---------- */

  fillFilterCategories();
  el.date.max = todayISO;
  resetForm(false);
  render();
});
