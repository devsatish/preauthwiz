import { z } from 'zod';

export const RiskScoringResultSchema = z.object({
  score: z.number().min(0).max(1),
  verdict: z.enum(['auto_approve_eligible', 'escalate_for_review', 'recommend_deny']),
  confidence: z.number().min(0).max(1),
  narrative: z.string(),
  blocking_issues: z.array(z.string()),
});

export type RiskScoringResult = z.infer<typeof RiskScoringResultSchema>;
export type Verdict = RiskScoringResult['verdict'];
