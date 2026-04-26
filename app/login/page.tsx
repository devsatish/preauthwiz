import { redirect } from 'next/navigation';
import { getCurrentPersona } from '@/lib/auth/session';
import { PERSONAS } from '@/lib/auth/personas';
import { LoginPicker } from './_components/login-picker';
import { Zap, FileSearch, Bot, ShieldCheck } from 'lucide-react';

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

interface Pillar {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  accent: string;
}

const PILLARS: Pillar[] = [
  {
    icon: Bot,
    title: '5-agent pipeline',
    body: 'Eligibility, policy researcher, chart abstractor, risk scorer, letter drafter — Claude Opus + Haiku working in parallel.',
    accent: 'bg-blue-50 text-blue-700',
  },
  {
    icon: FileSearch,
    title: 'Every claim cited',
    body: 'Letters quote real chart notes and exact policy language from Aetna, Anthem, and BCBS. Zero hallucination — citations link back to source.',
    accent: 'bg-emerald-50 text-emerald-700',
  },
  {
    icon: ShieldCheck,
    title: 'Deterministic + audited',
    body: 'Risk scoring is pure code, not LLM math. A 10-case eval harness catches regressions. Every run leaves a full trace.',
    accent: 'bg-violet-50 text-violet-700',
  },
];

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const persona = await getCurrentPersona();
  const { next } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  // Already signed in? Skip the picker.
  if (persona) {
    redirect(safeNext);
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50">
      <div className="max-w-5xl mx-auto px-6 py-10 sm:py-14">
        {/* Brand bar */}
        <div className="flex items-center justify-between mb-10">
          <div className="inline-flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
              <Zap className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <p className="text-base font-semibold text-slate-900">PreAuthWiz</p>
              <p className="text-xs text-slate-500">Meridian Health</p>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-medium px-2.5 py-1 bg-white/60 backdrop-blur-sm border border-slate-200 rounded-full">
            Demo environment
          </span>
        </div>

        {/* Hero */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full mb-4">
            <Zap className="h-3 w-3" />
            AI prior auth automation
          </span>
          <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight leading-tight">
            Turn 30-minute prior auths into{' '}
            <span className="text-blue-600">90-second AI drafts.</span>
          </h1>
          <p className="text-slate-600 mt-4 text-base leading-relaxed">
            PreAuthWiz reads the patient&apos;s chart, matches payer policy, scores medical necessity,
            and drafts a citation-grounded justification letter — ready for a human reviewer to sign.
            Every claim links back to the chart note or policy paragraph it came from.
          </p>
        </div>

        {/* Three pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="bg-white/70 backdrop-blur-sm border border-slate-200 rounded-xl p-4">
                <div className={`h-9 w-9 rounded-lg ${p.accent} flex items-center justify-center mb-3`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <p className="font-semibold text-slate-900 text-sm">{p.title}</p>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{p.body}</p>
              </div>
            );
          })}
        </div>

        {/* Sign in section */}
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-5">
            <h2 className="text-xl font-semibold text-slate-900">Sign in to explore</h2>
            <p className="text-sm text-slate-500 mt-1">
              Enter the access password, then pick a persona. Each role sees the product through their lens.
            </p>
          </div>
          <LoginPicker personas={PERSONAS} next={safeNext} />
        </div>

        <p className="text-center text-xs text-slate-400 mt-10">
          Demo · Sample patients & payers · No real PHI · Submitted as a Vercel takehome
        </p>
      </div>
    </div>
  );
}
