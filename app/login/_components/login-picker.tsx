'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Persona } from '@/lib/auth/personas';

interface LoginPickerProps {
  personas: Persona[];
  next: string;
}

export function LoginPicker({ personas, next }: LoginPickerProps) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(personaId: string) {
    if (pending) return;
    setPending(personaId);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId }),
      });
      if (!res.ok) {
        setError('Sign in failed. Please try again.');
        setPending(null);
        return;
      }
      // Hard navigation so the proxy + layout pick up the new cookie.
      window.location.assign(next);
    } catch {
      setError('Network error. Please try again.');
      setPending(null);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {personas.map(p => {
          const isPending = pending === p.id;
          const disabled = pending !== null && !isPending;
          return (
            <button
              key={p.id}
              onClick={() => signIn(p.id)}
              disabled={disabled || isPending}
              className={cn(
                'group relative bg-white rounded-xl border border-slate-200 p-5 text-left transition-all',
                'hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:hover:border-slate-200',
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn('h-12 w-12 rounded-full flex items-center justify-center font-semibold text-base shrink-0', p.avatarClass)}>
                  {p.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 leading-tight">{p.fullName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{p.role}</p>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">{p.bio}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">Click to sign in</span>
                <span className="text-xs font-medium text-blue-600 group-hover:underline">
                  {isPending ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Signing in…
                    </span>
                  ) : (
                    <>Continue →</>
                  )}
                </span>
              </div>
              {/* Persona color stripe accent */}
              <span
                className={cn(
                  'absolute left-0 top-0 bottom-0 w-1 rounded-l-xl',
                  p.id === 'jamie' ? 'bg-blue-500' : 'bg-emerald-500',
                )}
              />
            </button>
          );
        })}
      </div>

      {error && (
        <p className="text-center text-xs text-rose-600 mt-4">{error}</p>
      )}

      {/* Compliance/auth note — soft, demo-friendly */}
      <div className="mt-6 bg-white/60 backdrop-blur-sm border border-slate-200 rounded-lg p-4 text-xs text-slate-600">
        <p className="font-medium text-slate-700 mb-1">Single sign-on coming soon</p>
        <p>
          Production deployments use SSO via your hospital IDP (Okta, Azure AD, or Epic).
          Persona switching here lets reviewers preview the experience for different roles.
        </p>
      </div>
    </>
  );
}
