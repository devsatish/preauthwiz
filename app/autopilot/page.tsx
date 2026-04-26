import { db } from '@/lib/db/client';
import { authRuns } from '@/lib/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { AutopilotClient, type InitialRun } from './_components/autopilot-client';

const DEFAULT_CASE = 'auth-005';

async function loadInitialRun(caseId: string, runId?: string): Promise<InitialRun | null> {
  const where = runId
    ? eq(authRuns.id, runId)
    : and(eq(authRuns.priorAuthId, caseId), eq(authRuns.status, 'completed'));

  const rows = await db
    .select({
      id: authRuns.id,
      priorAuthId: authRuns.priorAuthId,
      status: authRuns.status,
      verdict: authRuns.verdict,
      startedAt: authRuns.startedAt,
      completedAt: authRuns.completedAt,
      totalTokens: authRuns.totalTokens,
      totalCostCents: authRuns.totalCostCents,
      finalLetter: authRuns.finalLetter,
      finalVerdict: authRuns.finalVerdict,
    })
    .from(authRuns)
    .where(where)
    .orderBy(desc(authRuns.startedAt))
    .limit(1);

  const row = rows[0];
  if (!row || row.status !== 'completed' || !row.finalLetter) return null;

  const fv = (row.finalVerdict ?? {}) as { latency_ms?: number };

  return {
    id: row.id,
    priorAuthId: row.priorAuthId,
    startedAt: row.startedAt.toISOString(),
    completedAt: (row.completedAt ?? row.startedAt).toISOString(),
    letter: row.finalLetter,
    verdict: row.verdict ?? '',
    totalTokens: row.totalTokens ?? 0,
    totalCostCents: Number(row.totalCostCents ?? 0),
    latencyMs: fv.latency_ms ?? 0,
  };
}

export default async function AutopilotPage(props: PageProps<'/autopilot'>) {
  const params = await props.searchParams;
  const runIdParam = typeof params.run === 'string' ? params.run : undefined;
  const caseParam = typeof params.case === 'string' ? params.case : DEFAULT_CASE;

  const initialRun = await loadInitialRun(caseParam, runIdParam);
  // If a specific run was requested by ID, the dropdown should reflect that run's case.
  const effectiveCaseId = initialRun?.priorAuthId ?? caseParam;

  return (
    <AutopilotClient
      key={initialRun?.id ?? `fresh-${effectiveCaseId}`}
      priorAuthId={effectiveCaseId}
      initialRun={initialRun}
    />
  );
}
