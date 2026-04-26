import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { findPersona } from '@/lib/auth/personas';
import { SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth/session';

// Constant-time compare so we don't leak info via response timing.
// Both inputs are coerced to fixed-length buffers before comparing.
function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  // timingSafeEqual requires equal-length inputs, so pad the shorter one.
  // We always XOR-compare the lengths separately so an unequal length still
  // takes the same path.
  const len = Math.max(aBuf.length, bBuf.length, 1);
  const aPad = Buffer.alloc(len);
  const bPad = Buffer.alloc(len);
  aBuf.copy(aPad);
  bBuf.copy(bPad);
  return timingSafeEqual(aPad, bPad) && aBuf.length === bBuf.length;
}

export async function POST(request: Request) {
  let personaId: string | undefined;
  let password: string | undefined;
  try {
    const body = (await request.json()) as { personaId?: string; password?: string };
    personaId = body.personaId;
    password = body.password;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  // The shared access password is the gate that keeps random visitors from
  // burning tokens on a public Vercel deployment. Set PAW_ACCESS_PASSWORD in
  // the environment (Vercel project settings + local .env.local).
  const expected = process.env.PAW_ACCESS_PASSWORD;
  if (!expected) {
    console.error('[auth] PAW_ACCESS_PASSWORD is not set — refusing all sign-ins');
    return NextResponse.json(
      { ok: false, error: 'server_misconfigured' },
      { status: 500 },
    );
  }

  if (!password || !safeEqual(password, expected)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_password' },
      { status: 401 },
    );
  }

  const persona = findPersona(personaId);
  if (!persona) {
    return NextResponse.json({ ok: false, error: 'unknown_persona' }, { status: 400 });
  }

  const isProd = process.env.NODE_ENV === 'production';
  const response = NextResponse.json({ ok: true, persona: { id: persona.id, fullName: persona.fullName } });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: persona.id,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
    secure: isProd,
  });
  return response;
}
