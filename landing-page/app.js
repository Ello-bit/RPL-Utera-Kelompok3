/* ==========================================================================
   UTERA (UMKM Sejahtera) - Financial Engine Console (Moka POS SaaS Architecture)
   Sistem Perhitungan Finansial, Skor Kelayakan PRD, Guardrail 30% Kas Koperasi
   ========================================================================== */

// Helper: Format Rupiah Standar Indonesia
function formatRupiah(number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(number);
}

// Inisialisasi Saat Dokumen Selesai Dimuat
document.addEventListener('DOMContentLoaded', () => {
  initNavbarScroll();
  initPlaygroundEngine();
  initFaqAccordion();
});

// ==========================================================================
// 1. NAVBAR SCROLL EFFECT
// ==========================================================================
function initNavbarScroll() {
  const header = document.getElementById('site-header');
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, { passive: true });
}

// ==========================================================================
// 2. PLAYGROUND ENGINE (Moka POS SaaS Tabbed Card)
// ==========================================================================
function initPlaygroundEngine() {
  const root = document.getElementById('playground-root');
  if (!root) return;

  // State Manajemen Tab: 'score' | 'koperasi' | 'ledger'
  let activeTab = 'score';

  // --- State Tab 1: Skor Kelayakan Formula PRD ---
  let bCatat = 6;            // Bulan aktif mencatat transaksi (1-6)
  let revenueRatio = 1.15;   // R_baru / R_lama
  let margin = 0.25;         // Margin laba bersih (5% - 40%)
  let bLaba = 5;             // Bulan laba positif (1-6)

  // --- State Tab 2: Simulasi Pinjaman Koperasi ---
  let loanAmount = 15000000; // Rp 15 Juta
  let tenor = 12;            // 12 Bulan
  let interestRate = 9;      // 9% per tahun
  let avgProfit = 5500000;   // Rp 5.5 Juta rata-rata laba bulanan

  // --- State Tab 3: Live Buku Kas Warung ---
  let transactions = [
    { id: 1, date: '26 Okt 2026', desc: 'Penjualan Paket Keripik Pisang 120 Pcs', type: 'in', amount: 1800000 },
    { id: 2, date: '26 Okt 2026', desc: 'Pembelian Minyak Goreng & Pisang Tanduk', type: 'out', amount: 650000 },
    { id: 3, date: '25 Okt 2026', desc: 'Pesanan Katering Arisan Toko Berkah', type: 'in', amount: 2450000 },
    { id: 4, date: '25 Okt 2026', desc: 'Stiker Kemasan Alumunium Foil & Kardus', type: 'out', amount: 320000 }
  ];

  function render() {
    // 1. Kalkulasi Live Buku Kas
    let totalIn = 0;
    let totalOut = 0;
    transactions.forEach(t => {
      if (t.type === 'in') totalIn += t.amount;
      else totalOut += t.amount;
    });
    const netProfit = totalIn - totalOut;

    // 2. Kalkulasi Skor PRD:
    // Skor = 30*(B_catat/6) + 25*min(1, R_baru/R_lama) + 25*min(1, max(0, M)/0.20) + 20*(B_laba/6)
    const c1 = 30 * (bCatat / 6);
    const c2 = 25 * Math.min(1, revenueRatio >= 1 ? 1 : revenueRatio);
    const c3 = 25 * Math.min(1, Math.max(0, margin) / 0.20);
    const c4 = 20 * (bLaba / 6);
    const totalScore = Math.round(c1 + c2 + c3 + c4);

    let scoreStatus = 'BAIK (SIAP PENGAJUAN KUR)';
    let scoreClass = 'tag-baik';
    let scoreAdvice = 'Kondisi riwayat kas dan stabilitas usaha sangat prima. Usaha Anda memenuhi kriteria pengajuan fasilitas KUR Mikro hingga Rp 50 Juta dan pinjaman koperasi.';

    if (totalScore < 40) {
      scoreStatus = 'RENDAH (PERBAIKAN KAS)';
      scoreClass = 'tag-rendah';
      scoreAdvice = 'Perlu perbaikan disiplin pencatatan rutin dan efisiensi biaya sebelum mengajukan pembiayaan eksternal untuk menghindari penolakan bank.';
    } else if (totalScore < 70) {
      scoreStatus = 'CUKUP (BATAS AMAN)';
      scoreClass = 'tag-cukup';
      scoreAdvice = 'Memenuhi syarat kelayakan dasar. Disarankan meningkatkan margin laba bersih di atas 20% dan menjaga kestabilan laba 6 bulan berturut-turut.';
    }

    // 3. Kalkulasi Simulasi Koperasi (Batas 30% Arus Kas)
    const monthlyPrincipal = loanAmount / tenor;
    const monthlyInterest = (loanAmount * (interestRate / 100)) / 12;
    const totalInstallment = monthlyPrincipal + monthlyInterest;
    const maxSafeInstallment = avgProfit * 0.30;
    const burdenRatio = ((totalInstallment / avgProfit) * 100).toFixed(1);
    const isSafe = totalInstallment <= maxSafeInstallment;

    root.innerHTML = `
      <div class="playground-card">
        <!-- 3 Tab Navigasi Bersih Khas SaaS -->
        <div class="playground-tabs">
          <button class="tab-btn ${activeTab === 'score' ? 'active' : ''}" data-tab="score">
            01. Uji Skor Kelayakan (0–100)
          </button>
          <button class="tab-btn ${activeTab === 'koperasi' ? 'active' : ''}" data-tab="koperasi">
            02. Simulasi Koperasi (Batas 30% Kas)
          </button>
          <button class="tab-btn ${activeTab === 'ledger' ? 'active' : ''}" data-tab="ledger">
            03. Live Buku Kas Warung
          </button>
        </div>

        <div class="playground-body">
          ${activeTab === 'score' ? `
            <div class="sim-grid">
              <!-- Parameter Sliders -->
              <div>
                <h3 style="font-size: 1.35rem; margin-bottom: 24px; color: var(--neutral-900);">Parameter Riwayat Usaha (6 Bulan Terakhir)</h3>

                <div class="slider-box">
                  <div class="slider-label-row">
                    <span>1. Konsistensi Pencatatan Kas</span>
                    <span class="slider-chip tabular-nums">${bCatat} dari 6 Bulan Aktif</span>
                  </div>
                  <input type="range" min="1" max="6" step="1" value="${bCatat}" id="sl-bcatat" class="saas-slider">
                  <span class="slider-hint">Bobot 30 Poin: Frekuensi kedisiplinan mencatat pemasukan & pengeluaran usaha.</span>
                </div>

                <div class="slider-box">
                  <div class="slider-label-row">
                    <span>2. Tren Pertumbuhan Omzet Usaha</span>
                    <span class="slider-chip tabular-nums">${revenueRatio >= 1 ? `Bertumbuh (+${Math.round((revenueRatio - 1) * 100)}%)` : `Penurunan (${Math.round((revenueRatio - 1) * 100)}%)`}</span>
                  </div>
                  <input type="range" min="0.5" max="1.5" step="0.05" value="${revenueRatio}" id="sl-rev" class="saas-slider">
                  <span class="slider-hint">Bobot 25 Poin: Perbandingan omzet 3 bulan terbaru vs 3 bulan sebelumnya.</span>
                </div>

                <div class="slider-box">
                  <div class="slider-label-row">
                    <span>3. Margin Laba Bersih Usaha</span>
                    <span class="slider-chip tabular-nums">${Math.round(margin * 100)}% (Target: ≥20%)</span>
                  </div>
                  <input type="range" min="0.05" max="0.40" step="0.01" value="${margin}" id="sl-margin" class="saas-slider">
                  <span class="slider-hint">Bobot 25 Poin: Rasio efisiensi laba bersih terhadap total omzet kotor.</span>
                </div>

                <div class="slider-box">
                  <div class="slider-label-row">
                    <span>4. Stabilitas Arus Kas Positif</span>
                    <span class="slider-chip tabular-nums">${bLaba} dari 6 Bulan Untung</span>
                  </div>
                  <input type="range" min="1" max="6" step="1" value="${bLaba}" id="sl-blaba" class="saas-slider">
                  <span class="slider-hint">Bobot 20 Poin: Jumlah bulan yang mencatatkan arus kas surplus operasional.</span>
                </div>
              </div>

              <!-- Output Panel Diagnosis -->
              <div class="result-card">
                <div>
                  <div class="result-header">
                    <span style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--primary);">SKOR KELAYAKAN USAHA</span>
                    <div class="score-display-row">
                      <span class="score-number tabular-nums">${totalScore}</span>
                      <span class="score-denom">/ 100</span>
                    </div>
                    <div class="status-tag ${scoreClass}">${scoreStatus}</div>
                  </div>

                  <p style="font-size: 0.95rem; line-height: 1.6; color: var(--neutral-600); margin-bottom: 24px;">
                    ${scoreAdvice}
                  </p>

                  <div class="chips-breakdown-grid">
                    <div class="breakdown-chip">
                      <small>Pencatatan Kas</small>
                      <strong class="tabular-nums">${Math.round(c1)} / 30</strong>
                    </div>
                    <div class="breakdown-chip">
                      <small>Pertumbuhan Omzet</small>
                      <strong class="tabular-nums">${Math.round(c2)} / 25</strong>
                    </div>
                    <div class="breakdown-chip">
                      <small>Margin Laba</small>
                      <strong class="tabular-nums">${Math.round(c3)} / 25</strong>
                    </div>
                    <div class="breakdown-chip">
                      <small>Konsistensi Laba</small>
                      <strong class="tabular-nums">${Math.round(c4)} / 20</strong>
                    </div>
                  </div>
                </div>

                <div style="margin-top: 32px; border-top: 1px solid var(--neutral-200); padding-top: 20px;">
                  <a href="#kur-plafon" class="btn btn-primary" style="width: 100%;">
                    Lihat Rekomendasi Plafon KUR →
                  </a>
                </div>
              </div>
            </div>
          ` : activeTab === 'koperasi' ? `
            <div class="sim-grid">
              <!-- Controls Koperasi -->
              <div>
                <h3 style="font-size: 1.35rem; margin-bottom: 24px; color: var(--neutral-900);">Parameter Pinjaman & Kapasitas Kas</h3>

                <div class="slider-box">
                  <div class="slider-label-row">
                    <span>Nominal Pengajuan Modal</span>
                    <span class="slider-chip tabular-nums">${formatRupiah(loanAmount)}</span>
                  </div>
                  <input type="range" min="3000000" max="50000000" step="1000000" value="${loanAmount}" id="sl-loan" class="saas-slider">
                  <span class="slider-hint">Rentang umum pinjaman anggota koperasi simpan pinjam UMKM.</span>
                </div>

                <div class="slider-box">
                  <div class="slider-label-row">
                    <span>Jangka Waktu (Tenor)</span>
                    <span class="slider-chip tabular-nums">${tenor} Bulan</span>
                  </div>
                  <input type="range" min="6" max="36" step="6" value="${tenor}" id="sl-tenor" class="saas-slider">
                  <span class="slider-hint">Tenor lebih panjang memperkecil beban cicilan per bulan.</span>
                </div>

                <div class="slider-box">
                  <div class="slider-label-row">
                    <span>Jasa / Bunga Koperasi per Tahun</span>
                    <span class="slider-chip tabular-nums">${interestRate}% p.a.</span>
                  </div>
                  <input type="range" min="6" max="18" step="1" value="${interestRate}" id="sl-rate" class="saas-slider">
                  <span class="slider-hint">Standar suku bunga wajar koperasi legal binaan Kemenkop UKM.</span>
                </div>

                <div class="slider-box">
                  <div class="slider-label-row">
                    <span>Rata-Rata Laba Bersih Kas Bulanan</span>
                    <span class="slider-chip tabular-nums">${formatRupiah(avgProfit)}</span>
                  </div>
                  <input type="range" min="2000000" max="25000000" step="500000" value="${avgProfit}" id="sl-profit" class="saas-slider">
                  <span class="slider-hint">Diambil otomatis dari rata-rata Buku Kas Warung 6 bulan terakhir.</span>
                </div>
              </div>

              <!-- Result Panel Guardrail 30% -->
              <div class="result-card">
                <div>
                  <div class="result-header">
                    <span style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--primary);">UJI GUARDRAIL BATAS 30% KAS</span>
                    <div style="font-size: 2.25rem; font-weight: 800; color: var(--neutral-900); line-height: 1.1; margin-top: 6px;" class="tabular-nums">
                      ${formatRupiah(totalInstallment)} <span style="font-size: 1rem; color: var(--neutral-500); font-weight: 500;">/ bulan</span>
                    </div>
                    <div class="status-tag ${isSafe ? 'tag-baik' : 'tag-rendah'}">
                      ${isSafe ? `AMAN: ${burdenRatio}% DARI LABA` : `BERISIKO TINGGI: ${burdenRatio}% DARI LABA`}
                    </div>
                  </div>

                  <p style="font-size: 0.95rem; line-height: 1.6; color: var(--neutral-600); margin-bottom: 24px;">
                    ${isSafe
                      ? `Estimasi angsuran sebesar <strong>${formatRupiah(totalInstallment)}</strong> berada di bawah batas toleransi maksimal kas (30% = <strong>${formatRupiah(maxSafeInstallment)}</strong>). Usaha Anda memiliki sisa cadangan kas aman sebesar <strong>${formatRupiah(avgProfit - totalInstallment)}</strong> per bulan.`
                      : `Peringatan: Angsuran melampaui batas aman 30% laba bersih (<strong>${formatRupiah(maxSafeInstallment)}</strong>). Risiko gagal bayar tinggi saat terjadi penurunan omzet. Disarankan memperpanjang tenor atau menurunkan nominal pinjaman.`
                    }
                  </p>

                  <div class="chips-breakdown-grid">
                    <div class="breakdown-chip">
                      <small>Cicilan Pokok</small>
                      <strong class="tabular-nums">${formatRupiah(monthlyPrincipal)}</strong>
                    </div>
                    <div class="breakdown-chip">
                      <small>Jasa Koperasi</small>
                      <strong class="tabular-nums">${formatRupiah(monthlyInterest)}</strong>
                    </div>
                    <div class="breakdown-chip">
                      <small>Batas Aman 30%</small>
                      <strong class="tabular-nums">${formatRupiah(maxSafeInstallment)}</strong>
                    </div>
                    <div class="breakdown-chip">
                      <small>Sisa Cadangan Kas</small>
                      <strong class="tabular-nums" style="color: ${isSafe ? 'var(--primary)' : 'var(--secondary)'};">${formatRupiah(avgProfit - totalInstallment)}</strong>
                    </div>
                  </div>
                </div>

                <div style="margin-top: 32px; border-top: 1px solid var(--neutral-200); padding-top: 20px;">
                  <button class="btn btn-secondary" style="width: 100%;" onclick="alert('Laporan simulasi telah siap. Dalam versi lengkap, Anda dapat mengunduh formulir pengajuan anggota koperasi terverifikasi.');">
                    Unduh Rekomendasi Simulasi PDF
                  </button>
                </div>
              </div>
            </div>
          ` : `
            <!-- TAB 3: LIVE BUKU KAS WARUNG -->
            <div class="sim-grid">
              <div>
                <!-- Metric Cards -->
                <div class="ledger-metrics-strip">
                  <div class="ledger-metric-box">
                    <small>Total Pemasukan</small>
                    <div class="val val-in tabular-nums">+ ${formatRupiah(totalIn)}</div>
                  </div>
                  <div class="ledger-metric-box">
                    <small>Total Pengeluaran</small>
                    <div class="val val-out tabular-nums">- ${formatRupiah(totalOut)}</div>
                  </div>
                  <div class="ledger-metric-box">
                    <small>Laba Bersih Kas</small>
                    <div class="val val-net tabular-nums">${formatRupiah(netProfit)}</div>
                  </div>
                </div>

                <!-- Transaction Table -->
                <table class="saas-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Keterangan Transaksi</th>
                      <th style="text-align: right;">Nominal</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${transactions.map(t => `
                      <tr>
                        <td style="color: var(--neutral-500); font-size: 0.82rem;">${t.date}</td>
                        <td style="font-weight: 600; color: var(--neutral-900);">${t.desc}</td>
                        <td class="tabular-nums" style="text-align: right; font-weight: 700; color: ${t.type === 'in' ? 'var(--primary)' : 'var(--secondary)'};">
                          ${t.type === 'in' ? '+ ' : '- '} ${formatRupiah(t.amount)}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>

                <!-- Quick Add Form -->
                <form id="saas-tx-form" class="saas-form">
                  <div class="form-row">
                    <input type="text" id="tx-desc" placeholder="Keterangan transaksi baru..." class="saas-input" required>
                    <input type="number" id="tx-amount" placeholder="Rp Nominal" class="saas-input" min="1000" step="1000" required>
                  </div>
                  <div class="form-row">
                    <select id="tx-type" class="saas-select">
                      <option value="in">+ Pemasukan Kas Usaha</option>
                      <option value="out">- Pengeluaran Operasional</option>
                    </select>
                    <button type="submit" class="btn btn-primary btn-sm">
                      + Tambah Transaksi
                    </button>
                  </div>
                </form>
              </div>

              <!-- Right Info Card -->
              <div class="result-card">
                <div>
                  <div class="result-header">
                    <span style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--primary);">INTEGRASI SATU SUMBER DATA</span>
                    <h3 style="font-size: 1.35rem; color: var(--neutral-900); margin-top: 6px;">Satu Sistem Kas untuk Seluruh Kebutuhan</h3>
                  </div>

                  <p style="font-size: 0.95rem; line-height: 1.6; color: var(--neutral-600); margin-bottom: 20px;">
                    Setiap transaksi yang Anda catat pada Buku Kas Warung secara otomatis memperbarui:
                  </p>

                  <ul style="list-style: none; display: flex; flex-direction: column; gap: 12px; font-size: 0.9rem; color: var(--neutral-800); margin-bottom: 24px;">
                    <li style="display: flex; gap: 10px;">
                      <span style="color: var(--primary); font-weight: 700;">✓</span>
                      <span><strong>Skor Kelayakan:</strong> Menghitung ulang margin laba dan konsistensi catatan bulanan.</span>
                    </li>
                    <li style="display: flex; gap: 10px;">
                      <span style="color: var(--primary); font-weight: 700;">✓</span>
                      <span><strong>Guardrail Koperasi:</strong> Memperbarui batas aman cicilan 30% berdasarkan saldo kas riil.</span>
                    </li>
                    <li style="display: flex; gap: 10px;">
                      <span style="color: var(--primary); font-weight: 700;">✓</span>
                      <span><strong>Laporan Bank:</strong> Menghasilkan neraca laba rugi terstandar tanpa pencatatan ganda.</span>
                    </li>
                  </ul>
                </div>

                <div style="border-top: 1px solid var(--neutral-200); padding-top: 20px;">
                  <button class="btn btn-primary" style="width: 100%;" onclick="alert('Laporan Kas Periode Berjalan telah siap dicetak sesuai standar SAK EMKM.');">
                    Ekspor Laporan Keuangan (PDF)
                  </button>
                </div>
              </div>
            </div>
          `}
        </div>
      </div>
    `;

    // Pasang Event Listeners Tab Switcher
    root.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        render();
      });
    });

    // Pasang Event Listeners Sliders Tab 1 (Score)
    if (activeTab === 'score') {
      const slCatat = document.getElementById('sl-bcatat');
      const slRev = document.getElementById('sl-rev');
      const slMargin = document.getElementById('sl-margin');
      const slLaba = document.getElementById('sl-blaba');

      if (slCatat) slCatat.addEventListener('input', (e) => { bCatat = Number(e.target.value); render(); });
      if (slRev) slRev.addEventListener('input', (e) => { revenueRatio = Number(e.target.value); render(); });
      if (slMargin) slMargin.addEventListener('input', (e) => { margin = Number(e.target.value); render(); });
      if (slLaba) slLaba.addEventListener('input', (e) => { bLaba = Number(e.target.value); render(); });
    }

    // Pasang Event Listeners Sliders Tab 2 (Koperasi)
    if (activeTab === 'koperasi') {
      const slLoan = document.getElementById('sl-loan');
      const slTenor = document.getElementById('sl-tenor');
      const slRate = document.getElementById('sl-rate');
      const slProfit = document.getElementById('sl-profit');

      if (slLoan) slLoan.addEventListener('input', (e) => { loanAmount = Number(e.target.value); render(); });
      if (slTenor) slTenor.addEventListener('input', (e) => { tenor = Number(e.target.value); render(); });
      if (slRate) slRate.addEventListener('input', (e) => { interestRate = Number(e.target.value); render(); });
      if (slProfit) slProfit.addEventListener('input', (e) => { avgProfit = Number(e.target.value); render(); });
    }

    // Pasang Event Listener Form Tab 3 (Ledger)
    if (activeTab === 'ledger') {
      const form = document.getElementById('saas-tx-form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const descInput = document.getElementById('tx-desc');
          const amountInput = document.getElementById('tx-amount');
          const typeInput = document.getElementById('tx-type');

          const desc = descInput.value.trim();
          const amount = Number(amountInput.value);
          const type = typeInput.value;

          if (!desc || isNaN(amount) || amount <= 0) return;

          transactions.unshift({
            id: Date.now(),
            date: 'Hari ini',
            desc,
            type,
            amount
          });

          if (transactions.length > 5) transactions.pop();
          render();
        });
      }
    }
  }

  render();
}

// ==========================================================================
// 3. FAQ ACCORDION INTERACTION
// ==========================================================================
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const header = item.querySelector('.faq-header');
    if (header) {
      header.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        faqItems.forEach(other => other.classList.remove('active'));
        if (!isActive) {
          item.classList.add('active');
        }
      });
    }
  });
}


