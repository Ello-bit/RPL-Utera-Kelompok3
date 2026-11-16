import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAdminUser, safeRedirect } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh auth session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isAuthRoute = path.startsWith('/auth')

  const isAdmin = isAdminUser(user)

  // 0. Rute admin: wajib login dan berperan admin (sebelumnya terbuka untuk siapa saja)
  if (path === '/admin' || path.startsWith('/admin/')) {
    const url = request.nextUrl.clone()
    if (!user) {
      url.pathname = '/auth'
      url.search = '?mode=login&redirect=/admin'
      return NextResponse.redirect(url)
    }
    if (!isAdmin) {
      url.pathname = '/dashboard'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  // 0b. Halaman aplikasi wajib login. Sebelumnya tamu masuk "mode demo" dengan akun contoh,
  //     sehingga terlihat seperti sudah punya akun. Sekarang tamu diminta masuk dulu, lalu
  //     dikembalikan ke halaman yang tadi ingin dibuka (parameter redirect).
  const PROTECTED = [
    '/dashboard', '/buku-kas', '/skor-kelayakan', '/guardrail', '/simulasi-kur',
    '/profil-usaha', '/legalitas', '/laporan-siap-bank',
  ]
  if (!user && PROTECTED.some((p) => path === p || path.startsWith(p + '/'))) {
    const url = request.nextUrl.clone()
    const target = path + request.nextUrl.search
    url.pathname = '/auth'
    url.search = `?mode=login&redirect=${encodeURIComponent(target)}`
    return NextResponse.redirect(url)
  }

  // 1. If already authenticated and trying to access /auth, redirect to their respective home
  if (user && isAuthRoute) {
    // Sudah login: langsung ke halaman tujuan (parameter redirect) atau beranda masing-masing
    const target = isAdmin ? '/admin' : safeRedirect(request.nextUrl.searchParams.get('redirect'))
    const url = new URL(target, request.url)
    return NextResponse.redirect(url)
  }

  // 2. If admin navigates to regular UMKM routes, redirect directly to supervisor tabs
  if (user && isAdmin) {
    const url = request.nextUrl.clone()
    if (path === '/dashboard') {
      url.pathname = '/admin'
      url.search = ''
      return NextResponse.redirect(url)
    }
    if (path === '/buku-kas') {
      url.pathname = '/admin'
      url.search = '?tab=kas'
      return NextResponse.redirect(url)
    }
    if (path === '/skor-kelayakan') {
      url.pathname = '/admin'
      url.search = '?tab=skor'
      return NextResponse.redirect(url)
    }
    if (path === '/profil-usaha') {
      url.pathname = '/admin'
      url.search = '?tab=direktori'
      return NextResponse.redirect(url)
    }
    if (path === '/guardrail' || path === '/simulasi-kur') {
      url.pathname = '/admin'
      url.search = '?tab=kur'
      return NextResponse.redirect(url)
    }
    // Halaman milik pemilik usaha. Admin bisa membaca semua profil, sehingga halaman ini
    // akan menampilkan laporan/dokumen usaha orang lain secara acak. Arahkan ke direktori.
    if (path === '/laporan-siap-bank' || path === '/legalitas') {
      url.pathname = '/admin'
      url.search = '?tab=direktori'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

