import type { CaseResult, EvalCase } from './cases';

type Actual = CaseResult['actual'];

export function checkVerdict(c: EvalCase, actual: Actual): string[] {
  if (actual.verdict !== c.expected.verdict) {
    return [`verdict: expected "${c.expected.verdict}", got "${actual.verdict}"`];
  }
  return [];
}

export function checkBlockingCount(c: EvalCase, actual: Actual): string[] {
  const failures: string[] = [];
  if (c.expected.blocking_count !== undefined && actual.blocking_count !== c.expected.blocking_count) {
    failures.push(`blocking_count: expected exactly ${c.expected.blocking_count}, got ${actual.blocking_count}`);
  }
  if (c.expected.blocking_count_max !== undefined && actual.blocking_count > c.expected.blocking_count_max) {
    failures.push(`blocking_count: expected ≤${c.expected.blocking_count_max}, got ${actual.blocking_count}`);
  }
  return failures;
}

export function checkCriteriaCount(c: EvalCase, actual: Actual): string[] {
  const failures: string[] = [];
  if (c.expected.criteria_count_min !== undefined && actual.criteria_count < c.expected.criteria_count_min) {
    failures.push(`criteria_count: expected ≥${c.expected.criteria_count_min}, got ${actual.criteria_count}`);
  }
  if (c.expected.criteria_count_max !== undefined && actual.criteria_count > c.expected.criteria_count_max) {
    failures.push(`criteria_count: expected ≤${c.expected.criteria_count_max}, got ${actual.criteria_count}`);
  }
  return failures;
}

export function checkScoreRange(c: EvalCase, actual: Actual): string[] {
  const failures: string[] = [];
  if (c.expected.score_min !== undefined && actual.score < c.expected.score_min) {
    failures.push(`score: expected ≥${c.expected.score_min}, got ${actual.score.toFixed(3)}`);
  }
  if (c.expected.score_max !== undefined && actual.score > c.expected.score_max) {
    failures.push(`score: expected ≤${c.expected.score_max}, got ${actual.score.toFixed(3)}`);
  }
  return failures;
}

export function checkEventCounts(c: EvalCase, actual: Actual): string[] {
  const failures: string[] = [];
  if (c.expected.score_override_events !== undefined && actual.score_override_events !== c.expected.score_override_events) {
    failures.push(`score_override_events: expected ${c.expected.score_override_events}, got ${actual.score_override_events}`);
  }
  if (
    c.expected.policy_extraction_failure_events !== undefined &&
    actual.policy_extraction_failure_events !== c.expected.policy_extraction_failure_events
  ) {
    failures.push(
      `policy_extraction_failure_events: expected ${c.expected.policy_extraction_failure_events}, got ${actual.policy_extraction_failure_events}`,
    );
  }
  if (
    c.expected.improvised_evidence_discarded_events !== undefined &&
    actual.improvised_evidence_discarded_events !== c.expected.improvised_evidence_discarded_events
  ) {
    failures.push(
      `improvised_evidence_discarded_events: expected ${c.expected.improvised_evidence_discarded_events}, got ${actual.improvised_evidence_discarded_events}`,
    );
  }
  return failures;
}

export function checkLetterContains(c: EvalCase, actual: Actual): string[] {
  if (!c.expected.letter_must_contain) return [];
  const lower = actual.final_letter.toLowerCase();
  const failures: string[] = [];
  for (const needle of c.expected.letter_must_contain) {
    if (!lower.includes(needle.toLowerCase())) {
      failures.push(`letter_must_contain: missing substring "${needle}"`);
    }
  }
  return failures;
}

export function checkLetterNotContains(c: EvalCase, actual: Actual): string[] {
  if (!c.expected.letter_must_not_contain) return [];
  const lower = actual.final_letter.toLowerCase();
  const failures: string[] = [];
  for (const needle of c.expected.letter_must_not_contain) {
    if (lower.includes(needle.toLowerCase())) {
      failures.push(`letter_must_not_contain: forbidden substring present "${needle}"`);
    }
  }
  return failures;
}

export function runChecks(c: EvalCase, actual: Actual): string[] {
  return [
    ...checkVerdict(c, actual),
    ...checkBlockingCount(c, actual),
    ...checkCriteriaCount(c, actual),
    ...checkScoreRange(c, actual),
    ...checkEventCounts(c, actual),
    ...checkLetterContains(c, actual),
    ...checkLetterNotContains(c, actual),
  ];
}
