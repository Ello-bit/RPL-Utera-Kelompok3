import Link from 'next/link'
import Image from 'next/image'
import './landing.css'

export default function LandingPage() {
  return (
    <>
      {/* 1. FIXED SITE HEADER */}
      <header className="site-header" id="site-header">
        <div className="container header-inner">
          <Link href="#beranda" className="brand-link" aria-label="Beranda UTERA">
            <div className="brand-badge">U</div>
            <div className="brand-info">
              <span className="brand-title">UTERA</span>
              <span className="brand-subtitle">Aplikasi Finansial UMKM</span>
            </div>
          </Link>

          <nav aria-label="Navigasi Utama">
            <ul className="header-nav">
              <li><Link href="#beranda">Beranda</Link></li>
              <li><Link href="/buku-kas">Buku Kas</Link></li>
              <li><Link href="/skor-kelayakan">Skor Kelayakan</Link></li>
              <li><Link href="/guardrail">Guardrail 30%</Link></li>
              <li><Link href="/simulasi-kur">Simulasi KUR</Link></li>
              <li><Link href="/profil-usaha">Profil Usaha</Link></li>
              <li><Link href="/dashboard" className="nav-highlight-link">Dashboard</Link></li>
            </ul>
          </nav>

          <div className="header-actions">
            <Link href="/auth?mode=login" className="header-login-link">Masuk</Link>
            <Link href="/auth?mode=register" className="btn btn-primary btn-sm btn-pill">Coba Gratis</Link>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="hero-section" id="beranda">
        <div className="container hero-grid">
          <div className="hero-content">
            <div className="hero-eyebrow">PLATFORM FINANSIAL UMKM TERPADU</div>
            <h1 className="heading-hero">
              Satu Sistem Finansial untuk Semua Kebutuhan Bisnis.
            </h1>
            <p className="text-lead">
              Kelola pembukuan kas warung harian, pantau skor kelayakan kredit secara real-time, dan persiapkan pengajuan KUR serta pinjaman koperasi dengan kepastian angka yang dapat dipercaya perbankan.
            </p>
            <div className="hero-cta-group">
              <Link href="/auth?mode=register" className="btn btn-primary btn-pill">
                <span>Mulai Gratis Sekarang</span>
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>arrow_forward</span>
              </Link>
              <Link href="/dashboard?demo=true" className="btn btn-secondary btn-pill">
                Coba Mode Demo Tamu
              </Link>
            </div>
          </div>

          <div className="hero-mockup-wrap">
            <div className="hero-device-frame">
              <div className="device-header">
                <div className="device-title">
                  <span className="device-dot"></span>
                  <strong>Backoffice Kas Warung UTERA</strong>
                </div>
                <span className="device-date-chip">Hari ini • Real-time Sync</span>
              </div>

              <div className="mockup-metrics-grid">
                <div className="mockup-metric-card">
                  <small>Total Pemasukan</small>
                  <div className="amount income tabular-nums">+ Rp 24.850.000</div>
                </div>
                <div className="mockup-metric-card">
                  <small>Laba Bersih Kas</small>
                  <div className="amount tabular-nums">Rp 18.450.000</div>
                </div>
              </div>

              <div className="mockup-ledger-preview">
                <div className="mockup-ledger-header">
                  <span>Transaksi Terkini</span>
                  <span style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600 }}>Cloud PostgreSQL</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-row-desc">Penjualan Paket Kopi & Toast</span>
                  <span className="mockup-row-amount plus tabular-nums">+ Rp 1.800.000</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-row-desc">Beli Susu & Biji Kopi</span>
                  <span className="mockup-row-amount minus tabular-nums">- Rp 650.000</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-row-desc">Pesanan Katering Kopi 50 Cup</span>
                  <span className="mockup-row-amount plus tabular-nums">+ Rp 2.800.000</span>
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--primary-soft)', border: '1px solid var(--primary-border)', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Status Arus Kas: SEHAT (Skor 84)</span>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Cicilan Maks. 30%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CREDIBILITY & STATS BAR */}
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
            <div className="stat-label">Panduan Legalitas NIB OSS-RBA & Dokumen Bank</div>
          </div>
        </div>
      </section>

      {/* 4. VALUE PROPOSITION: FEATURE SECTION */}
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
            <div className="feature-box">
              <div>
                <div className="feature-icon-container" aria-hidden="true">
                  <span className="material-symbols-rounded">receipt_long</span>
                </div>
                <h3>Buku Kas Warung Real-Time</h3>
                <p>
                  Catat pemasukan dan pengeluaran harian dalam hitungan detik. Tanpa istilah akuntansi rumit, saldo laba bersih kas operasional langsung diperbarui otomatis.
                </p>
              </div>
              <Link href="/buku-kas" className="feature-link">
                <span>Buka Buku Kas Warung</span>
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>chevron_right</span>
              </Link>
            </div>

            <div className="feature-box">
              <div>
                <div className="feature-icon-container" aria-hidden="true">
                  <span className="material-symbols-rounded">verified</span>
                </div>
                <h3>Engine Skor Kelayakan (0–100)</h3>
                <p>
                  Algoritma otomatis berbasis formula PRD resmi. Menguji 4 parameter objektif: konsistensi pencatatan, pertumbuhan omzet, margin laba, dan stabilitas kas.
                </p>
              </div>
              <Link href="/skor-kelayakan" className="feature-link">
                <span>Buka Skor Kelayakan</span>
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>chevron_right</span>
              </Link>
            </div>

            <div className="feature-box">
              <div>
                <div className="feature-icon-container" aria-hidden="true">
                  <span className="material-symbols-rounded">shield</span>
                </div>
                <h3>Simulasi Guardrail Batas 30% Kas</h3>
                <p>
                  Cegah jeratan cicilan yang mengancam likuiditas usaha. Sistem memvalidasi ketat agar total angsuran bulanan tidak melampaui 30% dari rata-rata laba kas riil.
                </p>
              </div>
              <Link href="/guardrail" className="feature-link">
                <span>Uji Guardrail 30% Kas</span>
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>chevron_right</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 5. KUR TIERS & PLAFON */}
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
            <div className="kur-tier-card">
              <div>
                <span className="tier-category">Tahap Rintisan</span>
                <h3 className="tier-name">KUR Super Mikro</h3>
                <div className="tier-plafon tabular-nums">s.d Rp 10 Juta</div>
                <p style={{ fontSize: '0.92rem', color: 'var(--neutral-600)', lineHeight: 1.55 }}>
                  Cocok untuk tambahan modal awal dan pengadaan peralatan kerja bagi usaha mikro yang baru berjalan.
                </p>
                <ul className="tier-checklist">
                  <li><span>✓ Suku bunga bersubsidi 3% efektif per tahun</span></li>
                  <li><span>✓ Tanpa agunan fisik tambahan</span></li>
                  <li><span>✓ Cukup NIB atau SKU</span></li>
                  <li><span>✓ Tenor modal kerja hingga 36 bulan</span></li>
                </ul>
              </div>
              <Link href="/simulasi-kur" className="btn btn-secondary" style={{ width: '100%', marginTop: '16px' }}>
                Uji Syarat Super Mikro
              </Link>
            </div>

            <div className="kur-tier-card featured">
              <span className="featured-ribbon">Paling Direkomendasikan</span>
              <div>
                <span className="tier-category" style={{ color: 'var(--primary)' }}>Rekomendasi Utama</span>
                <h3 className="tier-name">KUR Mikro</h3>
                <div className="tier-plafon highlight tabular-nums">Rp 10 Juta – Rp 50 Juta</div>
                <p style={{ fontSize: '0.92rem', color: 'var(--neutral-600)', lineHeight: 1.55 }}>
                  Skema paling ideal bagi warung, katering, dan bengkel yang membutuhkan stok dan bahan baku reguler.
                </p>
                <ul className="tier-checklist">
                  <li><span>✓ Suku bunga bersubsidi 6% efektif per tahun</span></li>
                  <li><span>✓ Evaluasi pembukuan kas minimal 6 bulan</span></li>
                  <li><span>✓ Rekomendasi Skor Kelayakan UTERA: BAIK (≥ 70)</span></li>
                  <li><span>✓ Laporan keuangan siap bank langsung diekspor</span></li>
                </ul>
              </div>
              <Link href="/simulasi-kur" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }}>
                Uji Kelayakan KUR Mikro
              </Link>
            </div>

            <div className="kur-tier-card">
              <div>
                <span className="tier-category">Skala Ekspansi</span>
                <h3 className="tier-name">KUR Kecil</h3>
                <div className="tier-plafon tabular-nums">Rp 50 Juta – Rp 500 Juta</div>
                <p style={{ fontSize: '0.92rem', color: 'var(--neutral-600)', lineHeight: 1.55 }}>
                  Dikhususkan untuk usaha yang siap membuka cabang baru atau pengadaan armada logistik produksi.
                </p>
                <ul className="tier-checklist">
                  <li><span>✓ Suku bunga bersubsidi 6% s.d 9% efektif</span></li>
                  <li><span>✓ Wajib melampirkan NIB aktif dan NPWP usaha</span></li>
                  <li><span>✓ Agunan pokok sesuai ketentuan bank pelaksana</span></li>
                  <li><span>✓ Tenor investasi hingga 60 bulan (5 tahun)</span></li>
                </ul>
              </div>
              <Link href="/simulasi-kur" className="btn btn-secondary" style={{ width: '100%', marginTop: '16px' }}>
                Uji Syarat KUR Kecil
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#FFFFFF', borderTop: '1px solid var(--border-subtle)', padding: '48px 0', marginTop: '64px' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div className="brand-badge" style={{ width: '28px', height: '28px', fontSize: '14px' }}>U</div>
              <strong style={{ color: 'var(--primary)' }}>UTERA (UMKM Sejahtera)</strong>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Proyek Rekayasa Perangkat Lunak Kelompok 3 — Tata Kelola Finansial UMKM Berbasis Cloud.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '24px', fontSize: '0.875rem' }}>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/buku-kas">Buku Kas</Link>
            <Link href="/simulasi-kur">Simulasi KUR</Link>
            <Link href="/auth?mode=login">Masuk</Link>
          </div>
        </div>
      </footer>
    </>
  )
}
