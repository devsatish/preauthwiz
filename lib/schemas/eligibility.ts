import { z } from 'zod';

export const EligibilityResultSchema = z.object({
  covered: z.boolean(),
  plan_name: z.string(),
  plan_type: z.enum(['HMO', 'PPO', 'POS', 'EPO', 'Medicare Advantage', 'Medicaid']),
  requires_prior_auth: z.boolean(),
  network_status: z.enum(['in_network', 'out_of_network', 'unknown']),
  notes: z.string(),
});

export type EligibilityResult = z.infer<typeof EligibilityResultSchema>;
