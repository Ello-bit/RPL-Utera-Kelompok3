/**
 * UTERA Authentication Module (Login & Create Account)
 * Dynamic mode switching, password toggle, and interactive tabs
 */

document.addEventListener('DOMContentLoaded', () => {
  let isRegisterMode = true;

  // DOM Elements
  const authTitle = document.getElementById('auth-title');
  const authSubtitle = document.getElementById('auth-subtitle');
  const groupFullname = document.getElementById('group-fullname');
  const inputFullname = document.getElementById('input-fullname');
  const groupConfirmPassword = document.getElementById('group-confirm-password');
  const inputConfirmPassword = document.getElementById('input-password-confirm');
  const passwordMatchHint = document.getElementById('password-match-hint');
  const btnSubmit = document.getElementById('btn-submit');
  const cbLabel = document.getElementById('cb-label');
  const formTerms = document.getElementById('form-terms');
  const footerSwitchPrompt = document.getElementById('footer-switch-prompt');
  const btnSwitchAction = document.getElementById('btn-switch-action');
  const btnTabRegister = document.getElementById('btn-tab-register');
  const btnTabLogin = document.getElementById('btn-tab-login');
  const authForm = document.getElementById('auth-form');

  // Verification Modal Elements
  const verifyModal = document.getElementById('verify-modal');
  const verifyModalTitle = document.getElementById('verify-modal-title');
  const verifyModalDesc = document.getElementById('verify-modal-desc');
  const verifyEmailTarget = document.getElementById('verify-email-target');
  const otpDisplayCode = document.getElementById('otp-display-code');
  const btnCopyOtp = document.getElementById('btn-copy-otp');
  const otpDigits = document.querySelectorAll('.otp-digit');
  const btnResendOtp = document.getElementById('btn-resend-otp');
  const otpCountdown = document.getElementById('otp-countdown');
  const btnCancelVerify = document.getElementById('btn-cancel-verify');
  const btnConfirmVerify = document.getElementById('btn-confirm-verify');

  let currentOtp = '';
  let countdownTimer = null;
  let pendingAuthData = null;

  // Check URL query parameter ?mode=login or ?mode=register
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mode') === 'login') {
    setMode(false, false);
  } else {
    setMode(true, false);
  }

  function setMode(register, updateHistory = true) {
    isRegisterMode = register;

    if (updateHistory) {
      const newUrl = window.location.pathname + (isRegisterMode ? '?mode=register' : '?mode=login');
      window.history.replaceState(null, '', newUrl);
    }

    if (isRegisterMode) {
      // Switch to REGISTER Mode
      document.title = 'Daftar Akun Baru - UTERA Finansial UMKM';
      btnTabRegister.classList.add('active');
      btnTabRegister.setAttribute('aria-selected', 'true');
      btnTabLogin.classList.remove('active');
      btnTabLogin.setAttribute('aria-selected', 'false');

      authTitle.textContent = 'Create an Account';
      authSubtitle.textContent = 'Hanya butuh beberapa saat untuk memulai pembukuan usaha Anda.';
      
      // Expand fullname & confirm password group
      groupFullname?.classList.remove('collapsed');
      inputFullname?.setAttribute('required', 'required');

      groupConfirmPassword?.classList.remove('collapsed');
      inputConfirmPassword?.setAttribute('required', 'required');

      cbLabel.textContent = 'Kirimkan tips keuangan usaha, update regulasi KUR & penawaran modal';
      formTerms.style.display = 'block';
      btnSubmit.textContent = 'Daftar Akun Baru';
      
      footerSwitchPrompt.textContent = 'Sudah punya akun?';
      btnSwitchAction.textContent = 'Masuk ke Akun';
    } else {
      // Switch to LOGIN Mode
      document.title = 'Masuk ke Akun - UTERA Finansial UMKM';
      btnTabLogin.classList.add('active');
      btnTabLogin.setAttribute('aria-selected', 'true');
      btnTabRegister.classList.remove('active');
      btnTabRegister.setAttribute('aria-selected', 'false');

      authTitle.textContent = 'Welcome Back';
      authSubtitle.textContent = 'Masuk untuk melanjutkan pembukuan dan memantau skor kelayakan usaha Anda.';
      
      // Collapse fullname & confirm password group
      groupFullname?.classList.add('collapsed');
      inputFullname?.removeAttribute('required');

      groupConfirmPassword?.classList.add('collapsed');
      inputConfirmPassword?.removeAttribute('required');
      if (passwordMatchHint) passwordMatchHint.style.display = 'none';

      cbLabel.textContent = 'Ingat saya di perangkat ini (Simpan sesi)';
      formTerms.style.display = 'none';
      btnSubmit.textContent = 'Masuk Sekarang';

      footerSwitchPrompt.textContent = 'Belum punya akun?';
      btnSwitchAction.textContent = 'Daftar Akun Baru';
    }
  }

  // Event listeners for tabs
  if (btnTabRegister) {
    btnTabRegister.addEventListener('click', () => setMode(true));
  }
  if (btnTabLogin) {
    btnTabLogin.addEventListener('click', () => setMode(false));
  }

  // Event listener for bottom switch button
  if (btnSwitchAction) {
    btnSwitchAction.addEventListener('click', () => {
      setMode(!isRegisterMode);
    });
  }

  // Password Visibility Toggle for Main Password
  const btnTogglePw = document.getElementById('btn-toggle-pw');
  const inputPassword = document.getElementById('input-password');
  let showPassword = false;

  if (btnTogglePw && inputPassword) {
    btnTogglePw.addEventListener('click', () => {
      showPassword = !showPassword;
      inputPassword.type = showPassword ? 'text' : 'password';
      btnTogglePw.innerHTML = showPassword 
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F6B4F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    });
  }

  // Password Visibility Toggle for Confirm Password
  const btnToggleConfirmPw = document.getElementById('btn-toggle-confirm-pw');
  let showConfirmPw = false;

  if (btnToggleConfirmPw && inputConfirmPassword) {
    btnToggleConfirmPw.addEventListener('click', () => {
      showConfirmPw = !showConfirmPw;
      inputConfirmPassword.type = showConfirmPw ? 'text' : 'password';
      btnToggleConfirmPw.innerHTML = showConfirmPw
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F6B4F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    });
  }

  // Real-time Confirm Password Matching Indicator
  function checkPasswordMatch() {
    if (!isRegisterMode || !inputConfirmPassword) return;
    const p1 = inputPassword ? inputPassword.value : '';
    const p2 = inputConfirmPassword.value;

    if (!p2) {
      if (passwordMatchHint) passwordMatchHint.style.display = 'none';
      return;
    }

    if (passwordMatchHint) {
      passwordMatchHint.style.display = 'block';
      if (p1 === p2) {
        passwordMatchHint.textContent = '✓ Kata sandi cocok';
        passwordMatchHint.className = 'input-hint valid';
      } else {
        passwordMatchHint.textContent = '⚠️ Kata sandi belum cocok';
        passwordMatchHint.className = 'input-hint invalid';
      }
    }
  }

  if (inputPassword) inputPassword.addEventListener('input', checkPasswordMatch);
  if (inputConfirmPassword) inputConfirmPassword.addEventListener('input', checkPasswordMatch);

  // Left panel card tabs interaction
  const tabKas = document.getElementById('tab-kas');
  const tabSkor = document.getElementById('tab-skor');
  const featureDesc = document.getElementById('feature-desc');

  if (tabKas && tabSkor && featureDesc) {
    tabKas.addEventListener('click', () => {
      tabKas.classList.add('active');
      tabSkor.classList.remove('active');
      featureDesc.textContent = 'Satu sumber data transaksi yang otomatis terhubung ke perhitungan margin laba, guardrail batas kas 30%, dan berkas siap kredit bank.';
    });

    tabSkor.addEventListener('click', () => {
      tabSkor.classList.add('active');
      tabKas.classList.remove('active');
      featureDesc.textContent = 'Engine analitik otomatis menguji 4 parameter kelayakan finansial: konsistensi pencatatan, pertumbuhan omzet, laba kas, dan stabilitas cadangan modal.';
    });
  }

  // --- OTP Verification Logic ---
  function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  function startOtpCountdown(seconds = 45) {
    if (countdownTimer) clearInterval(countdownTimer);
    let rem = seconds;
    if (btnResendOtp) btnResendOtp.disabled = true;
    if (otpCountdown) otpCountdown.textContent = rem;

    countdownTimer = setInterval(() => {
      rem--;
      if (otpCountdown) otpCountdown.textContent = rem;
      if (rem <= 0) {
        clearInterval(countdownTimer);
        if (btnResendOtp) {
          btnResendOtp.disabled = false;
          btnResendOtp.innerHTML = 'Kirim Ulang Sekarang';
        }
      }
    }, 1000);
  }

  function openVerificationModal(email, isRegister) {
    currentOtp = generateOtp();
    if (verifyModalTitle) {
      verifyModalTitle.textContent = isRegister ? 'Verifikasi Pendaftaran Akun' : 'Verifikasi Keamanan Login (2FA)';
    }
    if (verifyModalDesc) {
      verifyModalDesc.innerHTML = `Masukkan 6 digit kode keamanan yang dikirimkan ke <strong>${email}</strong> untuk ${isRegister ? 'mengaktifkan akun' : 'masuk ke dashboard'}.`;
    }
    if (otpDisplayCode) otpDisplayCode.textContent = currentOtp;
    if (verifyEmailTarget) verifyEmailTarget.textContent = email;

    otpDigits.forEach(d => { d.value = ''; });
    if (verifyModal) verifyModal.style.display = 'flex';

    startOtpCountdown(45);
    setTimeout(() => { if (otpDigits[0]) otpDigits[0].focus(); }, 100);
  }

  function closeVerificationModal() {
    if (verifyModal) verifyModal.style.display = 'none';
    if (countdownTimer) clearInterval(countdownTimer);
    const submitBtn = document.getElementById('btn-submit');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = isRegisterMode ? 'Daftar Akun Baru' : 'Masuk Sekarang';
    }
  }

  // Digit auto-advance and paste handling
  otpDigits.forEach((digit, idx) => {
    digit.addEventListener('input', (e) => {
      const val = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = val ? val[0] : '';
      if (e.target.value && idx < otpDigits.length - 1) {
        otpDigits[idx + 1].focus();
      }
    });

    digit.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !digit.value && idx > 0) {
        otpDigits[idx - 1].focus();
      }
    });

    digit.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
      if (pasted.length >= 6) {
        for (let i = 0; i < 6; i++) {
          if (otpDigits[i]) otpDigits[i].value = pasted[i];
        }
        if (otpDigits[5]) otpDigits[5].focus();
      }
    });
  });

  // Tombol Isi Otomatis OTP
  if (btnCopyOtp) {
    btnCopyOtp.addEventListener('click', () => {
      if (!currentOtp) return;
      for (let i = 0; i < currentOtp.length; i++) {
        if (otpDigits[i]) otpDigits[i].value = currentOtp[i];
      }
      if (otpDigits[5]) otpDigits[5].focus();
    });
  }

  // Tombol Kirim Ulang OTP
  if (btnResendOtp) {
    btnResendOtp.addEventListener('click', () => {
      if (btnResendOtp.disabled) return;
      currentOtp = generateOtp();
      if (otpDisplayCode) otpDisplayCode.textContent = currentOtp;
      otpDigits.forEach(d => { d.value = ''; });
      startOtpCountdown(45);
      if (otpDigits[0]) otpDigits[0].focus();
      alert(`Kode keamanan baru Anda: ${currentOtp}`);
    });
  }

  if (btnCancelVerify) {
    btnCancelVerify.addEventListener('click', closeVerificationModal);
  }

  // Eksekusi Pendaftaran atau Login setelah OTP terverifikasi
  async function finalizeAuth(authData) {
    const { email, password, fullname, namaPemilik, namaUsaha, isRegister } = authData;

    try {
      if (window.uteraSupabase) {
        if (isRegister) {
          // Supabase Sign Up
          const { data, error } = await window.uteraSupabase.auth.signUp({
            email: email,
            password: password,
            options: {
              data: {
                full_name: fullname,
                business_name: namaUsaha,
                owner_name: namaPemilik
              }
            }
          });

          if (error) throw error;

          // Buat record profil_usaha awal di database Supabase
          await window.uteraSupabase.from('profil_usaha').insert([{
            nama_usaha: namaUsaha,
            nama_pemilik: namaPemilik,
            jenis_usaha: 'kuliner',
            tanggal_mulai_usaha: new Date().toISOString().split('T')[0]
          }]);

          // Untuk akun baru yang baru didaftarkan, mulai pembukuan kas baru (kosongkan transaksi demo)
          localStorage.setItem('utera.kas.transaksi.v1', JSON.stringify([]));

          alert(`Pendaftaran & Verifikasi Berhasil!\nSelamat datang di UTERA Finansial, ${namaPemilik} (${namaUsaha}). Akun Anda telah aktif dan terverifikasi di Supabase Cloud.`);
        } else {
          // Supabase Sign In
          const { data, error } = await window.uteraSupabase.auth.signInWithPassword({
            email: email,
            password: password
          });

          if (error) throw error;
          alert(`Verifikasi Login Berhasil!\nSelamat datang kembali, ${email}.`);
        }
      } else {
        // Fallback lokal jika offline
        if (isRegister) {
          localStorage.setItem('utera.kas.transaksi.v1', JSON.stringify([]));
        }
        alert(`${isRegister ? 'Pendaftaran & Verifikasi Berhasil!' : 'Verifikasi Login Berhasil!'}\nSelamat datang di UTERA Finansial, ${namaPemilik || email}.`);
      }

      // Simpan data identitas profil aktif ke localStorage
      const initialProfile = {
        id: 'p_' + Date.now().toString(36),
        nama_usaha: namaUsaha,
        nama_pemilik: namaPemilik,
        jenis_usaha: 'kuliner',
        tanggal_mulai_usaha: new Date().toISOString().split('T')[0],
        alamat_usaha: '',
        nomor_telepon: '',
        deskripsi_usaha: '',
        nib: { punya: false, nomor: '' },
        npwp: { punya: false, nomor: '' },
        sku: { punya: false, nomor: '' }
      };
      localStorage.setItem('utera_profil_usaha', JSON.stringify([initialProfile]));
      localStorage.setItem('utera_user_email', email);
      localStorage.setItem('utera_nama_usaha', namaUsaha);
      localStorage.setItem('utera_user_name', namaPemilik);
      window.location.href = '../dashboard/';
    } catch (err) {
      alert('Gagal: ' + (err.message || 'Terjadi kesalahan saat memproses otentikasi.'));
      closeVerificationModal();
    }
  }

  // Tombol Verifikasi & Lanjutkan di Modal
  if (btnConfirmVerify) {
    btnConfirmVerify.addEventListener('click', async () => {
      const enteredCode = Array.from(otpDigits).map(d => d.value.trim()).join('');

      if (enteredCode.length < 6) {
        alert('Mohon masukkan lengkap 6 digit kode keamanan Anda.');
        return;
      }

      if (enteredCode !== currentOtp) {
        alert('Kode verifikasi tidak sesuai. Silakan periksa kembali 6 digit kode keamanan Anda.');
        otpDigits.forEach(d => { d.value = ''; });
        if (otpDigits[0]) otpDigits[0].focus();
        return;
      }

      btnConfirmVerify.disabled = true;
      btnConfirmVerify.textContent = 'Memverifikasi...';

      if (pendingAuthData) {
        await finalizeAuth(pendingAuthData);
      }
    });
  }

  // Form Submit Handler: Validasi & Buka Modal Verifikasi
  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('input-email').value.trim();
      const password = document.getElementById('input-password').value;
      const fullname = document.getElementById('input-fullname') ? document.getElementById('input-fullname').value.trim() : '';
      const confirmPw = inputConfirmPassword ? inputConfirmPassword.value : '';
      const submitBtn = document.getElementById('btn-submit');

      // Validasi Registrasi
      if (isRegisterMode) {
        if (!fullname) {
          alert('Mohon isi nama lengkap dan nama usaha Anda.');
          if (inputFullname) inputFullname.focus();
          return;
        }
        if (password.length < 6) {
          alert('Kata sandi minimal terdiri dari 6 karakter.');
          if (inputPassword) inputPassword.focus();
          return;
        }
        if (password !== confirmPw) {
          alert('Kata sandi dan Konfirmasi Kata Sandi tidak cocok. Mohon samakan kedua kata sandi.');
          if (inputConfirmPassword) inputConfirmPassword.focus();
          return;
        }
      }

      let namaPemilik = '';
      let namaUsaha = '';
      if (fullname.includes('-')) {
        const parts = fullname.split('-');
        namaPemilik = parts[0].trim();
        namaUsaha = parts.slice(1).join('-').trim();
      } else if (fullname) {
        namaPemilik = fullname;
        namaUsaha = fullname;
      } else {
        namaPemilik = email.split('@')[0];
        namaUsaha = 'Usaha ' + namaPemilik;
      }

      // Siapkan data otentikasi yang menunggu verifikasi kode keamanan
      pendingAuthData = {
        email,
        password,
        fullname,
        namaPemilik,
        namaUsaha,
        isRegister: isRegisterMode
      };

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Menyiapkan Verifikasi...';
      }

      // Buka modal verifikasi kode keamanan
      openVerificationModal(email, isRegisterMode);
    });
  }
});
