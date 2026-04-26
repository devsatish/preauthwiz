import { NextResponse } from 'next/server';
import { findPersona } from '@/lib/auth/personas';
import { SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth/session';

export async function POST(request: Request) {
  let personaId: string | undefined;
  try {
    const body = (await request.json()) as { personaId?: string };
    personaId = body.personaId;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const persona = findPersona(personaId);
  if (!persona) {
    return NextResponse.json({ ok: false, error: 'unknown_persona' }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, persona: { id: persona.id, fullName: persona.fullName } });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: persona.id,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
