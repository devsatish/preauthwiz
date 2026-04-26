import { NextResponse } from 'next/server';
import { TOUR_SEEN_COOKIE, SESSION_MAX_AGE } from '@/lib/auth/session';

// Marks the product tour as dismissed so the dialog stops auto-opening on every
// fresh sign-in. The "Take a tour" button in the side nav still opens it on demand.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: TOUR_SEEN_COOKIE,
    value: '1',
    httpOnly: false, // readable by client-side tour code if needed
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
