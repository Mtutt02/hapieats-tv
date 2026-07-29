import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const url = request.nextUrl

  // Redirect /profile/[username] to /u/[username]
  if (url.pathname.startsWith('/profile/')) {
    const username = url.pathname.replace('/profile/', '')
    if (username) {
      return NextResponse.redirect(new URL(`/u/${username}`, request.url))
    }
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image, favicon.ico
     * - Public files (images, etc.)
     * - API routes that need raw body (Mux/Stripe webhooks)
     */
    '/((?!_next/static|_next/image|favicon.ico|tv|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
