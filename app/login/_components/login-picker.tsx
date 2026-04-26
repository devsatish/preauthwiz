'use client';

import { useState } from 'react';
import { Loader2, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Persona, PersonaId } from '@/lib/auth/personas';

interface LoginPickerProps {
  personas: Persona[];
  next: string;
}

export function LoginPicker({ personas, next }: LoginPickerProps) {
  const [selected, setSelected] = useState<PersonaId | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = selected !== null && password.trim().length > 0 && !pending;

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSubmit) {
      if (!selected) setError('Pick a persona to sign in as.');
      else if (!password.trim()) setError('Enter the access password.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId: selected, password }),
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
        setPending(false);
        return;
      }
      window.location.assign(next);
    } catch {
      setError('Network error. Please try again.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Persona radio cards */}
      <div className="space-y-3">
        {personas.map(p => {
          const active = selected === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSelected(p.id);
                if (error) setError(null);
              }}
              className={cn(
                'w-full text-left bg-white border rounded-md px-4 py-3.5 transition-all relative',
                'focus:outline-none focus:ring-2 focus:ring-[#1F4F36]/40',
                active
                  ? 'border-[#1F4F36] ring-2 ring-[#1F4F36]/20'
                  : 'border-[#1F2A23]/20 hover:border-[#1F2A23]/40',
              )}
              aria-pressed={active}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#5C6259] font-semibold font-mono">
                    {p.loginNumber} / {p.loginCategory.toUpperCase()}
                  </p>
                  <p className="text-base font-semibold text-[#1F2A23] mt-1.5 leading-tight">
                    {p.fullName}
                  </p>
                  <p className="text-xs text-[#5C6259] mt-0.5">{p.role}</p>
                  <p className="text-[13px] text-[#3F4943] mt-2.5 leading-snug">
                    {p.loginTagline}
                  </p>
                  <p className="text-[11px] text-[#5C6259] mt-2.5 font-mono">
                    <span className="text-[#1F4F36]/60 mr-1">↳</span>
                    {p.loginTags.join(' · ')}
                  </p>
                </div>
                {/* Radio dot */}
                <div
                  className={cn(
                    'h-4 w-4 rounded-full border shrink-0 mt-1',
                    active
                      ? 'border-[#1F4F36] bg-[#1F4F36]'
                      : 'border-[#1F2A23]/30 bg-white',
                  )}
                  aria-hidden
                >
                  {active && (
                    <span className="block h-1.5 w-1.5 rounded-full bg-white mx-auto mt-[5px]" />
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Password */}
      <div>
        <label
          htmlFor="access-password"
          className="block text-[10px] uppercase tracking-[0.18em] text-[#5C6259] font-semibold font-mono mb-2"
        >
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
            placeholder="shared by your team"
            autoComplete="current-password"
            className={cn(
              'w-full bg-transparent border-0 border-b text-base text-[#1F2A23] placeholder:text-[#5C6259]/60 px-0 py-2 pr-14',
              'focus:outline-none focus:border-[#1F4F36]',
              'border-[#1F2A23]/30',
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword(s => !s)}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.16em] text-[#5C6259] hover:text-[#1F4F36] font-mono font-semibold flex items-center gap-1 px-1"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        className={cn(
          'w-full flex items-center justify-between px-5 py-3.5 rounded-md text-sm font-semibold tracking-[0.18em] uppercase font-mono transition-all',
          canSubmit
            ? 'bg-[#1F2A23] text-[#EFE7D8] hover:bg-[#1F4F36]'
            : 'bg-[#1F2A23]/15 text-[#1F2A23]/40 cursor-not-allowed',
        )}
      >
        <span>{pending ? 'Signing in…' : 'Enter the demo'}</span>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
      </button>

      {error && (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">{error}</p>
      )}
    </form>
  );
}
