import { z } from 'zod';

export const RiskScoringResultSchema = z.object({
  score: z.number().refine(n => n >= 0 && n <= 1, 'must be between 0 and 1'),
  verdict: z.enum(['auto_approve_eligible', 'escalate_for_review', 'recommend_deny']),
  confidence: z.number().refine(n => n >= 0 && n <= 1, 'must be between 0 and 1'),
  narrative: z.string(),
  blocking_issues: z.array(z.string()),
});

export type RiskScoringResult = z.infer<typeof RiskScoringResultSchema>;
export type Verdict = RiskScoringResult['verdict'];
