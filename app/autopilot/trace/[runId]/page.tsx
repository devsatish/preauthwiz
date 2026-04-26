import Link from 'next/link';
import { db } from '@/lib/db/client';
import { authRuns, authRunEvents, priorAuths, patients } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { TraceView, type TraceEventRow, type TraceRunData } from './_components/trace-view';

export default async function TracePage(props: PageProps<'/autopilot/trace/[runId]'>) {
  const { runId } = await props.params;

  // Join the run row with its prior_auth and patient to get the patient name for the header.
  const runRows = await db
    .select({
      runId: authRuns.id,
      priorAuthId: authRuns.priorAuthId,
      status: authRuns.status,
      verdict: authRuns.verdict,
      startedAt: authRuns.startedAt,
      completedAt: authRuns.completedAt,
      totalTokens: authRuns.totalTokens,
      totalCostCents: authRuns.totalCostCents,
      finalLetter: authRuns.finalLetter,
      finalVerdict: authRuns.finalVerdict,
      patientFirst: patients.firstName,
      patientLast: patients.lastName,
    })
    .from(authRuns)
    .innerJoin(priorAuths, eq(authRuns.priorAuthId, priorAuths.id))
    .innerJoin(patients, eq(priorAuths.patientId, patients.id))
    .where(eq(authRuns.id, runId))
    .limit(1);
  const row = runRows[0];

  if (!row) {
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

  const eventRows: TraceEventRow[] = events.map(e => ({
    id: e.id,
    subagent: e.subagent,
    status: e.status,
    input: (e.input ?? null) as Record<string, unknown> | null,
    output: (e.output ?? null) as Record<string, unknown> | null,
    model: e.model,
    latencyMs: e.latencyMs,
    inputTokens: e.inputTokens,
    outputTokens: e.outputTokens,
    cacheReadTokens: e.cacheReadTokens,
    cacheCreationTokens: e.cacheCreationTokens,
    timestamp: e.timestamp.toISOString(),
  }));

  const data: TraceRunData = {
    id: row.runId,
    priorAuthId: row.priorAuthId,
    patientName: `${row.patientFirst} ${row.patientLast}`,
    status: row.status,
    verdict: row.verdict,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    totalTokens: row.totalTokens ?? 0,
    totalCostCents: Number(row.totalCostCents ?? 0),
    finalLetter: row.finalLetter,
    finalVerdict: (row.finalVerdict ?? null) as Record<string, unknown> | null,
    events: eventRows,
  };

  return <TraceView run={data} />;
}
