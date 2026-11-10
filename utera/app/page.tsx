'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import './landing.css'

function formatRupiah(number: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(number)
}

interface TransactionItem {
  id: number
  date: string
  desc: string
  type: 'in' | 'out'
  amount: number
}

export default function LandingPage() {
  // Sticky Navbar state
  const [scrolled, setScrolled] = useState(false)

  // Tab State: 'score' | 'koperasi' | 'ledger'
  const [activeTab, setActiveTab] = useState<'score' | 'koperasi' | 'ledger'>('score')

  // Sliders: Tab 1 (Skor Kelayakan PRD)
  const [bCatat, setBCatat] = useState<number>(6)
  const [revenueRatio, setRevenueRatio] = useState<number>(1.15)
  const [margin, setMargin] = useState<number>(0.25)
  const [bLaba, setBLaba] = useState<number>(5)

  // Sliders: Tab 2 (Simulasi Koperasi Guardrail 30%)
  const [loanAmount, setLoanAmount] = useState<number>(15000000)
  const [tenor, setTenor] = useState<number>(12)
  const [interestRate, setInterestRate] = useState<number>(9)
  const [avgProfit, setAvgProfit] = useState<number>(5500000)

  // State: Tab 3 (Live Buku Kas Warung)
  const [transactions, setTransactions] = useState<TransactionItem[]>([
    { id: 1, date: '26 Okt 2026', desc: 'Penjualan Paket Keripik Pisang 120 Pcs', type: 'in', amount: 1800000 },
    { id: 2, date: '26 Okt 2026', desc: 'Pembelian Minyak Goreng & Pisang Tanduk', type: 'out', amount: 650000 },
    { id: 3, date: '25 Okt 2026', desc: 'Pesanan Katering Arisan Toko Berkah', type: 'in', amount: 2450000 },
    { id: 4, date: '25 Okt 2026', desc: 'Stiker Kemasan Alumunium Foil & Kardus', type: 'out', amount: 320000 },
  ])
  const [txDesc, setTxDesc] = useState<string>('')
  const [txAmount, setTxAmount] = useState<string>('')
  const [txType, setTxType] = useState<'in' | 'out'>('in')

  // FAQ Accordion State (index of open item, or null)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  // Scroll listener for sticky navbar
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 30) {
        setScrolled(true)
      } else {
        setScrolled(false)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Calculations: Tab 1 Skor
  const c1 = 30 * (bCatat / 6)
  const c2 = 25 * Math.min(1, revenueRatio >= 1 ? 1 : revenueRatio)
  const c3 = 25 * Math.min(1, Math.max(0, margin) / 0.20)
  const c4 = 20 * (bLaba / 6)
  const totalScore = Math.round(c1 + c2 + c3 + c4)

  let scoreStatus = 'BAIK (SIAP PENGAJUAN KUR)'
  let scoreClass = 'tag-baik'
  let scoreAdvice = 'Kondisi riwayat kas dan stabilitas usaha sangat prima. Usaha Anda memenuhi kriteria pengajuan fasilitas KUR Mikro hingga Rp 50 Juta dan pinjaman koperasi.'

  if (totalScore < 40) {
    scoreStatus = 'RENDAH (PERBAIKAN KAS)'
    scoreClass = 'tag-rendah'
    scoreAdvice = 'Perlu perbaikan disiplin pencatatan rutin dan efisiensi biaya sebelum mengajukan pembiayaan eksternal untuk menghindari penolakan bank.'
  } else if (totalScore < 70) {
    scoreStatus = 'CUKUP (BATAS AMAN)'
    scoreClass = 'tag-cukup'
    scoreAdvice = 'Memenuhi syarat kelayakan dasar. Disarankan meningkatkan margin laba bersih di atas 20% dan menjaga kestabilan laba 6 bulan berturut-turut.'
  }

  // Calculations: Tab 2 Koperasi
  const monthlyPrincipal = loanAmount / tenor
  const monthlyInterest = (loanAmount * (interestRate / 100)) / 12
  const totalInstallment = monthlyPrincipal + monthlyInterest
  const maxSafeInstallment = avgProfit * 0.30
  const burdenRatio = ((totalInstallment / avgProfit) * 100).toFixed(1)
  const isSafe = totalInstallment <= maxSafeInstallment

  // Calculations: Tab 3 Ledger
  let totalIn = 0
  let totalOut = 0
  transactions.forEach((t) => {
    if (t.type === 'in') totalIn += t.amount
    else totalOut += t.amount
  })
  const netProfit = totalIn - totalOut

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault()
    const nominal = Number(txAmount)
    if (!txDesc.trim() || isNaN(nominal) || nominal <= 0) return

    const newItem: TransactionItem = {
      id: Date.now(),
      date: 'Hari ini',
      desc: txDesc.trim(),
      type: txType,
      amount: nominal,
    }

    setTransactions((prev) => {
      const updated = [newItem, ...prev]
      if (updated.length > 5) updated.pop()
      return updated
    })

    setTxDesc('')
    setTxAmount('')
  }

  return (
    <>
      {/* ========================================================================
           1. FIXED SITE HEADER (Moka POS Clean White Sticky Navbar)
           ======================================================================== */}
      <header className={`site-header ${scrolled ? 'scrolled' : ''}`} id="site-header">
        <div className="container header-inner">
          {/* Brand Logo */}
          <Link href="#beranda" className="brand-link" id="brand-home" aria-label="Beranda UTERA">
            <div className="brand-badge">U</div>
            <div className="brand-info">
              <span className="brand-title">UTERA</span>
              <span className="brand-subtitle">Aplikasi Finansial UMKM</span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav aria-label="Navigasi Utama">
            <ul className="header-nav">
              <li><Link href="#beranda">Beranda</Link></li>
              <li><Link href="/buku-kas">Buku Kas</Link></li>
              <li><Link href="/skor-kelayakan">Skor Kelayakan</Link></li>
              <li><Link href="/guardrail">Guardrail 30%</Link></li>
              <li><Link href="/simulasi-kur">Simulasi KUR</Link></li>
              <li><Link href="/profil-usaha">Profil Usaha</Link></li>
              <li><Link href="#faq">FAQ</Link></li>
              <li><Link href="/dashboard" className="nav-highlight-link">Dashboard</Link></li>
            </ul>
          </nav>

          {/* Action Group */}
          <div className="header-actions">
            <Link href="/auth?mode=login" className="header-login-link" id="btn-login">Masuk</Link>
            <Link href="/auth?mode=register" className="btn btn-primary btn-sm btn-pill" id="btn-register">Coba Gratis</Link>
          </div>
        </div>
      </header>

      {/* ========================================================================
           2. HERO SECTION (Moka POS 2-Column Split: Headline + Tablet/Mockup Card)
           ======================================================================== */}
      <section className="hero-section" id="beranda">
        <div className="container hero-grid">
          {/* Left Column: Copy & CTAs */}
          <div className="hero-content">
            <div className="hero-eyebrow">PLATFORM FINANSIAL UMKM TERPADU</div>

            <h1 className="heading-hero">
              Satu Sistem Finansial untuk Semua Kebutuhan Bisnis.
            </h1>

            <p className="text-lead">
              Kelola pembukuan kas warung harian, pantau skor kelayakan kredit secara real-time, dan persiapkan pengajuan KUR serta pinjaman koperasi dengan kepastian angka yang dapat dipercaya perbankan.
            </p>

            <div className="hero-cta-group">
              <a href="#playground-simulator" className="btn btn-primary btn-pill" id="hero-btn-primary">
                <span>Mulai Gratis Sekarang</span>
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>arrow_forward</span>
              </a>
              <a href="#playground-simulator" className="btn btn-secondary btn-pill" id="hero-btn-demo">
                Buka Simulator Interaktif
              </a>
            </div>
          </div>

          {/* Right Column: Moka POS Signature Clean Dashboard Mockup Card */}
          <div className="hero-mockup-wrap">
            <div className="hero-device-frame">
              <div className="device-header">
                <div className="device-title">
                  <span className="device-dot"></span>
                  <strong>Backoffice Kas Warung UTERA</strong>
                </div>
                <span className="device-date-chip">Hari ini • Real-time Sync</span>
              </div>

              {/* Mockup Metrics Grid */}
              <div className="mockup-metrics-grid">
                <div className="mockup-metric-card">
                  <small>Total Pemasukan</small>
                  <div className="amount income tabular-nums">+ Rp 4.250.000</div>
                </div>
                <div className="mockup-metric-card">
                  <small>Laba Bersih Kas</small>
                  <div className="amount tabular-nums">Rp 1.480.000</div>
                </div>
              </div>

              {/* Live Ledger Snippet */}
              <div className="mockup-ledger-preview">
                <div className="mockup-ledger-header">
                  <span>Transaksi Terkini</span>
                  <span style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600 }}>1 Sumber Data</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-row-desc">Penjualan Paket Keripik Pisang</span>
                  <span className="mockup-row-amount plus tabular-nums">+ Rp 1.800.000</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-row-desc">Beli Minyak & Bahan Baku</span>
                  <span className="mockup-row-amount minus tabular-nums">- Rp 650.000</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-row-desc">Pesanan Toko Sembako Berkah</span>
                  <span className="mockup-row-amount plus tabular-nums">+ Rp 2.450.000</span>
                </div>
              </div>

              {/* Status Bar */}
              <div style={{ backgroundColor: 'var(--primary-soft)', border: '1px solid var(--primary-tint)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--primary-dark)', fontWeight: 700 }}>Status Arus Kas: SEHAT</span>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Cicilan Maks. 22.4%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================
           AURORA BACKGROUND WRAPPER (Landing Page Background Animation - Non-Hero, Non-Footer)
           ======================================================================== */}
      <main className="landing-aurora-main" id="konten-utama">
        {/* Flowing Aurora Background Canvas */}
        <div className="aurora-page-background" aria-hidden="true"></div>

        {/* ========================================================================
             3. CREDIBILITY & STATS BAR (Moka POS "Investasi Terbaik Bisnis")
             ======================================================================== */}
        <section className="stats-bar-section">
          <div className="container stats-grid">
            <div className="stat-item">
              <div className="stat-number tabular-nums">100 Poin</div>
              <div className="stat-label">Formula Skor PRD Berdasarkan Konsistensi & Laba</div>
            </div>
            <div className="stat-item">
              <div className="stat-number tabular-nums">Maks. 30%</div>
              <div className="stat-label">Batas Aman Rasio Beban Cicilan Kas Koperasi</div>
            </div>
            <div className="stat-item">
              <div className="stat-number tabular-nums">3 Kategori</div>
              <div className="stat-label">Plafon KUR 2026: Super Mikro, Mikro, & Kecil</div>
            </div>
            <div className="stat-item">
              <div className="stat-number tabular-nums">100% Siap</div>
              <div className="stat-label">Panduan Legalitas NIB, PIRT & Halal BPJPH</div>
            </div>
          </div>
        </section>

        {/* ========================================================================
             4. VALUE PROPOSITION: FEATURE SECTION (Moka POS "Sat-set" Section)
             ======================================================================== */}
        <section className="features-section" id="fitur-utama">
          <div className="container">
            <div className="section-center-header">
              <h2 className="heading-section">
                Pantau dan Kembangkan Usaha dengan <span className="text-primary-accent">Sat-set!</span>
              </h2>
              <p className="text-lead">
                Bisnis yang menggunakan pencatatan terstruktur UTERA 70% lebih cepat mendapatkan persetujuan fasilitas kredit modal kerja dari perbankan dan koperasi.
              </p>
            </div>

            <div className="features-grid-3">
              {/* Feature 1 */}
              <div className="feature-box">
                <div>
                  <div className="feature-icon-container" aria-hidden="true">
                    <span className="material-symbols-rounded" style={{ fontSize: '28px', color: 'var(--primary)' }}>receipt_long</span>
                  </div>
                  <h3>Buku Kas Warung Real-Time</h3>
                  <p>
                    Catat pemasukan dan pengeluaran harian dalam hitungan detik. Tanpa istilah akuntansi rumit, saldo laba bersih kas operasional langsung diperbarui otomatis.
                  </p>
                </div>
                <Link href="/buku-kas" className="feature-link">
                  <span>Buka Buku Kas Warung</span>
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>arrow_forward</span>
                </Link>
              </div>

              {/* Feature 2 */}
              <div className="feature-box">
                <div>
                  <div className="feature-icon-container" aria-hidden="true">
                    <span className="material-symbols-rounded" style={{ fontSize: '28px', color: 'var(--primary)' }}>verified</span>
                  </div>
                  <h3>Engine Skor Kelayakan (0–100)</h3>
                  <p>
                    Algoritma otomatis berbasis formula PRD resmi. Menguji 4 parameter objektif: konsistensi pencatatan, pertumbuhan omzet, margin laba, dan stabilitas kas 6 bulan.
                  </p>
                </div>
                <Link href="/skor-kelayakan" className="feature-link">
                  <span>Buka Skor Kelayakan</span>
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>arrow_forward</span>
                </Link>
              </div>

              {/* Feature 3 */}
              <div className="feature-box">
                <div>
                  <div className="feature-icon-container" aria-hidden="true">
                    <span className="material-symbols-rounded" style={{ fontSize: '28px', color: 'var(--primary)' }}>shield</span>
                  </div>
                  <h3>Simulasi Guardrail Batas 30% Kas</h3>
                  <p>
                    Cegah jeratan cicilan yang mengancam likuiditas usaha. Sistem memvalidasi ketat agar total angsuran bulanan tidak melampaui 30% dari rata-rata laba kas riil.
                  </p>
                </div>
                <Link href="/guardrail" className="feature-link">
                  <span>Uji Guardrail 30% Kas</span>
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================
             5A. MOKA-STYLE ALTERNATING FEATURE SECTION (Photo Left / Text Right)
             ======================================================================== */}
        <section className="moka-feature-alt-section" id="solusi-bisnis">
          {/* Feature Row 1: Calculator (Image Left, Text Right) */}
          <div className="moka-feature-row">
            <div className="moka-feature-img-col">
              <div className="moka-feature-img-card">
                <img src="/assets/calculator-hands.jpg" alt="Kalkulator Keuangan UTERA" loading="lazy" />
              </div>
            </div>
            <div className="moka-feature-text-col">
              <span className="moka-feature-kicker">UTERA Buku Kas</span>
              <h2 className="moka-feature-heading">Kelola keuangan usaha Anda dengan presisi dan kepercayaan</h2>
              <p className="moka-feature-desc">
                Kami membantu Anda mencatat setiap pemasukan dan pengeluaran secara akurat sehingga laporan keuangan Anda siap untuk pengajuan kredit bank kapan saja.
              </p>
              <a href="#playground-simulator" className="moka-feature-link" id="btn-fitur-kas" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span>Pelajari</span>
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>arrow_forward</span>
              </a>
            </div>
          </div>

          {/* Feature Row 2: Financial Team (Image Right, Text Left) */}
          <div className="moka-feature-row reverse">
            <div className="moka-feature-img-col">
              <div className="moka-feature-img-card">
                <img src="/assets/financial-team.png" alt="Tim Analisis Keuangan UTERA" loading="lazy" />
              </div>
            </div>
            <div className="moka-feature-text-col">
              <span className="moka-feature-kicker">UTERA Skor Kelayakan</span>
              <h2 className="moka-feature-heading">Dapatkan data analitik menarik dari setiap transaksi bisnis Anda</h2>
              <p className="moka-feature-desc">
                Algoritma otomatis UTERA menganalisis 4 parameter objektif &mdash; konsistensi, pertumbuhan omzet, margin laba, dan stabilitas kas &mdash; untuk menghasilkan Skor PRD yang diakui perbankan.
              </p>
              <Link href="/skor-kelayakan" className="moka-feature-link" id="btn-fitur-skor" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span>Buka Skor Kelayakan</span>
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>arrow_forward</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ========================================================================
             5C. COMMUNITY SHOWCASE (Entrepreneurs Photo Strip)
             ======================================================================== */}
        <section className="community-section">
          <div className="community-inner">
            <div className="community-photo-col">
              <div className="community-photo-card">
                <img src="/assets/entrepreneurs-community.jpg" alt="Komunitas UMKM UTERA" className="community-photo" loading="lazy" />
              </div>
            </div>
            <div className="community-text-col">
              <span className="moka-feature-kicker">UTERA Komunitas</span>
              <h2 className="moka-feature-heading">Bergabung bersama ribuan pelaku UMKM yang telah berkembang</h2>
              <p className="moka-feature-desc">
                Jutaan transaksi dicatat setiap bulan oleh pelaku usaha yang menggunakan UTERA. Mereka membuktikan bahwa pembukuan yang rapi adalah kunci membuka akses permodalan lebih cepat.
              </p>
              <a href="#playground-simulator" className="moka-feature-link" id="btn-komunitas" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span>Mulai Sekarang</span>
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>arrow_forward</span>
              </a>
            </div>
          </div>
        </section>

        {/* ========================================================================
             6. INTERACTIVE FINANCIAL PLAYGROUND (Moka POS SaaS Tool Container)
             ======================================================================== */}
        <section className="playground-section" id="playground-simulator">
          <div className="container">
            <div className="section-center-header">
              <h2 className="heading-section">
                Coba Langsung <span className="text-primary-accent">Sistemnya</span>
              </h2>
              <p className="text-lead">
                Eksplorasi bagaimana catatan transaksi kas harian mempengaruhi Skor Kelayakan pembiayaan dan batas aman cicilan pinjaman koperasi Anda secara instan.
              </p>
            </div>

            <div id="playground-root">
              <div className="playground-card">
                {/* 3 Tab Navigasi Bersih Khas SaaS */}
                <div className="playground-tabs">
                  <button
                    type="button"
                    className={`tab-btn ${activeTab === 'score' ? 'active' : ''}`}
                    onClick={() => setActiveTab('score')}
                  >
                    01. Uji Skor Kelayakan (0–100)
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${activeTab === 'koperasi' ? 'active' : ''}`}
                    onClick={() => setActiveTab('koperasi')}
                  >
                    02. Simulasi Koperasi (Batas 30% Kas)
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ledger')}
                  >
                    03. Live Buku Kas Warung
                  </button>
                </div>

                <div className="playground-body">
                  {activeTab === 'score' && (
                    <div className="sim-grid">
                      {/* Parameter Sliders */}
                      <div>
                        <h3 style={{ fontSize: '1.35rem', marginBottom: '24px', color: 'var(--neutral-900)' }}>
                          Parameter Riwayat Usaha (6 Bulan Terakhir)
                        </h3>

                        <div className="slider-box">
                          <div className="slider-label-row">
                            <span>1. Konsistensi Pencatatan Kas</span>
                            <span className="slider-chip tabular-nums">{bCatat} dari 6 Bulan Aktif</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="6"
                            step="1"
                            value={bCatat}
                            onChange={(e) => setBCatat(Number(e.target.value))}
                            id="sl-bcatat"
                            className="saas-slider"
                          />
                          <span className="slider-hint">Bobot 30 Poin: Frekuensi kedisiplinan mencatat pemasukan &amp; pengeluaran usaha.</span>
                        </div>

                        <div className="slider-box">
                          <div className="slider-label-row">
                            <span>2. Tren Pertumbuhan Omzet Usaha</span>
                            <span className="slider-chip tabular-nums">
                              {revenueRatio >= 1
                                ? `Bertumbuh (+${Math.round((revenueRatio - 1) * 100)}%)`
                                : `Penurunan (${Math.round((revenueRatio - 1) * 100)}%)`}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.5"
                            max="1.5"
                            step="0.05"
                            value={revenueRatio}
                            onChange={(e) => setRevenueRatio(Number(e.target.value))}
                            id="sl-rev"
                            className="saas-slider"
                          />
                          <span className="slider-hint">Bobot 25 Poin: Perbandingan omzet 3 bulan terbaru vs 3 bulan sebelumnya.</span>
                        </div>

                        <div className="slider-box">
                          <div className="slider-label-row">
                            <span>3. Margin Laba Bersih Usaha</span>
                            <span className="slider-chip tabular-nums">{Math.round(margin * 100)}% (Target: ≥20%)</span>
                          </div>
                          <input
                            type="range"
                            min="0.05"
                            max="0.40"
                            step="0.01"
                            value={margin}
                            onChange={(e) => setMargin(Number(e.target.value))}
                            id="sl-margin"
                            className="saas-slider"
                          />
                          <span className="slider-hint">Bobot 25 Poin: Rasio efisiensi laba bersih terhadap total omzet kotor.</span>
                        </div>

                        <div className="slider-box">
                          <div className="slider-label-row">
                            <span>4. Stabilitas Arus Kas Positif</span>
                            <span className="slider-chip tabular-nums">{bLaba} dari 6 Bulan Untung</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="6"
                            step="1"
                            value={bLaba}
                            onChange={(e) => setBLaba(Number(e.target.value))}
                            id="sl-blaba"
                            className="saas-slider"
                          />
                          <span className="slider-hint">Bobot 20 Poin: Jumlah bulan yang mencatatkan arus kas surplus operasional.</span>
                        </div>
                      </div>

                      {/* Output Panel Diagnosis */}
                      <div className="result-card">
                        <div>
                          <div className="result-header">
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--primary)' }}>
                              SKOR KELAYAKAN USAHA
                            </span>
                            <div className="score-display-row">
                              <span className="score-number tabular-nums">{totalScore}</span>
                              <span className="score-denom">/ 100</span>
                            </div>
                            <div className={`status-tag ${scoreClass}`}>{scoreStatus}</div>
                          </div>

                          <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--neutral-600)', marginBottom: '24px' }}>
                            {scoreAdvice}
                          </p>

                          <div className="chips-breakdown-grid">
                            <div className="breakdown-chip">
                              <small>Pencatatan Kas</small>
                              <strong className="tabular-nums">{Math.round(c1)} / 30</strong>
                            </div>
                            <div className="breakdown-chip">
                              <small>Pertumbuhan Omzet</small>
                              <strong className="tabular-nums">{Math.round(c2)} / 25</strong>
                            </div>
                            <div className="breakdown-chip">
                              <small>Margin Laba</small>
                              <strong className="tabular-nums">{Math.round(c3)} / 25</strong>
                            </div>
                            <div className="breakdown-chip">
                              <small>Konsistensi Laba</small>
                              <strong className="tabular-nums">{Math.round(c4)} / 20</strong>
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: '32px', borderTop: '1px solid var(--neutral-200)', paddingTop: '20px' }}>
                          <a href="#kur-plafon" className="btn btn-primary" style={{ width: '100%' }}>
                            Lihat Rekomendasi Plafon KUR →
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'koperasi' && (
                    <div className="sim-grid">
                      {/* Controls Koperasi */}
                      <div>
                        <h3 style={{ fontSize: '1.35rem', marginBottom: '24px', color: 'var(--neutral-900)' }}>
                          Parameter Pinjaman &amp; Kapasitas Kas
                        </h3>

                        <div className="slider-box">
                          <div className="slider-label-row">
                            <span>Nominal Pengajuan Modal</span>
                            <span className="slider-chip tabular-nums">{formatRupiah(loanAmount)}</span>
                          </div>
                          <input
                            type="range"
                            min="3000000"
                            max="50000000"
                            step="1000000"
                            value={loanAmount}
                            onChange={(e) => setLoanAmount(Number(e.target.value))}
                            id="sl-loan"
                            className="saas-slider"
                          />
                          <span className="slider-hint">Rentang umum pinjaman anggota koperasi simpan pinjam UMKM.</span>
                        </div>

                        <div className="slider-box">
                          <div className="slider-label-row">
                            <span>Jangka Waktu (Tenor)</span>
                            <span className="slider-chip tabular-nums">{tenor} Bulan</span>
                          </div>
                          <input
                            type="range"
                            min="6"
                            max="36"
                            step="6"
                            value={tenor}
                            onChange={(e) => setTenor(Number(e.target.value))}
                            id="sl-tenor"
                            className="saas-slider"
                          />
                          <span className="slider-hint">Tenor lebih panjang memperkecil beban cicilan per bulan.</span>
                        </div>

                        <div className="slider-box">
                          <div className="slider-label-row">
                            <span>Jasa / Bunga Koperasi per Tahun</span>
                            <span className="slider-chip tabular-nums">{interestRate}% p.a.</span>
                          </div>
                          <input
                            type="range"
                            min="6"
                            max="18"
                            step="1"
                            value={interestRate}
                            onChange={(e) => setInterestRate(Number(e.target.value))}
                            id="sl-rate"
                            className="saas-slider"
                          />
                          <span className="slider-hint">Standar suku bunga wajar koperasi legal binaan Kemenkop UKM.</span>
                        </div>

                        <div className="slider-box">
                          <div className="slider-label-row">
                            <span>Rata-Rata Laba Bersih Kas Bulanan</span>
                            <span className="slider-chip tabular-nums">{formatRupiah(avgProfit)}</span>
                          </div>
                          <input
                            type="range"
                            min="2000000"
                            max="25000000"
                            step="500000"
                            value={avgProfit}
                            onChange={(e) => setAvgProfit(Number(e.target.value))}
                            id="sl-profit"
                            className="saas-slider"
                          />
                          <span className="slider-hint">Diambil otomatis dari rata-rata Buku Kas Warung 6 bulan terakhir.</span>
                        </div>
                      </div>

                      {/* Result Panel Guardrail 30% */}
                      <div className="result-card">
                        <div>
                          <div className="result-header">
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--primary)' }}>
                              UJI GUARDRAIL BATAS 30% KAS
                            </span>
                            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--neutral-900)', lineHeight: 1.1, marginTop: '6px' }} className="tabular-nums">
                              {formatRupiah(totalInstallment)} <span style={{ fontSize: '1rem', color: 'var(--neutral-500)', fontWeight: 500 }}>/ bulan</span>
                            </div>
                            <div className={`status-tag ${isSafe ? 'tag-baik' : 'tag-rendah'}`}>
                              {isSafe ? `AMAN: ${burdenRatio}% DARI LABA` : `BERISIKO TINGGI: ${burdenRatio}% DARI LABA`}
                            </div>
                          </div>

                          <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--neutral-600)', marginBottom: '24px' }}>
                            {isSafe
                              ? `Estimasi angsuran sebesar ${formatRupiah(totalInstallment)} berada di bawah batas toleransi maksimal kas (30% = ${formatRupiah(maxSafeInstallment)}). Usaha Anda memiliki sisa cadangan kas aman sebesar ${formatRupiah(avgProfit - totalInstallment)} per bulan.`
                              : `Peringatan: Angsuran melampaui batas aman 30% laba bersih (${formatRupiah(maxSafeInstallment)}). Risiko gagal bayar tinggi saat terjadi penurunan omzet. Disarankan memperpanjang tenor atau menurunkan nominal pinjaman.`
                            }
                          </p>

                          <div className="chips-breakdown-grid">
                            <div className="breakdown-chip">
                              <small>Cicilan Pokok</small>
                              <strong className="tabular-nums">{formatRupiah(monthlyPrincipal)}</strong>
                            </div>
                            <div className="breakdown-chip">
                              <small>Jasa Koperasi</small>
                              <strong className="tabular-nums">{formatRupiah(monthlyInterest)}</strong>
                            </div>
                            <div className="breakdown-chip">
                              <small>Batas Aman 30%</small>
                              <strong className="tabular-nums">{formatRupiah(maxSafeInstallment)}</strong>
                            </div>
                            <div className="breakdown-chip">
                              <small>Sisa Cadangan Kas</small>
                              <strong className="tabular-nums" style={{ color: isSafe ? 'var(--primary)' : 'var(--secondary)' }}>
                                {formatRupiah(avgProfit - totalInstallment)}
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: '32px', borderTop: '1px solid var(--neutral-200)', paddingTop: '20px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ width: '100%' }}
                            onClick={() => alert('Laporan simulasi telah siap. Dalam versi lengkap, Anda dapat mengunduh formulir pengajuan anggota koperasi terverifikasi.')}
                          >
                            Unduh Rekomendasi Simulasi PDF
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'ledger' && (
                    <div className="sim-grid">
                      <div>
                        {/* Metric Cards */}
                        <div className="ledger-metrics-strip">
                          <div className="ledger-metric-box">
                            <small>Total Pemasukan</small>
                            <div className="val val-in tabular-nums">+ {formatRupiah(totalIn)}</div>
                          </div>
                          <div className="ledger-metric-box">
                            <small>Total Pengeluaran</small>
                            <div className="val val-out tabular-nums">- {formatRupiah(totalOut)}</div>
                          </div>
                          <div className="ledger-metric-box">
                            <small>Laba Bersih Kas</small>
                            <div className="val val-net tabular-nums">{formatRupiah(netProfit)}</div>
                          </div>
                        </div>

                        {/* Transaction Table */}
                        <table className="saas-table">
                          <thead>
                            <tr>
                              <th>Tanggal</th>
                              <th>Keterangan Transaksi</th>
                              <th style={{ textAlign: 'right' }}>Nominal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactions.map((t) => (
                              <tr key={t.id}>
                                <td style={{ color: 'var(--neutral-500)', fontSize: '0.82rem' }}>{t.date}</td>
                                <td style={{ fontWeight: 600, color: 'var(--neutral-900)' }}>{t.desc}</td>
                                <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700, color: t.type === 'in' ? 'var(--primary)' : 'var(--secondary)' }}>
                                  {t.type === 'in' ? '+ ' : '- '} {formatRupiah(t.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Quick Add Form */}
                        <form onSubmit={handleAddTransaction} className="saas-form">
                          <div className="form-row">
                            <input
                              type="text"
                              value={txDesc}
                              onChange={(e) => setTxDesc(e.target.value)}
                              placeholder="Keterangan transaksi baru..."
                              className="saas-input"
                              required
                            />
                            <input
                              type="number"
                              value={txAmount}
                              onChange={(e) => setTxAmount(e.target.value)}
                              placeholder="Rp Nominal"
                              className="saas-input"
                              min="1000"
                              step="1000"
                              required
                            />
                          </div>
                          <div className="form-row">
                            <select
                              value={txType}
                              onChange={(e) => setTxType(e.target.value as 'in' | 'out')}
                              className="saas-select"
                            >
                              <option value="in">+ Pemasukan Kas Usaha</option>
                              <option value="out">- Pengeluaran Operasional</option>
                            </select>
                            <button type="submit" className="btn btn-primary btn-sm">
                              + Tambah Transaksi
                            </button>
                          </div>
                        </form>
                      </div>

                      {/* Right Info Card */}
                      <div className="result-card">
                        <div>
                          <div className="result-header">
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--primary)' }}>
                              INTEGRASI SATU SUMBER DATA
                            </span>
                            <h3 style={{ fontSize: '1.35rem', color: 'var(--neutral-900)', marginTop: '6px' }}>
                              Satu Sistem Kas untuk Seluruh Kebutuhan
                            </h3>
                          </div>

                          <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--neutral-600)', marginBottom: '20px' }}>
                            Setiap transaksi yang Anda catat pada Buku Kas Warung secara otomatis memperbarui:
                          </p>

                          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem', color: 'var(--neutral-800)', marginBottom: '24px' }}>
                            <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                              <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--primary)', flexShrink: 0 }}>check_circle</span>
                              <span><strong>Skor Kelayakan:</strong> Menghitung ulang margin laba dan konsistensi catatan bulanan.</span>
                            </li>
                            <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                              <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--primary)', flexShrink: 0 }}>check_circle</span>
                              <span><strong>Guardrail Koperasi:</strong> Memperbarui batas aman cicilan 30% berdasarkan saldo kas riil.</span>
                            </li>
                            <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                              <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--primary)', flexShrink: 0 }}>check_circle</span>
                              <span><strong>Laporan Bank:</strong> Menghasilkan neraca laba rugi terstandar tanpa pencatatan ganda.</span>
                            </li>
                          </ul>
                        </div>

                        <div style={{ borderTop: '1px solid var(--neutral-200)', paddingTop: '20px' }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ width: '100%' }}
                            onClick={() => alert('Laporan Kas Periode Berjalan telah siap dicetak sesuai standar SAK EMKM.')}
                          >
                            Ekspor Laporan Keuangan (PDF)
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================
             7. KUR TIERS & PLAFON (Moka POS Clean Pricing / Plafon Cards)
             ======================================================================== */}
        <section className="kur-section" id="kur-plafon">
          <div className="container">
            <div className="section-center-header">
              <h2 className="heading-section">
                Pilihan Plafon KUR Bank Sesuai <span className="text-primary-accent">Kapasitas Usaha</span>
              </h2>
              <p className="text-lead">
                Mengacu pada ketentuan Permenko Perekonomian No. 1 Tahun 2023 dan pedoman penyaluran KUR BRI 2026.
              </p>
            </div>

            <div className="kur-grid-3">
              {/* Tier 1 */}
              <div className="kur-tier-card">
                <div>
                  <span className="tier-category">Tahap Rintisan</span>
                  <h3 className="tier-name">KUR Super Mikro</h3>
                  <div className="tier-plafon tabular-nums">s.d Rp 10 Juta</div>
                  <p style={{ fontSize: '0.92rem', color: 'var(--neutral-600)', lineHeight: 1.55 }}>
                    Cocok untuk tambahan modal awal dan pengadaan peralatan kerja bagi usaha mikro yang baru berjalan.
                  </p>
                  <ul className="tier-checklist">
                    <li>
                      <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--primary)', flexShrink: 0 }}>check_circle</span>
                      <span>Suku bunga bersubsidi 3% efektif per tahun</span>
                    </li>
                    <li>
                      <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--primary)', flexShrink: 0 }}>check_circle</span>
                      <span>Tanpa agunan fisik tambahan</span>
                    </li>
                    <li>
                      <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--primary)', flexShrink: 0 }}>check_circle</span>
                      <span>Cukup NIB atau Surat Keterangan Usaha (SKU)</span>
                    </li>
                    <li>
                      <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--primary)', flexShrink: 0 }}>check_circle</span>
                      <span>Tenor kredit modal kerja hingga 36 bulan</span>
                    </li>
                  </ul>
                </div>
                <Link href="/simulasi-kur" className="btn btn-secondary" style={{ width: '100%' }}>
                  Uji Syarat Super Mikro
                </Link>
              </div>

              {/* Tier 2 (Featured Moka POS Style) */}
              <div className="kur-tier-card featured">
                <span className="featured-ribbon">Paling Banyak Dipilih</span>
                <div>
                  <span className="tier-category" style={{ color: 'var(--primary)' }}>Rekomendasi Utama</span>
                  <h3 className="tier-name">KUR Mikro</h3>
                  <div className="tier-plafon highlight tabular-nums">Rp 10 Juta – Rp 50 Juta</div>
                  <p style={{ fontSize: '0.92rem', color: 'var(--neutral-600)', lineHeight: 1.55 }}>
                    Skema paling ideal bagi warung, katering, dan bengkel yang membutuhkan stok dan bahan baku reguler.
                  </p>
                  <ul className="tier-checklist">
                    <li>
                      <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--primary)', flexShrink: 0 }}>check_circle</span>
                      <span>Suku bunga bersubsidi 6% efektif per tahun</span>
                    </li>
                    <li>
                      <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--primary)', flexShrink: 0 }}>check_circle</span>
                      <span>Evaluasi catatan kas minimal 6 bulan berturut-turut</span>
                    </li>
                    <li>
                      <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--primary)', flexShrink: 0 }}>check_circle</span>
                      <span>Rekomendasi Skor Kelayakan UTERA: BAIK (≥ 70)</span>
                    </li>
                    <li>
                      <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--primary)', flexShrink: 0 }}>check_circle</span>
                      <span>Laporan keuangan PDF UTERA siap dilampirkan</span>
                    </li>
                  </ul>
                </div>
                <Link href="/simulasi-kur" className="btn btn-primary" style={{ width: '100%' }}>
                  Uji Kelayakan KUR Mikro
                </Link>
              </div>

              {/* Tier 3 */}
              <div className="kur-tier-card">
                <div>
                  <span className="tier-category">Skala Ekspansi</span>
                  <h3 className="tier-name">KUR Kecil</h3>
                  <div className="tier-plafon tabular-nums">Rp 50 Juta – Rp 500 Juta</div>
                  <p style={{ fontSize: '0.92rem', color: 'var(--neutral-600)', lineHeight: 1.55 }}>
                    Dikhususkan untuk usaha yang siap membuka cabang baru atau pengadaan armada logistik produksi.
                  </p>
                  <ul className="tier-checklist">
                    <li>
                      <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--primary)', flexShrink: 0 }}>check_circle</span>
                      <span>Suku bunga bertahap 6% s.d 9% efektif</span>
                    </li>
                    <li>
                      <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--primary)', flexShrink: 0 }}>check_circle</span>
                      <span>Wajib melampirkan NIB aktif dan NPWP usaha</span>
                    </li>
                    <li>
                      <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--primary)', flexShrink: 0 }}>check_circle</span>
                      <span>Agunan pokok sesuai dengan ketentuan bank pelaksana</span>
                    </li>
                    <li>
                      <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--primary)', flexShrink: 0 }}>check_circle</span>
                      <span>Tenor investasi hingga 60 bulan (5 tahun)</span>
                    </li>
                  </ul>
                </div>
                <Link href="/simulasi-kur" className="btn btn-secondary" style={{ width: '100%' }}>
                  Uji Syarat KUR Kecil
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================
             8. TESTIMONIALS SECTION (Moka POS Real Merchant Stories)
             ======================================================================== */}
        <section className="testimonials-section">
          <div className="container">
            <div className="section-center-header">
              <h2 className="heading-section">
                Dipercaya oleh Pelaku Usaha di <span className="text-primary-accent">Seluruh Indonesia</span>
              </h2>
              <p className="text-lead">
                Bagaimana kepastian pembukuan satu sumber data membantu pengusaha mikro mendapatkan persetujuan modal kerja.
              </p>
            </div>

            <div className="testi-grid">
              {/* Testi 1 */}
              <div className="testi-card">
                <p className="testi-quote">
                  « Sejak menggunakan UTERA, pembukuan kas warung saya tidak lagi tercecer di sobekan nota. Saat mengajukan KUR Mikro Rp 30 Juta, pihak bank langsung menyetujui karena laporan arus kas 6 bulan rapi dan skor kelayakan saya 84. »
                </p>
                <div className="testi-author">
                  <div className="author-avatar">SN</div>
                  <div className="author-meta">
                    <h5>Suryani Ningsih</h5>
                    <span>Pemilik Keripik Pisang Berkah, Mojokerto</span>
                  </div>
                </div>
              </div>

              {/* Testi 2 */}
              <div className="testi-card">
                <p className="testi-quote">
                  « Fitur simulasi batas 30% koperasi sangat menyelematkan usaha bengkel saya. Saya jadi tahu persis berapa cicilan yang aman tanpa mengganggu uang belanja suku cadang bulanan. »
                </p>
                <div className="testi-author">
                  <div className="author-avatar" style={{ backgroundColor: 'var(--secondary)' }}>HG</div>
                  <div className="author-meta">
                    <h5>Hendra Gunawan</h5>
                    <span>Pemilik Bengkel Motor Makmur, Malang</span>
                  </div>
                </div>
              </div>

              {/* Testi 3 */}
              <div className="testi-card">
                <p className="testi-quote">
                  « Panduan NIB OSS dan sertifikasi halal UTERA membuat izin usaha saya selesai dalam 1 minggu. Ekspor laporan laba rugi format PDF-nya langsung diterima tanpa revisi oleh koperasi. »
                </p>
                <div className="testi-author">
                  <div className="author-avatar" style={{ backgroundColor: 'var(--tertiary)' }}>DP</div>
                  <div className="author-meta">
                    <h5>Dimas Pratama</h5>
                    <span>Owner Konveksi Kaos Lokal, Bandung</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================
             9. HIGH-CONVERTING CTA BANNER (Moka POS Vibrant Green Card)
             ======================================================================== */}
        <section className="cta-banner-section">
          <div className="container">
            <div className="cta-banner-card">
              <div className="cta-banner-text">
                <h2>Cari tahu bagaimana UTERA bisa membantu memajukan usaha Anda</h2>
                <p>Beralih dari pencatatan bon kertas tercecer menuju pembukuan kas modern yang membukakan jalan menuju permodalan dan kemandirian usaha Anda.</p>
              </div>
              <div className="cta-banner-buttons">
                <a href="#playground-simulator" className="btn btn-white btn-pill">
                  Mulai Sekarang Gratis
                </a>
                <a href="#playground-simulator" className="btn btn-ghost-white btn-pill">
                  Uji Skor Kelayakan
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================
             10. FAQ ACCORDION SECTION (Moka POS Clean FAQ)
             ======================================================================== */}
        <section className="faq-section" id="faq">
          <div className="container">
            <div className="section-center-header">
              <h2 className="heading-section">
                Pertanyaan Seputar <span className="text-primary-accent">Platform UTERA</span>
              </h2>
            </div>

            <div className="faq-list">
              {/* FAQ 1 */}
              <div className={`faq-item ${openFaq === 0 ? 'active' : ''}`}>
                <div className="faq-header" onClick={() => setOpenFaq(openFaq === 0 ? null : 0)}>
                  <h4>Bagaimana cara UTERA menjamin data keuangan usaha saya valid?</h4>
                  <span className="material-symbols-rounded faq-icon" style={{ fontSize: '24px', transition: 'transform 0.25s ease', transform: openFaq === 0 ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--primary)' }}>keyboard_arrow_down</span>
                </div>
                <div className="faq-body">
                  UTERA menerapkan prinsip Satu Sumber Data Keuangan. Setiap catatan transaksi harian pada Buku Kas Warung secara otomatis mengalir ke neraca laba rugi, mesin hitung skor kelayakan, dan simulasi guardrail cicilan tanpa kemungkinan pengeditan ganda yang tidak konsisten.
                </div>
              </div>

              {/* FAQ 2 */}
              <div className={`faq-item ${openFaq === 1 ? 'active' : ''}`}>
                <div className="faq-header" onClick={() => setOpenFaq(openFaq === 1 ? null : 1)}>
                  <h4>Apakah UTERA memberikan persetujuan pinjaman secara langsung?</h4>
                  <span className="material-symbols-rounded faq-icon" style={{ fontSize: '24px', transition: 'transform 0.25s ease', transform: openFaq === 1 ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--primary)' }}>keyboard_arrow_down</span>
                </div>
                <div className="faq-body">
                  Tidak. UTERA adalah platform analitik dan pendampingan kesehatan finansial. Skor kelayakan dan laporan yang dihasilkan UTERA berfungsi sebagai berkas pendukung resmi untuk mempermudah penilaian oleh bank penyalur KUR (seperti BRI, Mandiri, BNI) atau koperasi simpan pinjam terkait.
                </div>
              </div>

              {/* FAQ 3 */}
              <div className={`faq-item ${openFaq === 2 ? 'active' : ''}`}>
                <div className="faq-header" onClick={() => setOpenFaq(openFaq === 2 ? null : 2)}>
                  <h4>Mengapa beban cicilan pinjaman dibatasi maksimal 30% dari laba kas?</h4>
                  <span className="material-symbols-rounded faq-icon" style={{ fontSize: '24px', transition: 'transform 0.25s ease', transform: openFaq === 2 ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--primary)' }}>keyboard_arrow_down</span>
                </div>
                <div className="faq-body">
                  Batas 30% adalah standar manajemen risiko kas (Debt Service Coverage) yang direkomendasikan untuk usaha mikro. Jika cicilan melebihi 30% dari laba bersih bulanan, usaha Anda berisiko mengalami defisit modal saat terjadi penurunan omzet atau kenaikan harga bahan baku.
                </div>
              </div>

              {/* FAQ 4 */}
              <div className={`faq-item ${openFaq === 3 ? 'active' : ''}`}>
                <div className="faq-header" onClick={() => setOpenFaq(openFaq === 3 ? null : 3)}>
                  <h4>Bantuan perizinan apa saja yang disediakan dalam sistem UTERA?</h4>
                  <span className="material-symbols-rounded faq-icon" style={{ fontSize: '24px', transition: 'transform 0.25s ease', transform: openFaq === 3 ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--primary)' }}>keyboard_arrow_down</span>
                </div>
                <div className="faq-body">
                  UTERA menyediakan panduan pemenuhan dokumen NIB berbasis risiko (OSS RBA), persyaratan izin edar pangan industri rumah tangga (PIRT) dari Dinas Kesehatan, serta panduan sertifikasi halal melalui BPJPH Kementerian Agama.
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================================
           11. COMPREHENSIVE FOOTER (Moka POS Indonesian SaaS Footer)
           ======================================================================== */}
      <footer className="site-footer">
        <div className="container">
          <div className="footer-top-grid">
            {/* Brand Statement */}
            <div className="footer-brand">
              <Link href="#beranda" className="brand-link" aria-label="Beranda UTERA">
                <div className="brand-badge">U</div>
                <div className="brand-info">
                  <span className="brand-title">UTERA</span>
                  <span className="brand-subtitle">Aplikasi Finansial UMKM</span>
                </div>
              </Link>
              <p>
                Platform pendampingan finansial dan kepatuhan perizinan berbasis cloud untuk kemandirian dan akuntabilitas UMKM Indonesia.
              </p>
            </div>

            {/* Col 1 */}
            <div className="footer-col">
              <h5>Layanan</h5>
              <ul>
                <li><a href="#playground-simulator">Buku Kas Warung Digital</a></li>
                <li><Link href="/skor-kelayakan">Kalkulator Skor Kelayakan</Link></li>
                <li><Link href="/guardrail">Simulasi Guardrail 30% Kas</Link></li>
                <li><Link href="/simulasi-kur">Simulasi KUR BRI 2026</Link></li>
                <li><Link href="/profil-usaha">Profil Usaha &amp; Legalitas</Link></li>
              </ul>
            </div>

            {/* Col 2 */}
            <div className="footer-col">
              <h5>Solusi Bisnis</h5>
              <ul>
                <li><a href="#solusi-bisnis">Kuliner & Kedai Kopi</a></li>
                <li><a href="#solusi-bisnis">Retail & Warung Sembako</a></li>
                <li><a href="#solusi-bisnis">Jasa, Bengkel & Salon</a></li>
                <li><a href="#solusi-bisnis">Kerajinan & Fashion</a></li>
              </ul>
            </div>

            {/* Col 3 */}
            <div className="footer-col">
              <h5>Informasi & Legal</h5>
              <ul>
                <li><a href="#fitur-utama">Standar Akuntansi SAK EMKM</a></li>
                <li><a href="#fitur-utama">Panduan NIB via OSS RBA</a></li>
                <li><a href="#fitur-utama">Sertifikasi Halal BPJPH</a></li>
                <li><a href="#faq">Kebijakan Privasi & Ketentuan</a></li>
              </ul>
            </div>
          </div>

          {/* Compliance Disclaimer Note Sesuai PRD */}
          <div className="footer-compliance-box">
            <strong>Pemberitahuan Resmi:</strong> Fitur skor kelayakan, perhitungan estimasi KUR Planner, dan simulasi guardrail beban koperasi pada sistem UTERA disajikan sebagai instrumen analitik dan persiapan administratif. Platform UTERA tidak bertindak sebagai lembaga keuangan penyalur kredit dan tidak menerbitkan keputusan persetujuan pinjaman secara mandiri. Hak persetujuan sepenuhnya merupakan diskresi bank penyalur atau koperasi terkait.
          </div>

          {/* Bottom Bar */}
          <div className="footer-bottom">
            <div>© 2026 UTERA (UMKM Sejahtera) • Proyek RPL Kelompok 3. Seluruh Hak Cipta Dilindungi.</div>
            <div>Inspirasi Layout & Arsitektur SaaS: <em>Moka POS (mokapos.com)</em></div>
          </div>
        </div>
      </footer>
    </>
  )
}
