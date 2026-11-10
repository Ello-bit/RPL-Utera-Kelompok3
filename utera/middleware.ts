import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAdminUser } from '@/lib/auth'

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

  // 1. If already authenticated and trying to access /auth, redirect to their respective home
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = isAdmin ? '/admin' : '/dashboard'
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
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

