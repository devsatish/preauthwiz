import { ToolLoopAgent, Output, type LanguageModelUsage } from 'ai';
import { z } from 'zod';
import { haiku } from '@/lib/ai/models';
import type { PolicyResearchResult } from '@/lib/schemas/policy';
import type { ChartAbstractionResult } from '@/lib/schemas/evidence';
import type { RiskScoringResult, Verdict } from '@/lib/schemas/verdict';
import { riskScorerInstructions } from '@/lib/ai/prompts/risk-scorer';

export interface ScoreOverride {
  criterion_id: string;
  original_met: string;
  new_met: string;
  reasoning_excerpt: string;
}

// Phrases the chart abstractor uses when it semantically means "the exclusion does NOT apply"
// while incorrectly emitting met="yes". Conservative — only matches unambiguous negation phrasing.
const EXCLUSION_AVOIDED_PATTERN = /(does not apply|exclusion avoided|exclusion criterion does not apply|criterion met \(exclusion avoided\))/i;

// Deterministic scoring — no LLM math
export function computeScore(
  criteria: PolicyResearchResult['criteria'],
  evidenceByCriterion: ChartAbstractionResult['evidence_by_criterion'],
): {
  score: number;
  verdict: Verdict;
  blocking_issues: string[];
  met_count: number;
  score_overrides: ScoreOverride[];
} {
  const requiredCriteria = criteria.filter(c => c.type === 'required');
  const exclusionCriteria = criteria.filter(c => c.type === 'exclusion');

  // Check exclusions first — any match → score 0
  const blocking_issues: string[] = [];
  const score_overrides: ScoreOverride[] = [];
  for (const excl of exclusionCriteria) {
    const ev = evidenceByCriterion.find(e => e.criterion_id === excl.id);
    if (ev && ev.met === 'yes') {
      // Defensive: if the chart abstractor's reasoning explicitly says the exclusion
      // does NOT apply, treat that as a met=no override rather than blocking the request.
      // Telemetry is emitted by the orchestrator from the returned score_overrides.
      if (ev.reasoning && EXCLUSION_AVOIDED_PATTERN.test(ev.reasoning)) {
        score_overrides.push({
          criterion_id: excl.id,
          original_met: 'yes',
          new_met: 'no',
          reasoning_excerpt: ev.reasoning.slice(0, 240),
        });
        continue;
      }
      blocking_issues.push(`Exclusion criterion ${excl.id} met: ${excl.text}`);
    }
  }
  if (blocking_issues.length > 0) {
    return { score: 0, verdict: 'recommend_deny', blocking_issues, met_count: 0, score_overrides };
  }

  if (requiredCriteria.length === 0) {
    // Fail-safe: zero required criteria almost always means upstream failure
    // (policy researcher couldn't extract criteria, no policy ingested for this payer/CPT, etc.).
    // Approving with no criteria to evaluate is a patient-safety regression — escalate instead.
    return {
      score: 0,
      verdict: 'escalate_for_review',
      blocking_issues: [
        'No policy criteria available — unable to verify medical necessity. Manual review required.',
      ],
      met_count: 0,
      score_overrides,
    };
  }

  let weighted = 0;
  let met_count = 0;
  for (const crit of requiredCriteria) {
    const ev = evidenceByCriterion.find(e => e.criterion_id === crit.id);
    const met = ev?.met ?? 'unknown';
    if (met === 'yes') {
      weighted += 1;
      met_count++;
    } else if (met === 'partial') {
      weighted += 0.5;
    }
    if (met === 'no') {
      blocking_issues.push(`Required criterion ${crit.id} not met: ${crit.text}`);
    }
  }

  const score = weighted / requiredCriteria.length;
  let verdict: Verdict;
  if (score >= 0.9) {
    verdict = 'auto_approve_eligible';
  } else if (score >= 0.6) {
    verdict = 'escalate_for_review';
  } else {
    verdict = 'recommend_deny';
  }

  return { score, verdict, blocking_issues, met_count, score_overrides };
}

export async function runRiskScorer(
  score: number,
  verdict: Verdict,
  criteria: PolicyResearchResult['criteria'],
  met_count: number,
  blocking_issues: string[],
  evidence_by_criterion: ChartAbstractionResult['evidence_by_criterion'],
  onStepFinish?: (usage: LanguageModelUsage) => void,
): Promise<RiskScoringResult> {
  const requiredCount = criteria.filter(c => c.type === 'required').length;

  const narrativeSchema = z.object({ narrative: z.string() });

  const agent = new ToolLoopAgent({
    model: haiku,
    instructions: riskScorerInstructions(
      score,
      verdict,
      requiredCount,
      met_count,
      blocking_issues,
      evidence_by_criterion,
    ),
    output: Output.object({ schema: narrativeSchema }),
  });

  const result = await agent.generate({
    prompt: 'Write the narrative explanation for this prior authorization risk assessment.',
    onStepFinish: onStepFinish
      ? async ({ usage }) => {
          onStepFinish(usage);
        }
      : undefined,
  });

  const narrative = result.output?.narrative ?? 'Risk assessment complete.';

  return {
    score,
    verdict,
    confidence: Math.min(score + 0.1, 1),
    narrative,
    blocking_issues,
  };
}
