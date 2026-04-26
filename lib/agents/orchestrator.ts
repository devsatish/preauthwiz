import { db } from '@/lib/db/client';
import { authRuns, authRunEvents, priorAuths, patients, providers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { LanguageModelUsage } from 'ai';
import { eligibilitySpecialist } from './eligibility-specialist';
import { policyResearcher } from './policy-researcher';
import { createChartAbstractor } from './chart-abstractor';
import { computeScore, runRiskScorer } from './risk-scorer';
import { createJustificationDrafter } from './justification-drafter';
import type { TraceEvent } from '@/lib/schemas/trace';
import type { Intake } from '@/lib/schemas/patient';
import type { EligibilityResult } from '@/lib/schemas/eligibility';
import type { PolicyResearchResult } from '@/lib/schemas/policy';
import type { ChartAbstractionResult } from '@/lib/schemas/evidence';
import type { RiskScoringResult } from '@/lib/schemas/verdict';
import { computeCost, type UsageBreakdown } from '@/lib/ai/pricing';

const AGENT_MODEL: Record<string, string> = {
  eligibilitySpecialist: 'claude-haiku-4-5',
  policyResearcher: 'claude-sonnet-4-5',
  chartAbstractor: 'claude-sonnet-4-5',
  riskScorer: 'claude-haiku-4-5',
  justificationDrafter: 'claude-sonnet-4-5',
};

function emptyUsage(): UsageBreakdown {
  return { uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 };
}

function tally(target: UsageBreakdown, usage: LanguageModelUsage): void {
  const inputTotal = usage.inputTokens ?? 0;
  const cacheRead = usage.inputTokenDetails?.cacheReadTokens ?? 0;
  const cacheWrite = usage.inputTokenDetails?.cacheWriteTokens ?? 0;
  // Prefer the SDK's noCacheTokens when present; otherwise derive from total.
  const uncached =
    usage.inputTokenDetails?.noCacheTokens ??
    Math.max(0, inputTotal - cacheRead - cacheWrite);
  target.uncachedInputTokens += uncached;
  target.cacheReadTokens += cacheRead;
  target.cacheWriteTokens += cacheWrite;
  target.outputTokens += usage.outputTokens ?? 0;
}

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
  const agentUsage: Record<string, UsageBreakdown> = {};
  function usageOf(agent: string): UsageBreakdown {
    return (agentUsage[agent] ??= emptyUsage());
  }

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
        cacheCreationTokens: event.type === 'agent_completed' ? (event.cache_creation_tokens ?? 0) : 0,
        cacheReadTokens: event.type === 'agent_completed' ? (event.cache_read_tokens ?? 0) : 0,
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
        tally(usageOf('eligibilitySpecialist'), usage);
      },
    }),
    policyResearcher.generate({
      prompt: `Research prior authorization policy for payer ${intake.payerId}, CPT code ${intake.cptCode}. Query: medical necessity criteria for prior auth approval.`,
      onStepFinish: async ({ usage }) => {
        tally(usageOf('policyResearcher'), usage);
      },
    }),
  ]);

  const t1Latency = Date.now() - t1;
  const eligibility = eligibilityResult.output as EligibilityResult;
  const policy = policyResult.output as PolicyResearchResult;

  const elig = usageOf('eligibilitySpecialist');
  await emitEvent({
    type: 'agent_completed',
    subagent: 'eligibilitySpecialist',
    model: 'claude-haiku-4-5',
    latency_ms: t1Latency,
    input_tokens: elig.uncachedInputTokens,
    output_tokens: elig.outputTokens,
    cache_read_tokens: elig.cacheReadTokens,
    cache_creation_tokens: elig.cacheWriteTokens,
    output: eligibility,
    timestamp: new Date().toISOString(),
  });

  const polr = usageOf('policyResearcher');
  await emitEvent({
    type: 'agent_completed',
    subagent: 'policyResearcher',
    model: 'claude-sonnet-4-5',
    latency_ms: t1Latency,
    input_tokens: polr.uncachedInputTokens,
    output_tokens: polr.outputTokens,
    cache_read_tokens: polr.cacheReadTokens,
    cache_creation_tokens: polr.cacheWriteTokens,
    output: policy,
    timestamp: new Date().toISOString(),
  });

  // Stage 3 — depends on policy criteria. Per-patient factory inlines the FHIR
  // bundle as a cached system block (see chart-abstractor.ts) so warm runs
  // avoid re-paying for the bundle's input tokens.
  emitEvent({ type: 'agent_started', subagent: 'chartAbstractor', model: 'claude-sonnet-4-5', timestamp: new Date().toISOString() });
  const t3 = Date.now();
  const criteriaText = policy.criteria
    .map(c => `${c.id} (${c.type}): ${c.text}`)
    .join('\n');

  const chartAbstractor = createChartAbstractor(intake.patientId);
  const chartResult = await chartAbstractor.generate({
    prompt: `Patient ID: ${intake.patientId}\n\nPolicy criteria to evaluate:\n${criteriaText}\n\nSearch the patient chart and assess evidence for each criterion.`,
    onStepFinish: async ({ usage }) => {
      tally(usageOf('chartAbstractor'), usage);
    },
  });

  const evidence = chartResult.output as ChartAbstractionResult;
  const chart = usageOf('chartAbstractor');
  await emitEvent({
    type: 'agent_completed',
    subagent: 'chartAbstractor',
    model: 'claude-sonnet-4-5',
    latency_ms: Date.now() - t3,
    input_tokens: chart.uncachedInputTokens,
    output_tokens: chart.outputTokens,
    cache_read_tokens: chart.cacheReadTokens,
    cache_creation_tokens: chart.cacheWriteTokens,
    output: evidence,
    timestamp: new Date().toISOString(),
  });

  // Stage 4 — deterministic scoring + Haiku narrative
  emitEvent({ type: 'agent_started', subagent: 'riskScorer', model: 'claude-haiku-4-5', timestamp: new Date().toISOString() });
  const t4 = Date.now();
  const { score, verdict, blocking_issues, met_count, score_overrides } = computeScore(
    policy.criteria,
    evidence.evidence_by_criterion,
  );

  // Persist any defensive overrides as telemetry — Phase 4 will use these as eval signals.
  for (const ov of score_overrides) {
    await db
      .insert(authRunEvents)
      .values({
        runId,
        subagent: 'riskScorer',
        status: 'score_override',
        output: { type: 'score_override', ...ov },
      })
      .catch(() => {
        // Non-fatal — observability errors must not abort the run.
      });
  }

  const scored = await runRiskScorer(
    score,
    verdict,
    policy.criteria,
    met_count,
    blocking_issues,
    evidence.evidence_by_criterion,
    (usage) => {
      tally(usageOf('riskScorer'), usage);
    },
  );

  const risk = usageOf('riskScorer');
  await emitEvent({
    type: 'agent_completed',
    subagent: 'riskScorer',
    model: 'claude-haiku-4-5',
    latency_ms: Date.now() - t4,
    input_tokens: risk.uncachedInputTokens,
    output_tokens: risk.outputTokens,
    cache_read_tokens: risk.cacheReadTokens,
    cache_creation_tokens: risk.cacheWriteTokens,
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
  tally(usageOf('justificationDrafter'), drafterUsage);

  const draft = usageOf('justificationDrafter');
  await emitEvent({
    type: 'agent_completed',
    subagent: 'justificationDrafter',
    model: 'claude-sonnet-4-5',
    latency_ms: Date.now() - t5,
    input_tokens: draft.uncachedInputTokens,
    output_tokens: draft.outputTokens,
    cache_read_tokens: draft.cacheReadTokens,
    cache_creation_tokens: draft.cacheWriteTokens,
    timestamp: new Date().toISOString(),
  });

  const totalLatency = Date.now() - startTime;
  // Per-agent cost: Haiku and Sonnet have different rates, and cache reads/writes
  // are billed at 0.10x / 1.25x of base input. Sum across agents.
  let totalCostCents = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheWriteTokens = 0;
  for (const [agent, usage] of Object.entries(agentUsage)) {
    totalCostCents += computeCost(AGENT_MODEL[agent] ?? 'claude-sonnet-4-5', usage);
    totalInputTokens += usage.uncachedInputTokens;
    totalOutputTokens += usage.outputTokens;
    totalCacheReadTokens += usage.cacheReadTokens;
    totalCacheWriteTokens += usage.cacheWriteTokens;
  }
  const totalTokens =
    totalInputTokens + totalOutputTokens + totalCacheReadTokens + totalCacheWriteTokens;

  const finalVerdict = {
    verdict: scored.verdict,
    score: scored.score,
    confidence: scored.confidence,
    blocking_issues: scored.blocking_issues,
    narrative: scored.narrative,
    total_tokens: totalTokens,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    total_cache_read_tokens: totalCacheReadTokens,
    total_cache_creation_tokens: totalCacheWriteTokens,
    total_cost_cents: totalCostCents,
    latency_ms: totalLatency,
  };

  // Update run record
  await db
    .update(authRuns)
    .set({
      status: 'completed',
      verdict: scored.verdict,
      confidence: String(scored.confidence),
      completedAt: new Date(),
      totalTokens,
      totalCostCents: String(totalCostCents),
      finalLetter: letter,
      finalVerdict,
    })
    .where(eq(authRuns.id, runId));

  onEvent({
    type: 'run_completed',
    runId,
    verdict: scored.verdict,
    total_tokens: totalTokens,
    total_cost_cents: totalCostCents,
    latency_ms: totalLatency,
    timestamp: new Date().toISOString(),
  });

  return { eligibility, policy, evidence, scored, letter, runId };
}
