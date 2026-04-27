import { db } from '@/lib/db/client';
import { authRuns, priorAuths, patients } from '@/lib/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { AutopilotClient, type InitialRun, type PriorAuthOption } from './_components/autopilot-client';

const DEFAULT_CASE = 'auth-005';

// Patients with full FHIR chart bundles in lib/data/charts/. Other auths can
// still be run, but the chart abstractor will return empty evidence — the
// dropdown marks demo-ready cases so the demo presenter can pick wisely.
const FULL_CHART_PATIENT_IDS = new Set(['pat-003', 'pat-009']);

async function loadPriorAuthOptions(): Promise<PriorAuthOption[]> {
  const rows = await db
    .select({
      authId: priorAuths.id,
      cptCode: priorAuths.cptCode,
      payerId: priorAuths.payerId,
      planName: priorAuths.planName,
      notes: priorAuths.notes,
      patientId: priorAuths.patientId,
      patientFirst: patients.firstName,
      patientLast: patients.lastName,
    })
    .from(priorAuths)
    .innerJoin(patients, eq(priorAuths.patientId, patients.id))
    // Same regex used on the auth-queue page: keep eval/test fixtures out.
    .where(sql`${priorAuths.id} ~ '^auth-[0-9]+$'`)
    .orderBy(priorAuths.id);

  return rows.map(r => {
    const hasChart = FULL_CHART_PATIENT_IDS.has(r.patientId);
    const procedure = r.notes ? r.notes.split(/[—-]/)[0].trim() : r.cptCode;
    return {
      id: r.authId,
      label: `${r.patientFirst} ${r.patientLast} — ${r.cptCode} ${procedure} — ${r.payerId}`,
      hasFullChart: hasChart,
    };
  });
}

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

  const [initialRun, options] = await Promise.all([
    loadInitialRun(caseParam, runIdParam),
    loadPriorAuthOptions(),
  ]);
  // If a specific run was requested by ID, the dropdown should reflect that run's case.
  const effectiveCaseId = initialRun?.priorAuthId ?? caseParam;

  return (
    <AutopilotClient
      key={initialRun?.id ?? `fresh-${effectiveCaseId}`}
      priorAuthId={effectiveCaseId}
      initialRun={initialRun}
      options={options}
    />
  );
}
