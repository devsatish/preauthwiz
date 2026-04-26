import { ToolLoopAgent, Output } from 'ai';
import { z } from 'zod';
import { haiku } from '@/lib/ai/models';
import type { PolicyResearchResult } from '@/lib/schemas/policy';
import type { ChartAbstractionResult } from '@/lib/schemas/evidence';
import type { RiskScoringResult, Verdict } from '@/lib/schemas/verdict';
import { riskScorerInstructions } from '@/lib/ai/prompts/risk-scorer';

// Deterministic scoring — no LLM math
export function computeScore(
  criteria: PolicyResearchResult['criteria'],
  evidenceByCriterion: ChartAbstractionResult['evidence_by_criterion'],
): { score: number; verdict: Verdict; blocking_issues: string[]; met_count: number } {
  const requiredCriteria = criteria.filter(c => c.type === 'required');
  const exclusionCriteria = criteria.filter(c => c.type === 'exclusion');

  // Check exclusions first — any match → score 0
  const blocking_issues: string[] = [];
  for (const excl of exclusionCriteria) {
    const ev = evidenceByCriterion.find(e => e.criterion_id === excl.id);
    if (ev && ev.met === 'yes') {
      blocking_issues.push(`Exclusion criterion ${excl.id} met: ${excl.text}`);
    }
  }
  if (blocking_issues.length > 0) {
    return { score: 0, verdict: 'recommend_deny', blocking_issues, met_count: 0 };
  }

  if (requiredCriteria.length === 0) {
    return { score: 1, verdict: 'auto_approve_eligible', blocking_issues: [], met_count: 0 };
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

  return { score, verdict, blocking_issues, met_count };
}

export async function runRiskScorer(
  score: number,
  verdict: Verdict,
  criteria: PolicyResearchResult['criteria'],
  met_count: number,
  blocking_issues: string[],
  onStepFinish?: (tokens: { inputTokens: number; outputTokens: number }) => void,
): Promise<RiskScoringResult> {
  const requiredCount = criteria.filter(c => c.type === 'required').length;

  const narrativeSchema = z.object({ narrative: z.string() });

  const agent = new ToolLoopAgent({
    model: haiku,
    instructions: riskScorerInstructions(score, verdict, requiredCount, met_count, blocking_issues),
    output: Output.object({ schema: narrativeSchema }),
  });

  const result = await agent.generate({
    prompt: 'Write the narrative explanation for this prior authorization risk assessment.',
    onStepFinish: onStepFinish
      ? async ({ usage }) => {
          onStepFinish({ inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 });
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
