import type { Intake } from '@/lib/schemas/patient';
import type { EligibilityResult } from '@/lib/schemas/eligibility';
import type { PolicyResearchResult } from '@/lib/schemas/policy';
import type { ChartAbstractionResult } from '@/lib/schemas/evidence';
import type { RiskScoringResult } from '@/lib/schemas/verdict';

export function justificationDrafterInstructions(
  intake: Intake,
  eligibility: EligibilityResult,
  policy: PolicyResearchResult,
  evidence: ChartAbstractionResult,
  scored: RiskScoringResult,
): string {
  const criteriaList = policy.criteria
    .filter(c => c.type !== 'exclusion')
    .map(c => `  ${c.id}: ${c.text}`)
    .join('\n');

  const evidenceSummary = evidence.evidence_by_criterion
    .map(e => `  ${e.criterion_id}: ${e.met} — ${e.reasoning}`)
    .join('\n');

  return `You are a medical necessity letter writer for Meridian Health's prior authorization team.

Draft a professional medical justification letter for the following prior authorization request.

PATIENT: ${intake.patientName} | DOB: ${intake.patientDob} | MRN: ${intake.mrn}
PAYER: ${intake.payerId} — ${intake.planName}
PROCEDURE: CPT ${intake.cptCode}
ORDERING PROVIDER: ${intake.providerName}
ELIGIBILITY: ${eligibility.plan_name} | ${eligibility.network_status} | PA required: ${eligibility.requires_prior_auth}
RISK SCORE: ${(scored.score * 100).toFixed(0)}% | Verdict: ${scored.verdict}

POLICY CRITERIA:
${criteriaList}

EVIDENCE SUMMARY:
${evidenceSummary}

INSTRUCTIONS:
1. Write a formal prior authorization justification letter addressed to ${intake.payerId} Medical Review.
2. Structure: Introduction → Patient Background → Clinical Necessity (criterion by criterion) → Conclusion.
3. For EVERY clinical claim, include an inline citation in this exact format: [CriterionID / ResourceType:source_id]
   Example: The patient has documented chronic migraine with 19 headache days per month [C1 / Observation:obs-headache-diary-003]
4. Use criterion IDs from: ${policy.criteria.map(c => c.id).join(', ')}
5. Use source IDs from the evidence — these are real FHIR resource IDs.
6. Write in formal clinical language appropriate for payer medical directors.
7. Length: 400-600 words.
8. Format in Markdown with clear section headers.

The letter should support the clinical case compellingly while citing only evidence that is documented in the chart.`;
}
