import { tool } from 'ai';
import { z } from 'zod';
import type { EligibilityResult } from '@/lib/schemas/eligibility';

export const checkEligibility = tool({
  description: 'Check patient insurance eligibility for a given CPT code and payer',
  inputSchema: z.object({
    patient_id: z.string().describe('Patient ID'),
    payer_id: z.string().describe('Payer ID (e.g., AETNA, UHC)'),
    cpt_code: z.string().describe('CPT/HCPCS procedure code'),
  }),
  execute: async ({ patient_id, payer_id, cpt_code }): Promise<EligibilityResult> => {
    // Canonical demo case: Aaliyah Johnson + Aetna + J0585
    if (patient_id === 'pat-003' && payer_id === 'AETNA' && cpt_code === 'J0585') {
      return {
        covered: true,
        plan_name: 'Aetna Open Access Select PPO',
        plan_type: 'PPO',
        requires_prior_auth: true,
        network_status: 'in_network',
        notes: 'J0585 OnabotulinumtoxinA covered under specialty drug benefit. Prior authorization required per plan formulary. In-network specialist confirmed (Dr. Emily Carter, NPI 1364728193). Policy reference: Aetna CPB 0113.',
      };
    }

    // Reasonable defaults for other combinations
    const coverageMap: Record<string, Partial<EligibilityResult>> = {
      AETNA: { covered: true, plan_type: 'PPO', network_status: 'in_network' },
      UHC: { covered: true, plan_type: 'PPO', network_status: 'in_network' },
      CIGNA: { covered: true, plan_type: 'PPO', network_status: 'unknown' },
      HUMANA: { covered: true, plan_type: 'HMO', network_status: 'in_network' },
      MEDICARE: { covered: true, plan_type: 'Medicare Advantage', network_status: 'in_network' },
      ANTHEM: { covered: true, plan_type: 'PPO', network_status: 'in_network' },
      BCBS: { covered: true, plan_type: 'PPO', network_status: 'in_network' },
    };

    const defaults = coverageMap[payer_id] ?? { covered: false, plan_type: 'PPO' as const, network_status: 'unknown' as const };

    return {
      covered: defaults.covered ?? false,
      plan_name: `${payer_id} Standard Plan`,
      plan_type: defaults.plan_type ?? 'PPO',
      requires_prior_auth: true,
      network_status: defaults.network_status ?? 'unknown',
      notes: `Coverage verified for CPT ${cpt_code}. Prior authorization required.`,
    };
  },
});
