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
  window.uteraSupabase = uteraSupabase;
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

// Sinkronisasi live status sidebar (badge transaksi, badge skor kelayakan, nama usaha) di seluruh halaman
function syncUteraSidebar() {
  try {
    // 1. Hitung total transaksi dari local storage
    var totalTx = 0;
    var rawKas = localStorage.getItem('utera.kas.transaksi.v1');
    var parsedKas = [];
    if (rawKas) {
      try {
        var p = JSON.parse(rawKas);
        if (Array.isArray(p)) {
          parsedKas = p;
          totalTx = p.length;
        }
      } catch (e) {}
    }

    var txBadges = document.querySelectorAll('#badge-total-tx, #sidebar-badge-tx, .nav-badge');
    txBadges.forEach(function (el) {
      // Hanya ganti jika ini adalah badge transaksi
      if (el.id === 'badge-total-tx' || el.id === 'sidebar-badge-tx' || el.closest('[data-page="transaksi"]')) {
        el.textContent = totalTx;
      }
    });

    // 2. Hitung dynamic score kelayakan
    var dynamicScore = 0;
    if (parsedKas.length > 0) {
      var inc = 0, exp = 0;
      parsedKas.forEach(function (t) {
        if (t.type === 'income') inc += t.amount;
        else exp += t.amount;
      });
      if (inc > 0) {
        var marginRatio = (inc - exp) / inc;
        dynamicScore = Math.min(96, Math.max(40, Math.round(50 + (marginRatio * 45))));
      } else {
        dynamicScore = 50;
      }
    }

    var skorBadges = document.querySelectorAll('#nav-pill-skor, #nav-skor-value, .nav-pill-good');
    skorBadges.forEach(function (el) {
      if (el.id === 'nav-pill-skor' || el.id === 'nav-skor-value' || el.closest('[data-page="skor"]')) {
        el.textContent = dynamicScore;
      }
    });

    // 3. Sinkronisasi nama bisnis & pemilik
    var bizName = localStorage.getItem('utera_nama_usaha');
    var userName = localStorage.getItem('utera_user_name');
    try {
      var profRaw = localStorage.getItem('utera_profil_usaha');
      if (profRaw) {
        var profs = JSON.parse(profRaw);
        if (Array.isArray(profs) && profs[0]) {
          if (profs[0].nama_usaha) bizName = profs[0].nama_usaha;
          if (profs[0].nama_pemilik) userName = profs[0].nama_pemilik;
        }
      }
    } catch (e) {}

    if (bizName) {
      document.querySelectorAll('#sidebar-business-name, .business-title').forEach(function (el) {
        el.textContent = bizName;
      });
    }

    if (userName) {
      document.querySelectorAll('#sidebar-user-name, .user-name-label').forEach(function (el) {
        el.textContent = userName;
      });
      var initials = userName.trim().split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
      document.querySelectorAll('#sidebar-initials, #sidebar-user-avatar, .user-avatar-circle').forEach(function (el) {
        el.textContent = initials || 'U';
      });
    }
  } catch (err) {
    console.warn('Sidebar sync notice:', err);
  }
}

if (typeof window !== 'undefined') {
  window.uteraSupabase = uteraSupabase;
  window.uteraLogout = uteraLogout;
  window.syncUteraSidebar = syncUteraSidebar;

  // Pasang listener otomatis pada semua tombol keluar dan jalankan sync sidebar
  document.addEventListener('DOMContentLoaded', function () {
    syncUteraSidebar();

    var logoutButtons = document.querySelectorAll('.btn-logout, #btn-logout, [data-action="logout"]');
    logoutButtons.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        uteraLogout('../auth/index.html?mode=login');
      });
    });
  });
}


