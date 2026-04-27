import Link from 'next/link';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readLatestResults, type EvalResultsBundle } from '@/lib/eval/persist';
import type { CaseResult } from '@/lib/eval/cases';
import { ChevronRight, ExternalLink, ShieldCheck, Repeat, Crosshair, AlertTriangle, CheckCircle2, FileCode2, Code } from 'lucide-react';
import { JsonTree } from '@/app/autopilot/trace/[runId]/_components/json-tree';

// Force dynamic rendering — page reads from disk at request time.
export const dynamic = 'force-dynamic';

// Read the eval cases source so the page can show the actual TypeScript that
// asserts each expected outcome — turns the harness from "trust me, it
// passes" into "here's the literal assertion code."
function loadCasesSource(): string | null {
  try {
    return readFileSync(path.join(process.cwd(), 'lib/eval/cases.ts'), 'utf-8');
  } catch {
    return null;
  }
}

// Extract the source slice for a single case by id. Walks balanced braces
// starting from the `id: 'X'` marker. Doesn't handle strings containing
// braces, but cases.ts doesn't have any — fine for this purpose.
function extractCaseSource(source: string, caseId: string): string | null {
  const idMarker = `id: '${caseId}'`;
  const idx = source.indexOf(idMarker);
  if (idx < 0) return null;
  let openIdx = idx;
  while (openIdx > 0 && source[openIdx] !== '{') openIdx--;
  if (source[openIdx] !== '{') return null;
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(openIdx, i + 1);
    }
  }
  return null;
}

// ======================================================================
// Methodology copy — explains what the harness is and why each category
// of case exists. AI-leadership-friendly framing: each category maps to
// a specific class of failure mode, and the page surfaces what the
// harness catches that a vanilla LLM would miss.
// ======================================================================

// Tailwind needs full class strings at build time — no string interpolation.
const CATEGORY_META: Record<
  'regression' | 'adversarial' | 'edge',
  { title: string; tagline: string; purpose: string; icon: typeof ShieldCheck; iconBg: string; iconText: string }
> = {
  regression: {
    title: 'Regression',
    tagline: 'Catch silent breakage on canonical flows',
    purpose:
      "The two demo cases (auth-005 escalate, auth-013 auto-approve) plus a clear-deny baseline. If a prompt change silently flips one of these, we know within a single eval run instead of in production.",
    icon: Repeat,
    iconBg: 'bg-blue-50',
    iconText: 'text-blue-700',
  },
  adversarial: {
    title: 'Adversarial',
    tagline: 'Engineered to trip the system on a known failure mode',
    purpose:
      "Each adversarial case targets a specific class of LLM misbehavior we've seen empirically — dose substitution, narrative grounding, exclusion semantics, policy-extraction emptiness. They double as proofs that the defense-in-depth validators are actually firing.",
    icon: Crosshair,
    iconBg: 'bg-purple-50',
    iconText: 'text-purple-700',
  },
  edge: {
    title: 'Edge',
    tagline: 'Boundary cases with controlled jitter',
    purpose:
      "Cases on the deny / escalate boundary where temp-0 jitter is real. They use verdict_one_of to assert the acceptable verdict set instead of a single answer — flakiness-resistant without losing the catastrophic-regression assertion.",
    icon: AlertTriangle,
    iconBg: 'bg-slate-100',
    iconText: 'text-slate-700',
  },
};

// Specific bugs the harness has surfaced during development. These aren't
// theoretical — every entry corresponds to a real fix in the agent stack.
const BUGS_CAUGHT: { bug: string; caughtBy: string }[] = [
  {
    bug: 'Chart abstractor improvising chart facts that did not appear in the FHIR bundle',
    caughtBy: 'narrative-grounding-no-fabrication + improvised_evidence_discarded validator',
  },
  {
    bug: 'Risk scorer silently failing open when policy researcher returned empty criteria',
    caughtBy: 'empty-criteria-fail-safe + policy_extraction_failure validator',
  },
  {
    bug: 'LLM substituting policy-default dose (155 units) for actual requested dose (200 units)',
    caughtBy: 'dosage-consistency-200-vs-155',
  },
  {
    bug: 'Exclusion criteria misfiring — flagging chronic-migraine patients with literal "episodic" string match',
    caughtBy: 'exclusion-semantics-stable',
  },
  {
    bug: 'Letter narrative referencing policy-threshold values (50%) instead of actual measured values (59%)',
    caughtBy: 'auth-013-marcus-auto-approve letter_must_contain assertions',
  },
];

// ======================================================================
// Helpers
// ======================================================================

function StatusBadge({ status }: { status: CaseResult['status'] }) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border';
  if (status === 'PASS') return <span className={`${base} bg-green-100 text-green-800 border-green-200`}>PASS</span>;
  if (status === 'FAIL') return <span className={`${base} bg-red-100 text-red-800 border-red-200`}>FAIL</span>;
  return <span className={`${base} bg-amber-100 text-amber-800 border-amber-200`}>ERROR</span>;
}

function VerdictPill({ verdict, kind }: { verdict: string; kind?: 'expected' | 'actual' }) {
  const dim = kind === 'expected';
  const base = `inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${dim ? 'opacity-75' : ''}`;
  if (verdict === 'auto_approve_eligible') return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>auto-approve</span>;
  if (verdict === 'escalate_for_review') return <span className={`${base} bg-amber-50 text-amber-700 border-amber-200`}>escalate</span>;
  if (verdict === 'recommend_deny') return <span className={`${base} bg-red-50 text-red-700 border-red-200`}>deny</span>;
  if (verdict === 'recommend_approve') return <span className={`${base} bg-blue-50 text-blue-700 border-blue-200`}>approve</span>;
  return <span className={`${base} bg-slate-50 text-slate-600 border-slate-200`}>{verdict || '—'}</span>;
}

function relativeTime(iso: string): string {
  const ageMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ageMs / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `${day}d ${hr % 24}h ago`;
  if (hr > 0) return `${hr}h ${min % 60}m ago`;
  if (min > 0) return `${min}m ago`;
  return 'just now';
}

function describeExpected(c: CaseResult['case']): string[] {
  if (c.expected.verdict_one_of) return c.expected.verdict_one_of;
  if (c.expected.verdict) return [c.expected.verdict];
  return [];
}

function EmptyState() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="border border-slate-200 rounded-lg p-12 text-center bg-white">
        <h1 className="text-xl font-semibold text-slate-900">No eval results yet</h1>
        <p className="text-sm text-slate-500 mt-2">
          The eval harness hasn&apos;t run on this machine. Trigger it with:
        </p>
        <pre className="inline-block mt-3 px-3 py-2 bg-slate-100 rounded font-mono text-xs text-slate-700">pnpm eval</pre>
        <p className="text-xs text-slate-400 mt-3">
          Cases are defined in <span className="font-mono">lib/eval/cases.ts</span>. Each pnpm eval run takes
          ~18 minutes and ~$3 in API cost. Results land at
          <span className="font-mono"> .eval-results/latest.json</span>.
        </p>
      </div>
    </div>
  );
}

export default function EvalsPage() {
  const bundle = readLatestResults();
  if (!bundle) return <EmptyState />;
  const casesSource = loadCasesSource();
  return <Dashboard bundle={bundle} casesSource={casesSource} />;
}

// ======================================================================
// Main view
// ======================================================================

function Dashboard({ bundle, casesSource }: { bundle: EvalResultsBundle; casesSource: string | null }) {
  const total = bundle.results.length;
  const allPass = bundle.pass_count === total;
  const avgWallSec = (bundle.total_wall_ms / total / 1000).toFixed(1);
  const avgCost = (bundle.total_cost_cents / total / 100).toFixed(3);

  // Group results by category, in display order
  const groups: Record<'regression' | 'adversarial' | 'edge', CaseResult[]> = {
    regression: [],
    adversarial: [],
    edge: [],
  };
  for (const r of bundle.results) groups[r.case.category].push(r);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ============ HERO ============ */}
      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Eval Harness</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Last run {relativeTime(bundle.timestamp)}{' '}
              <span className="font-mono text-slate-400">({bundle.timestamp})</span>
            </p>
          </div>
          <Link href="/autopilot" className="text-xs text-blue-600 hover:underline">→ Auto-Pilot</Link>
        </div>

        {/* Big headline: PASS rate */}
        <div className="px-6 py-6 bg-gradient-to-br from-slate-50 to-blue-50 border-b border-slate-200">
          <div className="flex items-baseline gap-3 mb-2">
            <span
              className={`text-5xl font-semibold ${allPass ? 'text-emerald-700' : 'text-amber-700'}`}
              style={{ fontFamily: 'var(--font-instrument-serif), serif' }}
            >
              {bundle.pass_count}/{total}
            </span>
            <span className="text-2xl text-slate-500" style={{ fontFamily: 'var(--font-instrument-serif), serif' }}>
              cases <em className={allPass ? 'text-emerald-700 italic' : 'text-amber-700 italic'}>{allPass ? 'pass.' : 'pass.'}</em>
            </span>
          </div>
          <p className="text-sm text-slate-600 max-w-3xl">
            10-case suite covering canonical flows, adversarial probes, and verdict-jitter boundaries. Every
            assertion runs against the full 5-agent pipeline — no mocks, no shortcuts. <strong>10/10 PASS is
            the ship gate before any prompt change goes out.</strong>
          </p>
        </div>

        {/* Stats row */}
        <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
          <Stat label="Total cases" value={String(total)} />
          <Stat label="Pass" value={String(bundle.pass_count)} accent="green" />
          <Stat label="Fail" value={String(bundle.fail_count)} accent={bundle.fail_count > 0 ? 'red' : 'slate'} />
          <Stat label="Wall-clock" value={`${(bundle.total_wall_ms / 1000).toFixed(0)}s`} sub={`avg ${avgWallSec}s/case`} />
          <Stat label="Total cost" value={`$${(bundle.total_cost_cents / 100).toFixed(2)}`} sub={`avg $${avgCost}/case`} />
        </div>
      </div>

      {/* ============ METHODOLOGY ============ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['regression', 'adversarial', 'edge'] as const).map(cat => {
          const meta = CATEGORY_META[cat];
          const Icon = meta.icon;
          const count = groups[cat].length;
          const pass = groups[cat].filter(r => r.status === 'PASS').length;
          return (
            <div key={cat} className="border border-slate-200 rounded-lg bg-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`h-8 w-8 rounded-md flex items-center justify-center ${meta.iconBg} ${meta.iconText}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm leading-tight">{meta.title}</p>
                  <p className="text-xs text-slate-500">{meta.tagline}</p>
                </div>
                <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${pass === count ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {pass}/{count}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mt-1">{meta.purpose}</p>
            </div>
          );
        })}
      </div>

      {/* ============ WHAT IT CATCHES ============ */}
      <div className="border border-slate-200 rounded-lg bg-white">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
          <h2 className="text-sm font-semibold text-slate-700">Real bugs this harness has caught</h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {BUGS_CAUGHT.map((b, i) => (
            <li key={i} className="px-5 py-3 text-xs flex items-start gap-3">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-slate-700 leading-relaxed">{b.bug}</p>
                <p className="text-slate-400 mt-0.5 font-mono text-[11px]">caught by: {b.caughtBy}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ============ FULL SOURCE VIEWER ============ */}
      {casesSource && (
        <details className="border border-slate-200 rounded-lg bg-white group">
          <summary className="px-5 py-3 border-b border-slate-200 group-open:border-b border-transparent flex items-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors select-none list-none">
            <FileCode2 className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">View case definitions</h2>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500 font-mono">lib/eval/cases.ts</span>
            <span className="ml-auto text-xs text-blue-600 group-open:hidden">expand →</span>
            <span className="ml-auto text-xs text-blue-600 hidden group-open:inline">collapse</span>
          </summary>
          <pre className="font-mono text-xs leading-relaxed text-slate-800 bg-slate-50 p-4 overflow-x-auto max-h-[60vh] overflow-y-auto rounded-b-lg whitespace-pre">
{casesSource}
          </pre>
        </details>
      )}

      {/* ============ CASES BY CATEGORY ============ */}
      {(['regression', 'adversarial', 'edge'] as const).map(cat => {
        const cases = groups[cat];
        if (cases.length === 0) return null;
        const meta = CATEGORY_META[cat];
        const Icon = meta.icon;
        return (
          <div key={cat} className="border border-slate-200 rounded-lg bg-white">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
              <Icon className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-700">{meta.title} cases</h2>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500">{cases.length} {cases.length === 1 ? 'case' : 'cases'}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {cases.map(r => (
                <CaseRow
                  key={r.case.id}
                  result={r}
                  source={casesSource ? extractCaseSource(casesSource, r.case.id) : null}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, accent, sub }: { label: string; value: string; accent?: 'green' | 'red' | 'slate'; sub?: string }) {
  const color =
    accent === 'green' ? 'text-emerald-700' : accent === 'red' ? 'text-red-700' : 'text-slate-700';
  return (
    <div>
      <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">{label}</p>
      <p className={`mt-0.5 text-base font-semibold ${color}`}>{value}</p>
      {sub && <p className="text-slate-400 text-[10px] mt-0.5">{sub}</p>}
    </div>
  );
}

function CaseRow({ result, source }: { result: CaseResult; source: string | null }) {
  const r = result;
  const expectedVerdicts = describeExpected(r.case);
  const isFail = r.status !== 'PASS';
  return (
    <div className="px-5 py-3.5 text-xs">
      <div className="flex items-start gap-3">
        {/* LEFT: identity */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-slate-800 font-medium" title={r.case.id}>{r.case.id}</span>
            <StatusBadge status={r.status} />
          </div>
          {r.case.description && (
            <p className="text-slate-600 mt-1 leading-relaxed">{r.case.description}</p>
          )}
        </div>

        {/* RIGHT: expected vs actual + metrics */}
        <div className="flex items-center gap-4 shrink-0 flex-wrap justify-end">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium mb-1">Expected → Actual</p>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <span className="flex items-center gap-1">
                {expectedVerdicts.map(v => (
                  <VerdictPill key={v} verdict={v} kind="expected" />
                ))}
              </span>
              <span className="text-slate-400">→</span>
              <VerdictPill verdict={r.actual.verdict} kind="actual" />
            </div>
          </div>
        </div>
      </div>

      {/* Metrics row — humanized labels */}
      <div className="mt-2.5 flex items-center gap-x-4 gap-y-1 flex-wrap text-[11px] text-slate-500">
        <Metric label="Score" value={r.actual.score.toFixed(2)} />
        <Metric label="Blocking criteria" value={String(r.actual.blocking_count)} />
        <Metric label="Total criteria" value={String(r.actual.criteria_count)} />
        <Metric label="Latency" value={`${(r.actual.latency_ms / 1000).toFixed(1)}s`} />
        <Metric label="Cost" value={`$${(r.actual.total_cost_cents / 100).toFixed(3)}`} />
        <span className="ml-auto inline-flex items-center gap-3">
          {r.runId && (
            <Link
              href={`/autopilot/trace/${r.runId}`}
              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
            >
              view full trace <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </span>
      </div>

      {/* Per-case source viewer — lets the demo presenter point at the literal
          assertion code for this specific case. */}
      {source && (
        <details className="mt-2 group">
          <summary className="text-[11px] text-slate-500 hover:text-blue-600 cursor-pointer select-none inline-flex items-center gap-1">
            <Code className="h-3 w-3" />
            <span className="group-open:hidden">show case definition</span>
            <span className="hidden group-open:inline">hide case definition</span>
          </summary>
          <pre className="mt-2 font-mono text-[11px] leading-relaxed text-slate-800 bg-slate-50 border border-slate-200 rounded p-3 overflow-x-auto whitespace-pre">
{source}
          </pre>
        </details>
      )}

      {isFail && (
        <details className="mt-2.5">
          <summary className="text-blue-600 cursor-pointer text-xs hover:underline select-none inline-flex items-center gap-1">
            <ChevronRight className="h-3 w-3" /> show failure detail
          </summary>
          <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded space-y-1">
            {r.error && (
              <div className="text-red-700 text-xs">
                <span className="font-semibold">ERROR:</span> {r.error}
              </div>
            )}
            {r.failures.map((f, i) => (
              <div key={i} className="text-red-700 text-xs">
                <span className="text-red-500 mr-1">✗</span>{f}
              </div>
            ))}
            {r.case.notes && (
              <div className="text-slate-600 text-xs pt-1 border-t border-red-100 mt-2">
                <span className="text-slate-400 uppercase tracking-wide text-xs mr-1">why this case exists:</span>
                {r.case.notes}
              </div>
            )}
            <details className="pt-1 border-t border-red-100 mt-2">
              <summary className="text-slate-500 cursor-pointer text-xs hover:underline select-none">show actual values</summary>
              <div className="mt-2">
                <JsonTree value={r.actual} />
              </div>
            </details>
          </div>
        </details>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono text-slate-700">{value}</span>
    </span>
  );
}
