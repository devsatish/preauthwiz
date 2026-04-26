import type { CaseResult, EvalCase } from './cases';
import { runChecks } from './checks';

interface AuthRunRow {
  id: string;
  verdict: string | null;
  startedAt: Date;
  completedAt: Date | null;
  totalTokens: number | null;
  totalCostCents: string | null;
  finalLetter: string | null;
  finalVerdict: Record<string, unknown> | null;
}

interface AuthRunEventRow {
  subagent: string;
  status: string;
  output: Record<string, unknown> | null;
}

function emptyActual(): CaseResult['actual'] {
  return {
    verdict: '',
    score: 0,
    blocking_count: 0,
    criteria_count: 0,
    policy_extraction_failure_events: 0,
    improvised_evidence_discarded_events: 0,
    score_override_events: 0,
    final_letter: '',
    total_tokens: 0,
    total_cost_cents: 0,
    latency_ms: 0,
  };
}

export async function runCase(c: EvalCase): Promise<CaseResult> {
  // Dynamic imports so dotenv (loaded by main.ts) is in effect before db client init.
  const { runOrchestrator } = await import('@/lib/agents/orchestrator');
  const { db } = await import('@/lib/db/client');
  const { authRuns, authRunEvents } = await import('@/lib/db/schema');
  const { eq, and } = await import('drizzle-orm');

  let runId = '';
  try {
    const result = await runOrchestrator(c.priorAuthId, () => {
      // No-op: harness doesn't consume SSE; it queries the DB for ground truth.
    });
    runId = result.runId;
  } catch (err) {
    return {
      case: c,
      runId,
      actual: emptyActual(),
      failures: [],
      status: 'ERROR',
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Pull the persisted run + events. Source of truth is the DB, not the in-memory result.
  const runRows = (await db.select().from(authRuns).where(eq(authRuns.id, runId)).limit(1)) as AuthRunRow[];
  const run = runRows[0];
  if (!run) {
    return {
      case: c,
      runId,
      actual: emptyActual(),
      failures: [],
      status: 'ERROR',
      error: `runId ${runId} not found in auth_runs after orchestrator returned`,
    };
  }

  const fv = (run.finalVerdict ?? {}) as { score?: number; blocking_issues?: unknown[] };

  // Policy researcher's last agent_completed event holds the criteria array.
  const polRows = (await db
    .select()
    .from(authRunEvents)
    .where(
      and(
        eq(authRunEvents.runId, runId),
        eq(authRunEvents.subagent, 'policyResearcher'),
        eq(authRunEvents.status, 'agent_completed'),
      ),
    )) as AuthRunEventRow[];
  const policyOutput = (polRows[0]?.output ?? {}) as { criteria?: unknown[] };
  const criteria_count = Array.isArray(policyOutput.criteria) ? policyOutput.criteria.length : 0;

  // Three telemetry event counts.
  const overrideRows = (await db
    .select()
    .from(authRunEvents)
    .where(and(eq(authRunEvents.runId, runId), eq(authRunEvents.status, 'score_override')))) as AuthRunEventRow[];
  const failureRows = (await db
    .select()
    .from(authRunEvents)
    .where(and(eq(authRunEvents.runId, runId), eq(authRunEvents.status, 'policy_extraction_failure')))) as AuthRunEventRow[];
  const improvisedRows = (await db
    .select()
    .from(authRunEvents)
    .where(and(eq(authRunEvents.runId, runId), eq(authRunEvents.status, 'improvised_evidence_discarded')))) as AuthRunEventRow[];

  const latency_ms = run.completedAt ? run.completedAt.getTime() - run.startedAt.getTime() : 0;

  const actual: CaseResult['actual'] = {
    verdict: run.verdict ?? '',
    score: typeof fv.score === 'number' ? fv.score : 0,
    blocking_count: Array.isArray(fv.blocking_issues) ? fv.blocking_issues.length : 0,
    criteria_count,
    policy_extraction_failure_events: failureRows.length,
    improvised_evidence_discarded_events: improvisedRows.length,
    score_override_events: overrideRows.length,
    final_letter: run.finalLetter ?? '',
    total_tokens: run.totalTokens ?? 0,
    total_cost_cents: Number(run.totalCostCents ?? 0),
    latency_ms,
  };

  const failures = runChecks(c, actual);
  return {
    case: c,
    runId,
    actual,
    failures,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
  };
}

export async function runAll(
  cases: EvalCase[],
  opts: { concurrency?: number } = {},
): Promise<CaseResult[]> {
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 1, 3));
  const results: CaseResult[] = new Array(cases.length);
  let next = 0;

  async function worker() {
    while (true) {
      const idx = next++;
      if (idx >= cases.length) return;
      const c = cases[idx];
      console.error(`[${idx + 1}/${cases.length}] ${c.id} (${c.priorAuthId})`);
      const t = Date.now();
      results[idx] = await runCase(c);
      console.error(`  → ${results[idx].status} in ${((Date.now() - t) / 1000).toFixed(1)}s`);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}
