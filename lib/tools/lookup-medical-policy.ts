import { tool } from 'ai';
import { z } from 'zod';

export interface PolicyChunkResult {
  id: string;
  text: string;
  section_number: number | null;
  policy_id: string;
  similarity: number;
}

// Phase 2: returns realistic Aetna-style mock criteria.
// Phase 3 replaces this with real pgvector RAG against Neon.
export const lookupMedicalPolicy = tool({
  description: 'Retrieve relevant medical policy criteria for a payer and procedure code using semantic search',
  inputSchema: z.object({
    payer_id: z.string().describe('Payer ID (e.g., AETNA)'),
    cpt_code: z.string().describe('CPT/HCPCS procedure code'),
    query: z.string().describe('Semantic search query for relevant policy criteria'),
  }),
  execute: async ({ payer_id, cpt_code, query }): Promise<PolicyChunkResult[]> => {
    void query;

    if (payer_id === 'AETNA' && cpt_code === 'J0585') {
      return [
        {
          id: 'mock-chunk-001',
          policy_id: 'pol-aetna-0113',
          section_number: 1,
          similarity: 0.94,
          text: 'Aetna considers onabotulinumtoxinA (Botox) medically necessary for prophylaxis of chronic migraine (≥15 headache days per month, with headache lasting 4 hours a day or longer) in members who have tried and failed at least 2 adequate trials of preventive migraine medications from at least 2 different drug classes (e.g., beta-blockers, tricyclic antidepressants, anticonvulsants, or calcium channel blockers). Treatment should be initiated by or in consultation with a neurologist or headache specialist.',
        },
        {
          id: 'mock-chunk-002',
          policy_id: 'pol-aetna-0113',
          section_number: 2,
          similarity: 0.91,
          text: 'Chronic migraine is defined as headache occurring on 15 or more days per month for more than 3 months, with features of migraine headache on at least 8 days per month. Documentation must include a headache diary or equivalent evidence establishing the frequency and duration of headaches for at least 3 consecutive months prior to the request.',
        },
        {
          id: 'mock-chunk-003',
          policy_id: 'pol-aetna-0113',
          section_number: 3,
          similarity: 0.88,
          text: 'Dosing: OnabotulinumtoxinA should be administered according to the PREEMPT injection protocol: 155 units injected intramuscularly across 31 fixed-site injections in 7 head and neck muscle areas, repeated every 12 weeks. Total cumulative dose per treatment cycle must not exceed 400 units in any 84-day period.',
        },
        {
          id: 'mock-chunk-004',
          policy_id: 'pol-aetna-0113',
          section_number: 4,
          similarity: 0.85,
          text: 'Contraindications and exclusions: Aetna considers onabotulinumtoxinA not medically necessary for episodic migraine (<15 headache days/month), tension-type headache, or other headache types not meeting ICHD-3 criteria for chronic migraine. Treatment is considered not medically necessary if the member has not completed at least two adequate preventive medication trials of sufficient dose and duration (typically ≥6 weeks).',
        },
        {
          id: 'mock-chunk-005',
          policy_id: 'pol-aetna-0113',
          section_number: 5,
          similarity: 0.82,
          text: 'Authorization period: Initial authorization is for 2 treatment cycles (24 weeks). Reauthorization requires documentation of ≥50% reduction in headache days or ≥50% improvement on a validated migraine disability scale (e.g., MIDAS or HIT-6). If no meaningful response after 2 cycles, onabotulinumtoxinA should be discontinued.',
        },
      ];
    }

    return [
      {
        id: 'mock-chunk-generic-001',
        policy_id: `pol-${payer_id.toLowerCase()}-generic`,
        section_number: 1,
        similarity: 0.75,
        text: `${payer_id} medical policy for CPT ${cpt_code}: Medical necessity criteria require documented clinical indication, prior treatment failure where applicable, and ordering provider attestation. Coverage subject to benefit plan terms.`,
      },
    ];
  },
});
