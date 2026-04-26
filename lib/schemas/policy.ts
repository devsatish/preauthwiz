import { z } from 'zod';

export const PolicyCriterionSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: z.enum(['required', 'alternative', 'exclusion']),
  source_excerpt: z.string(),
  source_chunk_id: z.string(),
  source_page: z.number(),
});

export const PolicyResearchResultSchema = z.object({
  policy_id: z.string(),
  policy_name: z.string(),
  payer: z.string(),
  last_updated: z.string(),
  criteria: z.array(PolicyCriterionSchema),
  excluded_indications: z.array(z.string()),
  // Self-reported extraction quality. Set to "low" when criteria is empty or
  // the agent could not confidently identify criteria text in retrieved chunks.
  extraction_confidence: z.enum(['high', 'low']).optional(),
  extraction_failure_reason: z.string().optional(),
});

export type PolicyCriterion = z.infer<typeof PolicyCriterionSchema>;
export type PolicyResearchResult = z.infer<typeof PolicyResearchResultSchema>;
