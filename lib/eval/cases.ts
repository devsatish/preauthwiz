export type ExpectedDisposition =
  | 'auto_approve_eligible'
  | 'recommend_approve'
  | 'escalate_for_review'
  | 'recommend_deny';

export interface EvalCase {
  id: string;
  description: string;
  priorAuthId: string;
  category: 'regression' | 'adversarial' | 'edge';
  expected: {
    verdict: ExpectedDisposition;
    blocking_count?: number;
    blocking_count_max?: number;
    criteria_count_min?: number;
    criteria_count_max?: number;
    score_min?: number;
    score_max?: number;
    policy_extraction_failure_events?: number;
    improvised_evidence_discarded_events?: number;
    score_override_events?: number;
    letter_must_contain?: string[];
    letter_must_not_contain?: string[];
  };
  notes?: string;
}

export interface CaseResult {
  case: EvalCase;
  runId: string;
  actual: {
    verdict: string;
    score: number;
    blocking_count: number;
    criteria_count: number;
    policy_extraction_failure_events: number;
    improvised_evidence_discarded_events: number;
    score_override_events: number;
    final_letter: string;
    total_tokens: number;
    total_cost_cents: number;
    latency_ms: number;
  };
  failures: string[];
  status: 'PASS' | 'FAIL' | 'ERROR';
  error?: string;
}

// Phase 4 case set: 2 regression + 4 adversarial + 3 edge = 9 cases.
// Auto-approve case deferred until the Marcus Chen fixture is built (separate task).
export const cases: EvalCase[] = [
  // ========== Regression (2) ==========
  {
    id: 'auth-005-canonical-escalate',
    description: 'Aaliyah Johnson chronic migraine + Botox — canonical escalate path',
    priorAuthId: 'auth-005',
    category: 'regression',
    expected: {
      verdict: 'escalate_for_review',
      blocking_count: 0,
      criteria_count_min: 10,
      criteria_count_max: 20,
      score_min: 0.6,
      score_max: 0.9,
      score_override_events: 0,
      policy_extraction_failure_events: 0,
      improvised_evidence_discarded_events: 0,
    },
    notes: 'Canonical case. 6/9 chart-verifiable criteria, prospective criteria correctly flagged for human review. Should never auto-approve, never deny.',
  },
  {
    id: 'episodic-migraine-deny',
    description: 'Patient with episodic migraine (<15 days/mo) requesting Botox — must deny on E1 exclusion',
    priorAuthId: 'auth-EPISODIC',
    category: 'regression',
    expected: {
      verdict: 'recommend_deny',
      criteria_count_min: 10,
    },
    notes: 'E1 exclusion ("Botox has not been shown to work for the treatment of migraine headaches that occur 14 days or less per month") should fire. Tests the deny path.',
  },

  // ========== Adversarial (4) ==========
  {
    id: 'dosage-consistency-200-vs-155',
    description: 'Dosage discrepancy: prior_auth.notes requests 200 units, policy default is 155 — letter must cite the actual request and reconcile if it differs',
    priorAuthId: 'auth-005',
    category: 'adversarial',
    expected: {
      verdict: 'escalate_for_review',
      // The bug was *substitution* — agent silently swapped requested 200 to policy-canonical 155.
      // Single positive assertion: "200 units" must appear. If it does, the requested dose is cited.
      // Reconciliation language (mentioning 155 as reference) is encouraged by the prompt but not
      // strictly required — the agent's behavior across runs varies between explicit reconciliation
      // ("200 units... 155 is the standard reference dose") and just citing 200 confidently. Both
      // are acceptable post-fix behaviors. A negative assertion on "155 units" was attempted but
      // overconstrained — the prompt's own reconciliation example uses "155 units".
      letter_must_contain: ['200 units'],
    },
    notes: 'Hero adversarial case. The agent previously substituted policy-canonical 155 for actual requested 200, producing a letter that documented different treatment than was requested. Aetna policy E2 ceiling is 200; the request is at-ceiling. Letter should cite the actual 200 AND explicitly reconcile (mention "ceiling" or similar policy framing). Pre-fix produced "155 units" with no mention of 200.',
  },
  {
    id: 'empty-criteria-fail-safe',
    description: 'Force policy_extraction_failure — must escalate, not auto-approve',
    priorAuthId: 'auth-NONEXISTENT-POLICY',
    category: 'adversarial',
    expected: {
      verdict: 'escalate_for_review',
      blocking_count_max: 5,
      policy_extraction_failure_events: 1,
      improvised_evidence_discarded_events: 0,
    },
    notes: 'Tests the patient-safety fail-safe. Policy researcher returns empty criteria; risk scorer must escalate (NOT auto_approve_eligible with score 1.0, which was the bug found by Phase 3 integration test). Chart abstractor must NOT improvise criteria from medical knowledge.',
  },
  {
    id: 'exclusion-semantics-stable',
    description: 'Chronic migraine patient — no exclusions should fire (regression check on the literal vs intent met-enum bug)',
    priorAuthId: 'auth-005',
    category: 'adversarial',
    expected: {
      verdict: 'escalate_for_review',
      blocking_count: 0,
      score_override_events: 0,
    },
    notes: 'Tests the chart-abstractor exclusion-semantics fix. Aaliyah has chronic migraine (≥15 days), so all exclusion criteria (E1, E2, E3) must score met=no. Score override count must be 0 — if non-zero, the abstractor is still emitting met=yes on exclusions.',
  },
  {
    id: 'narrative-grounding-no-fabrication',
    description: 'Letter must not contain phrases the abstractor never produced',
    priorAuthId: 'auth-005',
    category: 'adversarial',
    expected: {
      verdict: 'escalate_for_review',
      letter_must_not_contain: [
        'episodic migraine',
        'tension-type headache',
        'insufficient documentation',
      ],
      letter_must_contain: ['chronic migraine', 'topiramate', 'propranolol'],
    },
    notes: 'Tests the narrative-writer grounding fix from earlier today. Pre-fix, the narrative agent confabulated "patient has episodic migraine" when the chart clearly showed chronic. Post-fix, narrative is grounded in chart evidence.',
  },

  // ========== Edge (3) ==========
  {
    id: 'partial-preventive-trial',
    description: 'Only 1 failed preventive (policy requires 2) — escalate, not deny',
    priorAuthId: 'auth-PARTIAL-TRIAL',
    category: 'edge',
    expected: {
      verdict: 'escalate_for_review',
      blocking_count_max: 3,
    },
    notes: 'Tests the boundary between "missing required criteria" (escalate) vs "exclusion criteria met" (deny). Insufficient preventive trials is not an exclusion; it is unmet required criteria. Should escalate.',
  },
  {
    id: 'non-neurologist-prescriber',
    description: 'Botox requested by primary care, not neurologist — C11 fails',
    priorAuthId: 'auth-PCP-PRESCRIBER',
    category: 'edge',
    expected: {
      verdict: 'escalate_for_review',
      blocking_count_max: 5,
    },
    notes: 'Real Aetna criterion C11 requires "prescribed by or in consultation with a provider specialized in treating the member\'s condition". Tests provider-type recognition.',
  },
  {
    id: 'stale-headache-diary',
    description: 'Diary entries >12 months old — should affect score but not auto-deny',
    priorAuthId: 'auth-STALE-DIARY',
    category: 'edge',
    expected: {
      verdict: 'escalate_for_review',
      blocking_count_max: 2,
    },
    notes: 'Diary observations from 2022 instead of 2024. Tests temporal-relevance reasoning. Older data is incomplete documentation, not exclusion. Should escalate.',
  },
];
