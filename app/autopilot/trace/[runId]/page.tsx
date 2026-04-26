import Link from 'next/link';
import { db } from '@/lib/db/client';
import { authRuns, authRunEvents } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';

function formatTimestamp(date: Date): string {
  const h = date.getUTCHours().toString().padStart(2, '0');
  const m = date.getUTCMinutes().toString().padStart(2, '0');
  const s = date.getUTCSeconds().toString().padStart(2, '0');
  const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

function formatRelative(eventDate: Date, runStart: Date): string {
  const ms = eventDate.getTime() - runStart.getTime();
  const sign = ms < 0 ? '-' : '+';
  const abs = Math.abs(ms);
  const sec = Math.floor(abs / 1000);
  const millis = (abs % 1000).toString().padStart(3, '0');
  return `${sign}${sec.toString().padStart(3, '0')}.${millis}s`;
}

export default async function TracePage(props: PageProps<'/autopilot/trace/[runId]'>) {
  const { runId } = await props.params;

  const runRows = await db.select().from(authRuns).where(eq(authRuns.id, runId)).limit(1);
  const run = runRows[0];

  if (!run) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="border border-slate-200 rounded-lg p-8 text-center bg-white">
          <h1 className="text-xl font-semibold text-slate-900">Run not found</h1>
          <p className="text-sm text-slate-500 mt-2 font-mono">{runId}</p>
          <Link
            href="/autopilot"
            className="inline-block mt-4 text-sm text-blue-600 hover:underline"
          >
            ← Back to Auto-Pilot
          </Link>
        </div>
      </div>
    );
  }

  const events = await db
    .select()
    .from(authRunEvents)
    .where(eq(authRunEvents.runId, runId))
    .orderBy(asc(authRunEvents.timestamp));

  const finalVerdict = run.finalVerdict as Record<string, unknown> | null;
  const startedAtAbs = run.startedAt.toISOString();
  const startedAtRel = (() => {
    const ageMs = Date.now() - run.startedAt.getTime();
    const min = Math.floor(ageMs / 60000);
    const hr = Math.floor(min / 60);
    if (hr > 0) return `${hr}h ${min % 60}m ago`;
    if (min > 0) return `${min}m ago`;
    return 'just now';
  })();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link
        href={`/autopilot?case=${run.priorAuthId}&run=${run.id}`}
        className="inline-block text-sm text-blue-600 hover:underline"
      >
        ← Back to Auto-Pilot
      </Link>

      {/* Header */}
      <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-2">
        <h1 className="text-lg font-semibold text-slate-900">Trace: <span className="font-mono text-sm">{run.id}</span></h1>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <dt className="text-slate-500">Case ID</dt>
          <dd className="font-mono text-slate-700">{run.priorAuthId}</dd>
          <dt className="text-slate-500">Started</dt>
          <dd className="text-slate-700">{startedAtRel} <span className="text-slate-400 font-mono">({startedAtAbs})</span></dd>
          <dt className="text-slate-500">Status</dt>
          <dd className="text-slate-700">{run.status}</dd>
          <dt className="text-slate-500">Verdict</dt>
          <dd className="font-mono text-slate-700">{run.verdict ?? '—'}</dd>
          <dt className="text-slate-500">Total tokens</dt>
          <dd className="text-slate-700">{(run.totalTokens ?? 0).toLocaleString()}</dd>
          <dt className="text-slate-500">Total cost</dt>
          <dd className="text-slate-700">${(Number(run.totalCostCents ?? 0) / 100).toFixed(4)}</dd>
        </dl>
      </div>

      {/* Timeline */}
      <div className="border border-slate-200 rounded-lg bg-white">
        <div className="px-4 py-2 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700">Event timeline ({events.length} events)</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {events.length === 0 && (
            <div className="px-4 py-3 text-xs text-slate-400">No events recorded for this run.</div>
          )}
          {events.map((ev) => {
            const detail = ev.output ?? ev.input;
            const hasDetail = detail !== null && detail !== undefined;
            return (
              <div key={ev.id} className="px-4 py-3 text-xs">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="font-mono text-slate-400 w-24">{formatRelative(ev.timestamp, run.startedAt)}</span>
                  <span className="font-mono text-slate-400 w-28">{formatTimestamp(ev.timestamp)}</span>
                  <span className="font-medium text-slate-700">{ev.subagent}</span>
                  <span className="text-slate-500">{ev.status}</span>
                  {ev.latencyMs !== null && (
                    <span className="text-slate-400">· {(ev.latencyMs / 1000).toFixed(1)}s</span>
                  )}
                  {ev.model && <span className="text-slate-400 font-mono">· {ev.model}</span>}
                  {(ev.cacheReadTokens ?? 0) > 0 && (
                    <span className="text-slate-400">· cache_read {ev.cacheReadTokens}</span>
                  )}
                  {(ev.cacheCreationTokens ?? 0) > 0 && (
                    <span className="text-slate-400">· cache_create {ev.cacheCreationTokens}</span>
                  )}
                </div>
                {hasDetail && (
                  <details className="mt-2">
                    <summary className="text-blue-600 cursor-pointer text-xs hover:underline">show payload</summary>
                    <pre className="mt-2 p-2 bg-slate-50 rounded text-xs whitespace-pre-wrap break-words text-slate-700">
{JSON.stringify(detail, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Final letter */}
      {run.finalLetter && (
        <div className="border border-slate-200 rounded-lg bg-white">
          <div className="px-4 py-2 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700">Final justification letter</h2>
          </div>
          <pre className="px-4 py-3 text-xs text-slate-700 whitespace-pre-wrap break-words font-sans">
{run.finalLetter}
          </pre>
        </div>
      )}

      {/* Final verdict */}
      {finalVerdict && (
        <div className="border border-slate-200 rounded-lg bg-white">
          <div className="px-4 py-2 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700">Final verdict (structured)</h2>
          </div>
          <details className="px-4 py-3" open>
            <summary className="text-blue-600 cursor-pointer text-xs hover:underline">show JSON</summary>
            <pre className="mt-2 p-2 bg-slate-50 rounded text-xs whitespace-pre-wrap break-words text-slate-700">
{JSON.stringify(finalVerdict, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
