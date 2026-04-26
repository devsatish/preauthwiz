export function riskScorerInstructions(
  score: number,
  verdict: string,
  criteriaCount: number,
  metCount: number,
  blockingIssues: string[],
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

Your task: Write 1-2 sentences of plain-English narrative explaining this score to the intake coordinator.
Be direct and clinical. Reference specific gaps or strengths in the evidence where relevant.
Do NOT change the score or verdict — those are deterministic outputs, not your judgment.

Return ONLY the narrative field as a JSON object: {"narrative": "..."}`;
}
