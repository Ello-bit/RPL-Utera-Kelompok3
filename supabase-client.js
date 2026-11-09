/**
 * UTERA — Supabase Client Configuration
 * Single source of truth for Supabase cloud database connection.
 */

const SUPABASE_URL = 'https://tpgynjvtarxqubkvfqdl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YCbmH9VIra8CiQH0ER-cuQ_Q-YpceMJ';

// Inisialisasi Supabase client jika SDK library sudah dimuat
let uteraSupabase = null;

if (typeof window !== 'undefined' && window.supabase) {
  uteraSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('✅ UTERA Supabase Client berhasil terhubung.');
} else {
  console.warn('⚠️ Supabase JS SDK belum dimuat. Pastikan menyertakan tag script CDN Supabase.');
}

// Helper logout universal untuk seluruh modul UTERA
async function uteraLogout(redirectUrl) {
  var targetUrl = redirectUrl || '../landing-page/index.html';
  if (!confirm('Apakah Anda yakin ingin keluar dari akun UTERA?')) {
    return false;
  }
  try {
    if (uteraSupabase && uteraSupabase.auth) {
      await uteraSupabase.auth.signOut();
    }
  } catch (err) {
    console.warn('Supabase signOut error:', err);
  }
  try {
    localStorage.removeItem('utera_user_email');
    localStorage.removeItem('utera_user_name');
    localStorage.removeItem('utera_nama_usaha');
    localStorage.removeItem('utera_profil_usaha');
    localStorage.removeItem('utera.kas.transaksi.v1');
    localStorage.removeItem('utera_saved_guardrail');
    // Clear Supabase token storage keys
    var keysToRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && (k.indexOf('sb-') === 0 || k.indexOf('supabase.') === 0)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(function (k) { localStorage.removeItem(k); });
  } catch (e) {}

  alert('Anda telah berhasil keluar (logout).');
  window.location.href = targetUrl;
  return true;
}

if (typeof window !== 'undefined') {
  window.uteraLogout = uteraLogout;
  // Pasang listener otomatis pada semua tombol keluar di seluruh halaman
  document.addEventListener('DOMContentLoaded', function () {
    var logoutButtons = document.querySelectorAll('.btn-logout, #btn-logout, [data-action="logout"]');
    logoutButtons.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        uteraLogout('../auth/index.html?mode=login');
      });
    });
  });
}


