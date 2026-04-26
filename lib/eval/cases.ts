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

// Phase 4 case set. Task 1 ships only the smoke test; Task 2 adds 8 more.
export const cases: EvalCase[] = [
  {
    id: 'auth-005-canonical-escalate',
    description: 'Aaliyah Johnson chronic migraine + Botox — canonical escalate path (smoke test)',
    priorAuthId: 'auth-005',
    category: 'regression',
    expected: {
      verdict: 'escalate_for_review',
      blocking_count: 0,
    },
    notes: 'Smoke test for harness wiring. Full assertion set lands in Task 2.',
  },
];
