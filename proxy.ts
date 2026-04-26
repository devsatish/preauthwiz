import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { findPersona } from '@/lib/auth/personas';

// Next 16 renamed `middleware.ts` -> `proxy.ts`. Same idea: gate everything but
// the login routes behind a session cookie. We don't sign or encrypt the cookie
// because this is a demo with hardcoded personas — the cookie value is just a
// persona id and there's no real account to compromise.

export function proxy(request: NextRequest) {
  const persona = findPersona(request.cookies.get(SESSION_COOKIE)?.value);

  if (!persona) {
    const loginUrl = new URL('/login', request.url);
    // Preserve where the user was trying to go so we can redirect them back.
    if (request.nextUrl.pathname !== '/') {
      loginUrl.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on every page route except: the login page itself, the auth API routes,
  // Next internals, and static assets.
  matcher: [
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};
