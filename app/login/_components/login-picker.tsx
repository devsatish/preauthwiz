'use client';

import { useState } from 'react';
import { Loader2, Lock, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Persona } from '@/lib/auth/personas';

interface LoginPickerProps {
  personas: Persona[];
  next: string;
}

export function LoginPicker({ personas, next }: LoginPickerProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(personaId: string) {
    if (pending) return;
    if (!password.trim()) {
      setError('Enter the access password to continue.');
      return;
    }
    setPending(personaId);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId, password }),
      });
      if (!res.ok) {
        let msg = 'Sign in failed. Please try again.';
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error === 'invalid_password') msg = 'Incorrect access password.';
          else if (body.error === 'server_misconfigured') msg = 'Server is missing PAW_ACCESS_PASSWORD. Contact the admin.';
          else if (body.error === 'unknown_persona') msg = 'Unknown persona.';
        } catch {
          // body wasn't JSON, fall back to default message
        }
        setError(msg);
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
      {/* Access password — gates the demo so random Vercel-link visitors can't drain tokens */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 shadow-sm">
        <label htmlFor="access-password" className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
          <Lock className="h-3.5 w-3.5" />
          Access password
        </label>
        <div className="relative">
          <input
            id="access-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              // Pressing Enter in the password field is ambiguous (which persona?),
              // so we only act on it after a persona has been clicked. Until then
              // we just suppress the form submit.
              if (e.key === 'Enter') e.preventDefault();
            }}
            placeholder="Enter the password shared by your team"
            autoComplete="current-password"
            autoFocus
            className="w-full pr-10 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowPassword(s => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Then choose a persona below to sign in.
        </p>
      </div>

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
        <div className="mt-4 bg-rose-50 border border-rose-200 rounded-md px-3 py-2.5 text-center">
          <p className="text-xs font-medium text-rose-700">{error}</p>
        </div>
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
