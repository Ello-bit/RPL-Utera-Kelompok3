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

// Helper untuk mengecek koneksi aktif
async function checkSupabaseConnection() {
  if (!uteraSupabase) {
    return { success: false, message: 'Supabase client belum diinisialisasi.' };
  }
  try {
    const { data, error } = await uteraSupabase.from('profil_usaha').select('id').limit(1);
    if (error) throw error;
    return { success: true, message: 'Koneksi database Supabase berhasil!' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

