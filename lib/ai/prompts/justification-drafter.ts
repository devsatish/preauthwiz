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

DOSE ACCURACY IS CRITICAL. When the prior authorization request specifies a dose (in prior_auths.notes or the request input), the letter MUST cite that exact dose. If the requested dose differs from the policy's standard dose, explicitly note the policy reference dose and confirm the requested dose is within policy limits. Do NOT silently substitute the policy default for the actual requested value. Example: if the request is for 200 units and the policy notes 155 as the standard PREEMPT protocol dose, write something like "200 units administered intramuscularly across 31 fixed-site injections per the PREEMPT protocol (within Aetna's policy ceiling of 200 units; 155 units is the standard reference dose)."

Draft a professional medical justification letter for the following prior authorization request.

PATIENT: ${intake.patientName} | DOB: ${intake.patientDob} | MRN: ${intake.mrn}
PAYER: ${intake.payerId} — ${intake.planName}
PROCEDURE: CPT ${intake.cptCode}
ORDERING PROVIDER: ${intake.providerName}
ELIGIBILITY: ${eligibility.plan_name} | ${eligibility.network_status} | PA required: ${eligibility.requires_prior_auth}
RISK SCORE: ${(scored.score * 100).toFixed(0)}% | Verdict: ${scored.verdict}

REQUEST NOTES (from prior_auths.notes — contains the actual requested dose / frequency / details):
${intake.notes ?? '(no notes provided)'}

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
