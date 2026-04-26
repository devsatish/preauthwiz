import { db } from '@/lib/db/client';
import { authRuns, authRunEvents, priorAuths, patients, providers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { eligibilitySpecialist } from './eligibility-specialist';
import { policyResearcher } from './policy-researcher';
import { chartAbstractor } from './chart-abstractor';
import { computeScore, runRiskScorer } from './risk-scorer';
import { createJustificationDrafter } from './justification-drafter';
import type { TraceEvent } from '@/lib/schemas/trace';
import type { Intake } from '@/lib/schemas/patient';
import type { EligibilityResult } from '@/lib/schemas/eligibility';
import type { PolicyResearchResult } from '@/lib/schemas/policy';
import type { ChartAbstractionResult } from '@/lib/schemas/evidence';
import type { RiskScoringResult } from '@/lib/schemas/verdict';
import { computeCost } from '@/lib/ai/pricing';

export interface OrchestratorResult {
  eligibility: EligibilityResult;
  policy: PolicyResearchResult;
  evidence: ChartAbstractionResult;
  scored: RiskScoringResult;
  letter: string;
  runId: string;
}

async function loadIntake(priorAuthId: string): Promise<Intake> {
  const rows = await db
    .select()
    .from(priorAuths)
    .innerJoin(patients, eq(priorAuths.patientId, patients.id))
    .innerJoin(providers, eq(priorAuths.providerId, providers.id))
    .where(eq(priorAuths.id, priorAuthId))
    .limit(1);

  if (rows.length === 0) throw new Error(`Prior auth not found: ${priorAuthId}`);
  const { prior_auths: pa, patients: pt, providers: pv } = rows[0];

  return {
    priorAuthId: pa.id,
    patientId: pt.id,
    patientName: `${pt.firstName} ${pt.lastName}`,
    patientDob: pt.dob,
    patientSex: pt.sex,
    planId: pt.planId,
    planName: pt.planName,
    payerId: pt.payerId,
    providerId: pv.id,
    providerName: pv.name,
    cptCode: pa.cptCode,
    dxCodes: pa.dxCodes,
    mrn: pt.mrn,
  };
}

export async function runOrchestrator(
  priorAuthId: string,
  onEvent: (e: TraceEvent) => void,
): Promise<OrchestratorResult> {
  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startTime = Date.now();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Persist run record
  await db.insert(authRuns).values({
    id: runId,
    priorAuthId,
    status: 'running',
  });

  async function emitEvent(event: TraceEvent) {
    onEvent(event);
    if (
      event.type === 'agent_completed' ||
      event.type === 'tool_called' ||
      event.type === 'tool_result'
    ) {
      await db.insert(authRunEvents).values({
        runId,
        subagent: event.subagent,
        status: event.type,
        input: event.type === 'tool_called' ? (event.input as Record<string, unknown>) : null,
        output: event.type === 'agent_completed' ? (event.output as Record<string, unknown>) : null,
        model: event.type === 'agent_completed' ? event.model : null,
        latencyMs: event.type === 'agent_completed' ? event.latency_ms : null,
        inputTokens: event.type === 'agent_completed' ? event.input_tokens : null,
        outputTokens: event.type === 'agent_completed' ? event.output_tokens : null,
      }).catch(() => {
        // Non-fatal — don't fail the run on observability errors
      });
    }
  }

  const intake = await loadIntake(priorAuthId);

  // Stage 1 & 2 in parallel
  emitEvent({ type: 'agent_started', subagent: 'eligibilitySpecialist', model: 'claude-haiku-4-5', timestamp: new Date().toISOString() });
  emitEvent({ type: 'agent_started', subagent: 'policyResearcher', model: 'claude-sonnet-4-5', timestamp: new Date().toISOString() });

  const t1 = Date.now();
  const [eligibilityResult, policyResult] = await Promise.all([
    eligibilitySpecialist.generate({
      prompt: `Check eligibility for patient ${intake.patientId}, payer ${intake.payerId}, CPT code ${intake.cptCode}.`,
      onStepFinish: async ({ usage }) => {
        totalInputTokens += usage.inputTokens ?? 0;
        totalOutputTokens += usage.outputTokens ?? 0;
      },
    }),
    policyResearcher.generate({
      prompt: `Research prior authorization policy for payer ${intake.payerId}, CPT code ${intake.cptCode}. Query: medical necessity criteria for prior auth approval.`,
      onStepFinish: async ({ usage }) => {
        totalInputTokens += usage.inputTokens ?? 0;
        totalOutputTokens += usage.outputTokens ?? 0;
      },
    }),
  ]);

  const t1Latency = Date.now() - t1;
  const eligibility = eligibilityResult.output as EligibilityResult;
  const policy = policyResult.output as PolicyResearchResult;

  await emitEvent({
    type: 'agent_completed',
    subagent: 'eligibilitySpecialist',
    model: 'claude-haiku-4-5',
    latency_ms: t1Latency,
    output: eligibility,
    timestamp: new Date().toISOString(),
  });

  await emitEvent({
    type: 'agent_completed',
    subagent: 'policyResearcher',
    model: 'claude-sonnet-4-5',
    latency_ms: t1Latency,
    output: policy,
    timestamp: new Date().toISOString(),
  });

  // Stage 3 — depends on policy criteria
  emitEvent({ type: 'agent_started', subagent: 'chartAbstractor', model: 'claude-sonnet-4-5', timestamp: new Date().toISOString() });
  const t3 = Date.now();
  const criteriaText = policy.criteria
    .map(c => `${c.id} (${c.type}): ${c.text}`)
    .join('\n');

  const chartResult = await chartAbstractor.generate({
    prompt: `Patient ID: ${intake.patientId}\n\nPolicy criteria to evaluate:\n${criteriaText}\n\nSearch the patient chart and assess evidence for each criterion.`,
    onStepFinish: async ({ usage }) => {
      totalInputTokens += usage.inputTokens ?? 0;
      totalOutputTokens += usage.outputTokens ?? 0;
    },
  });

  const evidence = chartResult.output as ChartAbstractionResult;
  await emitEvent({
    type: 'agent_completed',
    subagent: 'chartAbstractor',
    model: 'claude-sonnet-4-5',
    latency_ms: Date.now() - t3,
    output: evidence,
    timestamp: new Date().toISOString(),
  });

  // Stage 4 — deterministic scoring + Haiku narrative
  emitEvent({ type: 'agent_started', subagent: 'riskScorer', model: 'claude-haiku-4-5', timestamp: new Date().toISOString() });
  const t4 = Date.now();
  const { score, verdict, blocking_issues, met_count } = computeScore(policy.criteria, evidence.evidence_by_criterion);

  const scored = await runRiskScorer(
    score,
    verdict,
    policy.criteria,
    met_count,
    blocking_issues,
    (tokens) => {
      totalInputTokens += tokens.inputTokens;
      totalOutputTokens += tokens.outputTokens;
    },
  );

  await emitEvent({
    type: 'agent_completed',
    subagent: 'riskScorer',
    model: 'claude-haiku-4-5',
    latency_ms: Date.now() - t4,
    output: scored,
    timestamp: new Date().toISOString(),
  });

  // Stage 5 — streaming justification letter
  emitEvent({ type: 'agent_started', subagent: 'justificationDrafter', model: 'claude-sonnet-4-5', timestamp: new Date().toISOString() });
  const t5 = Date.now();
  const drafter = createJustificationDrafter(intake, eligibility, policy, evidence, scored);

  const streamResult = await drafter.stream({
    prompt: 'Draft the prior authorization justification letter based on the evidence and policy criteria.',
  });

  let letter = '';
  for await (const chunk of streamResult.textStream) {
    letter += chunk;
    onEvent({
      type: 'text_chunk',
      subagent: 'justificationDrafter',
      chunk,
      timestamp: new Date().toISOString(),
    });
  }

  const drafterUsage = await streamResult.usage;
  totalInputTokens += drafterUsage.inputTokens ?? 0;
  totalOutputTokens += drafterUsage.outputTokens ?? 0;

  await emitEvent({
    type: 'agent_completed',
    subagent: 'justificationDrafter',
    model: 'claude-sonnet-4-5',
    latency_ms: Date.now() - t5,
    input_tokens: drafterUsage.inputTokens,
    output_tokens: drafterUsage.outputTokens,
    timestamp: new Date().toISOString(),
  });

  const totalLatency = Date.now() - startTime;
  const totalCostCents = computeCost('claude-sonnet-4-5', totalInputTokens, totalOutputTokens);

  // Update run record
  await db
    .update(authRuns)
    .set({
      status: 'completed',
      verdict: scored.verdict,
      confidence: String(scored.confidence),
      completedAt: new Date(),
      totalTokens: totalInputTokens + totalOutputTokens,
      totalCostCents: String(totalCostCents),
    })
    .where(eq(authRuns.id, runId));

  onEvent({
    type: 'run_completed',
    verdict: scored.verdict,
    total_tokens: totalInputTokens + totalOutputTokens,
    total_cost_cents: totalCostCents,
    latency_ms: totalLatency,
    timestamp: new Date().toISOString(),
  });

  return { eligibility, policy, evidence, scored, letter, runId };
}
