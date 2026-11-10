'use client'

import { useState, useTransition, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import './auth.css'

function AuthContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultMode = searchParams.get('mode') === 'login' ? 'login' : 'register'
  const redirectTarget = searchParams.get('redirect') || '/dashboard'

  const [mode, setMode] = useState<'register' | 'login'>(defaultMode)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [activeVisualTab, setActiveVisualTab] = useState<'kas' | 'skor'>('kas')
  
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (searchParams.get('mode') === 'login') {
      setMode('login')
    }
  }, [searchParams])

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setErrorMessage('Konfirmasi kata sandi tidak cocok. Silakan periksa kembali.')
        return
      }
      if (password.length < 6) {
        setErrorMessage('Kata sandi minimal 6 karakter.')
        return
      }

      startTransition(async () => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        })

        if (error) {
          if (error.message.toLowerCase().includes('rate limit')) {
            setErrorMessage(
              'Batas pengiriman email verifikasi gratis Supabase tercapai (maksimal 3-4 email/jam). Solusi: Matikan opsi "Confirm email" di Supabase Dashboard (Authentication > Providers > Email).'
            )
          } else if (error.message.toLowerCase().includes('signups are disabled')) {
            setErrorMessage(
              'Pendaftaran akun email dinonaktifkan di Supabase. Solusi: Di Supabase Dashboard (Authentication > Sign In / Providers > Email), aktifkan kembali toggle "Allow new users to sign up".'
            )
          } else {
            setErrorMessage(error.message)
          }
          return
        }

        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setErrorMessage('Email ini sudah terdaftar. Silakan beralih ke mode Masuk.')
          return
        }

        if (data.session) {
          setSuccessMessage('Pendaftaran berhasil! Anda langsung masuk ke dashboard...')
          router.push(redirectTarget)
          router.refresh()
          return
        }

        setSuccessMessage(
          'Pendaftaran berhasil! Tautan konfirmasi telah dikirim ke email Anda. Silakan verifikasi untuk mulai menggunakan UTERA.'
        )
      })
    } else {
      startTransition(async () => {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          setErrorMessage('Email atau kata sandi tidak valid. Periksa kembali akun Anda.')
          return
        }

        router.push(redirectTarget)
        router.refresh()
      })
    }
  }

  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword

  return (
    <div className="auth-viewport-wrapper">
      <div className="auth-viewport">
        <div className="auth-card">
        {/* LEFT PANEL: Branded Visual Graphic Panel */}
        <div className="auth-visual-panel">
          <div className="auth-halftone-bg" aria-hidden="true"></div>

          <div className="auth-brand-row">
            <Link href="/" className="auth-brand" aria-label="Kembali ke Beranda UTERA">
              <div className="auth-wave-icon" aria-hidden="true">
                <span></span><span></span><span></span><span></span><span></span>
              </div>
              <span className="auth-brand-name">UTERA FINANSIAL</span>
            </Link>
          </div>

          <div className="floating-top-badge" aria-hidden="true">
            <div className="badge-squircle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1F6B4F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
            <div className="badge-dash"></div>
          </div>

          <div className="floating-feature-card">
            <div className="feature-card-tabs" role="tablist">
              <button
                type="button"
                className={`feature-tab ${activeVisualTab === 'kas' ? 'active' : ''}`}
                onClick={() => setActiveVisualTab('kas')}
              >
                <span>Buku Kas Digital</span>
              </button>
              <button
                type="button"
                className={`feature-tab ${activeVisualTab === 'skor' ? 'active' : ''}`}
                onClick={() => setActiveVisualTab('skor')}
              >
                <span>Skor Kelayakan</span>
              </button>
            </div>

            <p className="feature-card-desc">
              {activeVisualTab === 'kas'
                ? 'Satu sumber data transaksi yang otomatis terhubung ke perhitungan margin laba, guardrail batas kas 30%, dan berkas siap kredit bank.'
                : 'Algoritma resmi PRD mengukur konsistensi pencatatan dan kestabilan kas untuk mempercepat pengajuan KUR Mikro hingga 100 juta.'}
            </p>

            <div className="feature-chips">
              <span className="chip-item highlight">🍽️ Kuliner</span>
              <span className="chip-item">🛒 Warung & Toko</span>
              <span className="chip-item">☕ Kedai Kopi</span>
              <span className="chip-item">✂️ Jasa</span>
            </div>
          </div>

          <div className="floating-bottom-badge" aria-hidden="true">
            <div className="badge-dash-blue"></div>
            <div className="badge-squircle-sm">A</div>
          </div>

          <h1 className="auth-visual-headline">
            Satu Langkah Menuju Kemandirian Finansial
          </h1>
        </div>

        {/* RIGHT PANEL: Form Panel */}
        <div className="auth-form-panel">
          <Link href="/" className="auth-back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Kembali ke Beranda</span>
          </Link>

          <div className="auth-mode-tabs" role="tablist" aria-label="Pilih Mode Akses">
            <button
              type="button"
              className={`mode-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => { setMode('register'); setErrorMessage(null); setSuccessMessage(null); }}
              role="tab"
              aria-selected={mode === 'register'}
            >
              Buat Akun
            </button>
            <button
              type="button"
              className={`mode-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setErrorMessage(null); setSuccessMessage(null); }}
              role="tab"
              aria-selected={mode === 'login'}
            >
              Masuk
            </button>
          </div>

          <div className="form-header">
            <h2 className="form-title">{mode === 'register' ? 'Daftar Akun Baru' : 'Selamat Datang Kembali'}</h2>
            <p className="form-subtitle">
              {mode === 'register'
                ? 'Hanya butuh beberapa saat untuk memulai pembukuan usaha Anda.'
                : 'Masuk ke dasbor pembukuan dan pantau kelayakan kredit usaha Anda.'}
            </p>
          </div>

          {errorMessage && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '12px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px' }}>
              ⚠️ {errorMessage}
            </div>
          )}

          {successMessage && (
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', padding: '12px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px' }}>
              ✅ {successMessage}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="form-group">
                <label htmlFor="input-fullname" className="form-label">Nama Lengkap / Usaha</label>
                <div className="input-wrap">
                  <input
                    type="text"
                    id="input-fullname"
                    className="form-input"
                    placeholder="contoh: Bryan - Kopi Nusantara"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="input-email" className="form-label">Email Usaha</label>
              <div className="input-wrap">
                <input
                  type="email"
                  id="input-email"
                  className="form-input"
                  placeholder="nama@usahaanda.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="input-password" className="form-label">Kata Sandi</label>
              <div className="input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="input-password"
                  className="form-input"
                  placeholder="••••••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-toggle-pw"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password"
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div className="form-group">
                <label htmlFor="input-password-confirm" className="form-label">Konfirmasi Kata Sandi</label>
                <div className="input-wrap">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="input-password-confirm"
                    className="form-input"
                    placeholder="••••••••••••"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-toggle-pw"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label="Toggle confirm password"
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                      {showConfirmPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                {confirmPassword.length > 0 && (
                  <small style={{ color: passwordsMatch ? '#10B981' : '#EF4444', fontSize: '0.75rem', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                    {passwordsMatch ? '✓ Kata sandi cocok' : '✗ Kata sandi belum cocok'}
                  </small>
                )}
              </div>
            )}

            <button type="submit" className="btn-submit" disabled={isPending}>
              {isPending
                ? 'Memproses...'
                : mode === 'register'
                ? 'Daftar Akun Baru'
                : 'Masuk ke Akun'}
            </button>
          </form>

          <p className="auth-footer-switch">
            <span>{mode === 'register' ? 'Sudah punya akun?' : 'Belum memiliki akun?'}</span>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'register' ? 'login' : 'register')
                setErrorMessage(null)
                setSuccessMessage(null)
              }}
            >
              {mode === 'register' ? 'Masuk ke Akun' : 'Daftar Sekarang'}
            </button>
          </p>
        </div>
      </div>
    </div>
  </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat halaman...</div>}>
      <AuthContent />
    </Suspense>
  )
}

