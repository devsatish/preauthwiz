import { redirect } from 'next/navigation';
import { getCurrentPersona } from '@/lib/auth/session';
import { PERSONAS } from '@/lib/auth/personas';
import { LoginPicker } from './_components/login-picker';

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const persona = await getCurrentPersona();
  const { next } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  // Already signed in? Skip the picker.
  if (persona) {
    redirect(safeNext);
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <span className="text-xl font-semibold text-slate-900">PreAuthWiz</span>
          </div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
            Welcome to Meridian Health
          </h1>
          <p className="text-slate-500 mt-2 text-sm">
            Sign in to continue. Pick a persona to see the demo from their perspective.
          </p>
        </div>

        <LoginPicker personas={PERSONAS} next={safeNext} />

        <p className="text-center text-xs text-slate-400 mt-8">
          Demo environment · Sample patients & payers · No real PHI
        </p>
      </div>
    </div>
  );
}
