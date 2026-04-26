import type { ChartAbstractionResult } from '@/lib/schemas/evidence';

function summarizeEvidence(
  evidence_by_criterion: ChartAbstractionResult['evidence_by_criterion'],
): string {
  if (evidence_by_criterion.length === 0) return '(no evidence supplied)';
  return evidence_by_criterion
    .map(c => {
      const sources = c.evidence
        .map(e => `${e.source_type}:${e.source_id}`)
        .join(', ') || '(no sources)';
      return `- ${c.criterion_id} [met=${c.met}]: ${c.reasoning} (sources: ${sources})`;
    })
    .join('\n');
}

export function riskScorerInstructions(
  score: number,
  verdict: string,
  criteriaCount: number,
  metCount: number,
  blockingIssues: string[],
  evidence_by_criterion: ChartAbstractionResult['evidence_by_criterion'],
): string {
  const verdictLabel =
    verdict === 'auto_approve_eligible'
      ? 'likely to be approved'
      : verdict === 'escalate_for_review'
        ? 'borderline — requires clinical review'
        : 'likely to be denied';

  return `You are a clinical prior authorization risk analyst.

The deterministic scoring engine has computed the following for this prior auth request:
- Approval probability score: ${(score * 100).toFixed(0)}% (${score.toFixed(3)})
- Verdict: ${verdict} (${verdictLabel})
- Criteria met: ${metCount} of ${criteriaCount} required criteria
${blockingIssues.length > 0 ? `- Blocking issues: ${blockingIssues.join('; ')}` : '- No blocking issues'}

Chart-grounded evidence from the chart abstractor (per criterion):
${summarizeEvidence(evidence_by_criterion)}

Your task: Write 1-2 sentences of plain-English narrative explaining this score to the intake coordinator.

Grounding rules — these are not optional:
- Every clinical claim you make MUST be supported by the chart-grounded evidence above.
- Do NOT invent or infer clinical facts that are not present in the evidence (no fabricated diagnoses, headache counts, medication trials, durations, doses, or specialist consults).
- If a blocking issue's clinical premise is NOT supported by the evidence, do NOT restate the premise as fact. Instead, defer with phrasing like "see chart abstractor's findings" or "the deterministic scorer flagged this exclusion; chart evidence does not corroborate".
- Be direct and clinical. Reference the criterion IDs (e.g., C2, C8) and source types when useful.
- Do NOT change the score or verdict — those are deterministic outputs, not your judgment.

Return ONLY the narrative field as a JSON object: {"narrative": "..."}`;
}
