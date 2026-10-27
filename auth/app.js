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
  const btnSubmit = document.getElementById('btn-submit');
  const cbLabel = document.getElementById('cb-label');
  const formTerms = document.getElementById('form-terms');
  const footerSwitchPrompt = document.getElementById('footer-switch-prompt');
  const btnSwitchAction = document.getElementById('btn-switch-action');
  const btnTabRegister = document.getElementById('btn-tab-register');
  const btnTabLogin = document.getElementById('btn-tab-login');
  const authForm = document.getElementById('auth-form');

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
      
      // Expand fullname group
      groupFullname.classList.remove('collapsed');
      inputFullname.setAttribute('required', 'required');

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
      
      // Collapse fullname group
      groupFullname.classList.add('collapsed');
      inputFullname.removeAttribute('required');

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

  // Password Visibility Toggle
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

  // Form Submit Demonstration
  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('input-email').value;
      const actionText = isRegisterMode ? 'Pendaftaran Akun Berhasil!' : 'Berhasil Masuk!';
      alert(`${actionText}\nSelamat datang di UTERA Finansial, ${email}. Anda akan diarahkan ke dasbor.`);
      window.location.href = '../dashboard/';
    });
  }
});
