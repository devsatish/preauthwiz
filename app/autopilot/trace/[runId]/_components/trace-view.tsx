'use client';

import { useState, useMemo } from 'react';
import { JsonTree } from './json-tree';
import { cn } from '@/lib/utils';

export interface TraceEventRow {
  id: string;
  subagent: string;
  status: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  model: string | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  timestamp: string; // ISO
}

export interface TraceRunData {
  id: string;
  priorAuthId: string;
  patientName: string;
  status: string;
  verdict: string | null;
  startedAt: string; // ISO
  completedAt: string | null; // ISO
  totalTokens: number;
  totalCostCents: number;
  finalLetter: string | null;
  finalVerdict: Record<string, unknown> | null;
  events: TraceEventRow[];
}

// Stable color palette per subagent — reused across timeline bars + event rows.
const SUBAGENT_STYLE: Record<string, { bg: string; bar: string; chip: string; text: string }> = {
  eligibilitySpecialist: { bg: 'bg-blue-50',     bar: 'bg-blue-500',    chip: 'bg-blue-100 text-blue-800 border-blue-200',       text: 'text-blue-700' },
  policyResearcher:      { bg: 'bg-purple-50',   bar: 'bg-purple-500',  chip: 'bg-purple-100 text-purple-800 border-purple-200', text: 'text-purple-700' },
  chartAbstractor:       { bg: 'bg-emerald-50',  bar: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-800 border-emerald-200', text: 'text-emerald-700' },
  riskScorer:            { bg: 'bg-amber-50',    bar: 'bg-amber-500',   chip: 'bg-amber-100 text-amber-800 border-amber-200',     text: 'text-amber-700' },
  justificationDrafter:  { bg: 'bg-pink-50',     bar: 'bg-pink-500',    chip: 'bg-pink-100 text-pink-800 border-pink-200',         text: 'text-pink-700' },
};
const DEFAULT_STYLE = { bg: 'bg-slate-50', bar: 'bg-slate-500', chip: 'bg-slate-100 text-slate-800 border-slate-200', text: 'text-slate-700' };
function styleOf(subagent: string) {
  return SUBAGENT_STYLE[subagent] ?? DEFAULT_STYLE;
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  const base = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border';
  if (verdict === 'auto_approve_eligible') {
    return <span className={`${base} bg-green-100 text-green-800 border-green-200`}>Auto-Approve Eligible</span>;
  }
  if (verdict === 'escalate_for_review') {
    return <span className={`${base} bg-amber-100 text-amber-800 border-amber-200`}>Escalate for Review</span>;
  }
  if (verdict === 'recommend_deny') {
    return <span className={`${base} bg-red-100 text-red-800 border-red-200`}>Recommend Deny</span>;
  }
  if (verdict === 'recommend_approve') {
    return <span className={`${base} bg-blue-100 text-blue-800 border-blue-200`}>Recommend Approve</span>;
  }
  return <span className={`${base} bg-slate-100 text-slate-700 border-slate-200`}>{verdict ?? '—'}</span>;
}

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

function relativeTimeString(startedAt: Date): string {
  const ageMs = Date.now() - startedAt.getTime();
  const min = Math.floor(ageMs / 60000);
  const hr = Math.floor(min / 60);
  if (hr > 0) return `${hr}h ${min % 60}m ago`;
  if (min > 0) return `${min}m ago`;
  return 'just now';
}

function eventBorderClass(status: string): string {
  if (status === 'score_override') return 'border-l-4 border-amber-400';
  if (status === 'policy_extraction_failure' || status === 'improvised_evidence_discarded') {
    return 'border-l-4 border-red-400';
  }
  return 'border-l-4 border-transparent';
}

function eventBadge(status: string) {
  if (status === 'score_override') {
    return <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">⚠ scorer override fired</span>;
  }
  if (status === 'policy_extraction_failure') {
    return <span className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">⚠ policy extraction failed</span>;
  }
  if (status === 'improvised_evidence_discarded') {
    return <span className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">⚠ improvised evidence discarded</span>;
  }
  return null;
}

export function TraceView({ run }: { run: TraceRunData }) {
  const [filter, setFilter] = useState<string | null>(null);
  const runStart = new Date(run.startedAt);
  const runEnd = run.completedAt ? new Date(run.completedAt) : new Date();
  const totalDurationMs = Math.max(1, runEnd.getTime() - runStart.getTime());

  // Distinct subagents present in events, in their first-appearance order.
  const subagents = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const ev of run.events) {
      if (!seen.has(ev.subagent)) {
        seen.add(ev.subagent);
        order.push(ev.subagent);
      }
    }
    return order;
  }, [run.events]);

  // Timeline bars: one row per subagent, bar per agent_completed event.
  const timelineBars = useMemo(() => {
    return subagents.map((subagent) => {
      const completedEvents = run.events.filter(
        e => e.subagent === subagent && e.status === 'agent_completed' && e.latencyMs != null,
      );
      const bars = completedEvents.map(e => {
        const endMs = new Date(e.timestamp).getTime();
        const startMs = endMs - (e.latencyMs ?? 0);
        const leftPct = ((startMs - runStart.getTime()) / totalDurationMs) * 100;
        const widthPct = ((e.latencyMs ?? 0) / totalDurationMs) * 100;
        return {
          id: e.id,
          leftPct: Math.max(0, leftPct),
          widthPct: Math.max(0.5, widthPct),
          latencyMs: e.latencyMs ?? 0,
          tokens: (e.inputTokens ?? 0) + (e.outputTokens ?? 0),
        };
      });
      return { subagent, bars };
    });
  }, [subagents, run.events, runStart, totalDurationMs]);

  const filteredEvents = filter ? run.events.filter(e => e.subagent === filter) : run.events;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <a
        href={`/autopilot?case=${run.priorAuthId}&run=${run.id}`}
        className="inline-block text-sm text-blue-600 hover:underline"
      >
        ← Back to Auto-Pilot
      </a>

      {/* Header */}
      <div className="border border-slate-200 rounded-lg bg-white">
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{run.patientName}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Case <span className="font-mono">{run.priorAuthId}</span>
              {' · '}
              <span className="font-mono text-xs">{run.id}</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Started {relativeTimeString(runStart)} ({run.startedAt})
            </p>
          </div>
          <VerdictBadge verdict={run.verdict} />
        </div>
        <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-slate-400 font-medium uppercase tracking-wide">Status</p>
            <p className="text-slate-700 mt-0.5">{run.status}</p>
          </div>
          <div>
            <p className="text-slate-400 font-medium uppercase tracking-wide">Total tokens</p>
            <p className="text-slate-700 mt-0.5">{run.totalTokens.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-slate-400 font-medium uppercase tracking-wide">Cost</p>
            <p className="text-slate-700 mt-0.5">${(run.totalCostCents / 100).toFixed(4)}</p>
          </div>
          <div>
            <p className="text-slate-400 font-medium uppercase tracking-wide">Latency</p>
            <p className="text-slate-700 mt-0.5">{(totalDurationMs / 1000).toFixed(1)} s</p>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 font-medium uppercase tracking-wide mr-1">Filter:</span>
        <button
          onClick={() => setFilter(null)}
          className={cn(
            'text-xs px-2.5 py-1 rounded-full border transition-colors',
            filter === null ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50',
          )}
        >
          all ({run.events.length})
        </button>
        {subagents.map((sa) => {
          const style = styleOf(sa);
          const count = run.events.filter(e => e.subagent === sa).length;
          const active = filter === sa;
          return (
            <button
              key={sa}
              onClick={() => setFilter(active ? null : sa)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border transition-colors',
                active
                  ? `${style.chip} ring-2 ring-offset-1`
                  : `${style.chip} opacity-70 hover:opacity-100`,
              )}
            >
              {sa} ({count})
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="border border-slate-200 rounded-lg bg-white">
        <div className="px-5 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700">Execution timeline</h2>
          <p className="text-xs text-slate-400 mt-0.5">Bars positioned by start time, sized by latency. Hover for tokens.</p>
        </div>
        <div className="px-5 py-4 space-y-2">
          {timelineBars.map(({ subagent, bars }) => {
            const style = styleOf(subagent);
            return (
              <div key={subagent} className="flex items-center gap-3">
                <div className={cn('w-44 text-xs font-medium shrink-0', style.text)}>{subagent}</div>
                <div className="flex-1 h-6 relative bg-slate-50 rounded">
                  {bars.map(b => (
                    <div
                      key={b.id}
                      className={cn('absolute top-0 h-full rounded', style.bar)}
                      style={{ left: `${b.leftPct}%`, width: `${b.widthPct}%` }}
                      title={`${(b.latencyMs / 1000).toFixed(1)}s · ${b.tokens.toLocaleString()} tokens`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <div className="w-44 text-xs text-slate-400 shrink-0">total</div>
            <div className="flex-1 text-xs text-slate-500 flex justify-between font-mono">
              <span>0s</span>
              <span>{(totalDurationMs / 1000).toFixed(1)}s</span>
            </div>
          </div>
        </div>
      </div>

      {/* Event list */}
      <div className="border border-slate-200 rounded-lg bg-white">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">
            Events {filter ? <span className="text-slate-400 font-normal">· filtered to {filter}</span> : null}
          </h2>
          <span className="text-xs text-slate-400">{filteredEvents.length} of {run.events.length}</span>
        </div>
        <div className="divide-y divide-slate-100">
          {filteredEvents.length === 0 && (
            <div className="px-4 py-3 text-xs text-slate-400">No events match this filter.</div>
          )}
          {filteredEvents.map(ev => {
            const style = styleOf(ev.subagent);
            const evDate = new Date(ev.timestamp);
            const detail = ev.output ?? ev.input;
            const totalTokensThisStep = (ev.inputTokens ?? 0) + (ev.outputTokens ?? 0) + ev.cacheReadTokens + ev.cacheCreationTokens;
            return (
              <div key={ev.id} className={cn('px-4 py-3 text-xs', eventBorderClass(ev.status))}>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="font-mono text-slate-400 w-20 shrink-0">{formatRelative(evDate, runStart)}</span>
                  <span className="font-mono text-slate-300 w-24 shrink-0 hidden sm:inline">{formatTimestamp(evDate)}</span>
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded font-medium border text-xs', style.chip)}>{ev.subagent}</span>
                  <span className="text-slate-600">{ev.status}</span>
                  {ev.latencyMs !== null && (
                    <span className="text-slate-400">· {(ev.latencyMs / 1000).toFixed(2)}s</span>
                  )}
                  {ev.model && <span className="text-slate-400 font-mono text-xs">· {ev.model}</span>}
                  {eventBadge(ev.status)}
                  {ev.cacheReadTokens > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">cache hit · {ev.cacheReadTokens.toLocaleString()}</span>
                  )}
                  {ev.cacheCreationTokens > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">cache write · {ev.cacheCreationTokens.toLocaleString()}</span>
                  )}
                </div>
                {totalTokensThisStep > 0 && (
                  <div className="text-xs text-slate-400 mt-1 font-mono">
                    in {(ev.inputTokens ?? 0).toLocaleString()} · cache_read {ev.cacheReadTokens.toLocaleString()} · cache_create {ev.cacheCreationTokens.toLocaleString()} · out {(ev.outputTokens ?? 0).toLocaleString()}
                  </div>
                )}
                {detail !== null && detail !== undefined && (
                  <details className="mt-2">
                    <summary className="text-blue-600 cursor-pointer text-xs hover:underline select-none">show payload</summary>
                    <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-100 overflow-x-auto">
                      <JsonTree value={detail} />
                    </div>
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
          <div className="px-5 py-3 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700">Final justification letter</h2>
          </div>
          <pre className="px-5 py-4 text-xs text-slate-700 whitespace-pre-wrap break-words font-sans">
{run.finalLetter}
          </pre>
        </div>
      )}

      {/* Final verdict */}
      {run.finalVerdict && (
        <div className="border border-slate-200 rounded-lg bg-white">
          <div className="px-5 py-3 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700">Final verdict (structured)</h2>
          </div>
          <details className="px-5 py-3" open>
            <summary className="text-blue-600 cursor-pointer text-xs hover:underline select-none">show JSON</summary>
            <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-100 overflow-x-auto">
              <JsonTree value={run.finalVerdict} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
