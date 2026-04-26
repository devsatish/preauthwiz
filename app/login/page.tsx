import { redirect } from 'next/navigation';
import { Instrument_Serif } from 'next/font/google';
import { getCurrentPersona } from '@/lib/auth/session';
import { PERSONAS } from '@/lib/auth/personas';
import { LoginPicker } from './_components/login-picker';

// Editorial serif used only on this landing page. Loaded via next/font so it's
// preloaded as a CSS variable and doesn't ship to the rest of the app.
const instrumentSerif = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-instrument-serif',
});

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

interface Stat {
  value: string;
  label: string;
}

const STATS: Stat[] = [
  { value: '5', label: 'agents in parallel' },
  { value: '100%', label: 'claims cited' },
  { value: '10', label: 'eval cases' },
  { value: '0', label: 'hallucinations' },
];

// Honest framing: these are payers seeded into the demo queue. Only Aetna's
// policy corpus is actually indexed for retrieval, but every auth in the
// queue is routed to one of these payers.
const PAYERS = ['Aetna', 'Anthem', 'BCBS', 'Cigna', 'Humana', 'Medicare', 'UHC'];

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const persona = await getCurrentPersona();
  const { next } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (persona) {
    redirect(safeNext);
  }

  return (
    <div
      className={`${instrumentSerif.variable} min-h-screen w-full bg-[#EFE7D8] text-[#1F2A23]`}
      style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}
    >
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 sm:px-12 py-6">
        <div className="flex items-baseline gap-2">
          <span
            className="text-2xl text-[#1F2A23] tracking-tight"
            style={{ fontFamily: 'var(--font-instrument-serif), serif' }}
          >
            PreAuth<em className="italic">Wiz</em>
          </span>
          <span className="text-sm text-[#5C6259] tracking-wide">Meridian Health</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#1F2A23] font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
          Demo environment <span className="text-[#5C6259]">·</span> Live
        </div>
      </header>

      {/* Two-column main */}
      <main className="px-6 sm:px-12 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-16 max-w-7xl mx-auto">
          {/* Left — editorial */}
          <section className="pt-4 lg:pt-12">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#876D2E] font-semibold mb-6">
              + AI Prior Auth Automation
            </p>
            <h1
              className="text-[clamp(3rem,7vw,5.75rem)] leading-[0.95] tracking-tight text-[#1F2A23] mb-8"
              style={{ fontFamily: 'var(--font-instrument-serif), serif' }}
            >
              From chart to draft.
              <br />
              <em className="text-[#1F4F36]">In ninety seconds.</em>
            </h1>

            <p className="text-base sm:text-lg leading-relaxed text-[#3F4943] max-w-xl">
              PreAuthWiz reads the patient&apos;s chart, matches payer policy, scores medical necessity,
              and drafts a citation-grounded justification letter — ready for a human reviewer to sign.
            </p>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-6 mt-12 max-w-xl">
              {STATS.map(s => (
                <div key={s.label}>
                  <p
                    className="text-4xl sm:text-5xl text-[#1F2A23] leading-none"
                    style={{ fontFamily: 'var(--font-instrument-serif), serif' }}
                  >
                    {s.value}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#5C6259] font-medium mt-2">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Payer corpus */}
            <div className="mt-14 pt-8 border-t border-[#1F2A23]/15 max-w-xl">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#5C6259] font-semibold mb-4">
                Payers · Demo queue
              </p>
              <p
                className="text-2xl text-[#1F2A23] leading-tight"
                style={{ fontFamily: 'var(--font-instrument-serif), serif', fontStyle: 'italic' }}
              >
                {PAYERS.join('  ·  ')}
              </p>
            </div>
          </section>

          {/* Right — sign-in card */}
          <section className="lg:pt-12">
            <div className="bg-[#F6EFE0] border border-[#1F2A23]/15 rounded-md px-6 sm:px-8 py-7 lg:sticky lg:top-8">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#5C6259] font-semibold mb-4">
                Sign in
              </p>
              <h2
                className="text-3xl text-[#1F2A23] leading-tight mb-1"
                style={{ fontFamily: 'var(--font-instrument-serif), serif' }}
              >
                Choose a <em className="text-[#1F4F36]">persona.</em>
              </h2>
              <p className="text-sm text-[#5C6259] mb-5">
                Each role frames PreAuthWiz through their workflow.
              </p>

              <LoginPicker personas={PERSONAS} next={safeNext} />

              <p className="text-[11px] text-[#5C6259] mt-5 leading-relaxed">
                HIPAA <span className="text-[#1F2A23]/30">·</span> SOC 2 Type II in progress
                <span className="text-[#1F2A23]/30"> · </span> No PHI in demo
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
