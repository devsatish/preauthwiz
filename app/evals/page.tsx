import Link from 'next/link';
import { readLatestResults, type EvalResultsBundle } from '@/lib/eval/persist';
import type { CaseResult } from '@/lib/eval/cases';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { JsonTree } from '@/app/autopilot/trace/[runId]/_components/json-tree';

// Force dynamic rendering — page reads from disk at request time.
export const dynamic = 'force-dynamic';

function StatusBadge({ status }: { status: CaseResult['status'] }) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border';
  if (status === 'PASS') return <span className={`${base} bg-green-100 text-green-800 border-green-200`}>PASS</span>;
  if (status === 'FAIL') return <span className={`${base} bg-red-100 text-red-800 border-red-200`}>FAIL</span>;
  return <span className={`${base} bg-amber-100 text-amber-800 border-amber-200`}>ERROR</span>;
}

function VerdictPill({ verdict }: { verdict: string }) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border';
  if (verdict === 'auto_approve_eligible') return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>auto-approve</span>;
  if (verdict === 'escalate_for_review') return <span className={`${base} bg-amber-50 text-amber-700 border-amber-200`}>escalate</span>;
  if (verdict === 'recommend_deny') return <span className={`${base} bg-red-50 text-red-700 border-red-200`}>deny</span>;
  if (verdict === 'recommend_approve') return <span className={`${base} bg-blue-50 text-blue-700 border-blue-200`}>approve</span>;
  return <span className={`${base} bg-slate-50 text-slate-600 border-slate-200`}>{verdict || '—'}</span>;
}

function categoryColor(cat: string): string {
  if (cat === 'regression') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (cat === 'adversarial') return 'bg-purple-100 text-purple-800 border-purple-200';
  if (cat === 'edge') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
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

function describeExpected(c: CaseResult['case']): string {
  if (c.expected.verdict_one_of) return c.expected.verdict_one_of.map(v => v.replace(/_/g, ' ')).join(' | ');
  if (c.expected.verdict) return c.expected.verdict.replace(/_/g, ' ');
  return '—';
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
  return <Dashboard bundle={bundle} />;
}

function Dashboard({ bundle }: { bundle: EvalResultsBundle }) {
  const total = bundle.results.length;
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="border border-slate-200 rounded-lg bg-white">
        <div className="px-5 py-4 border-b border-slate-200 flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Eval Harness Results</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Last run {relativeTime(bundle.timestamp)} <span className="font-mono text-slate-400">({bundle.timestamp})</span>
            </p>
          </div>
          <Link href="/autopilot" className="text-xs text-blue-600 hover:underline">→ Auto-Pilot</Link>
        </div>
        <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
          <Stat label="Total" value={String(total)} />
          <Stat label="Pass" value={String(bundle.pass_count)} accent={bundle.pass_count === total ? 'green' : 'slate'} />
          <Stat label="Fail" value={String(bundle.fail_count)} accent={bundle.fail_count > 0 ? 'red' : 'slate'} />
          <Stat label="Wall-clock" value={`${(bundle.total_wall_ms / 1000).toFixed(0)}s`} />
          <Stat label="Cost" value={`$${(bundle.total_cost_cents / 100).toFixed(4)}`} />
        </div>
      </div>

      {/* Per-case table */}
      <div className="border border-slate-200 rounded-lg bg-white">
        <div className="px-5 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700">Cases</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {bundle.results.map((r) => (
            <CaseRow key={r.case.id} result={r} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'green' | 'red' | 'slate' }) {
  const color =
    accent === 'green' ? 'text-green-700' : accent === 'red' ? 'text-red-700' : 'text-slate-700';
  return (
    <div>
      <p className="text-slate-400 font-medium uppercase tracking-wide">{label}</p>
      <p className={`mt-0.5 text-base font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function CaseRow({ result }: { result: CaseResult }) {
  const r = result;
  const expected = describeExpected(r.case);
  const isFail = r.status !== 'PASS';
  return (
    <div className="px-5 py-3 text-xs">
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="font-mono text-slate-700 font-medium w-72 shrink-0 truncate" title={r.case.id}>{r.case.id}</span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${categoryColor(r.case.category)}`}>{r.case.category}</span>
        <StatusBadge status={r.status} />
        <span className="text-slate-400">expected:</span>
        <span className="text-slate-600">{expected}</span>
        <span className="text-slate-400">→</span>
        <VerdictPill verdict={r.actual.verdict} />
        <span className="text-slate-400 font-mono">score {r.actual.score.toFixed(2)}</span>
        <span className="text-slate-400 font-mono">blk {r.actual.blocking_count}</span>
        <span className="text-slate-400 font-mono">crit {r.actual.criteria_count}</span>
        <span className="text-slate-400">{(r.actual.latency_ms / 1000).toFixed(1)}s</span>
        <span className="text-slate-400">${(r.actual.total_cost_cents / 100).toFixed(3)}</span>
        {r.runId && (
          <Link href={`/autopilot/trace/${r.runId}`} className="ml-auto inline-flex items-center gap-1 text-blue-600 hover:underline">
            trace <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
      {r.case.description && (
        <div className="text-slate-500 mt-1.5 italic">{r.case.description}</div>
      )}
      {isFail && (
        <details className="mt-2">
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
