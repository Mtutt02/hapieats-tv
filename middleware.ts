import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const url = request.nextUrl

  // Redirect /profile/[username] to /u/[username]
  if (url.pathname.startsWith('/profile/')) {
    const username = url.pathname.replace('/profile/', '')
    if (username) {
      return NextResponse.redirect(new URL(`/u/${username}`, request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/profile/:path*',
}
