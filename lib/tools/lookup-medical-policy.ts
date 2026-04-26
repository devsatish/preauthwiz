import { tool, embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { sql, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { policyChunks } from '@/lib/db/schema';

export interface PolicyChunkResult {
  id: string;
  text: string;
  section_number: number | null;
  section_title: string | null;
  policy_id: string;
  similarity: number;
}

// Payer → ingested policy_id allowlist. Vector search ranks across these IDs;
// the embedding model handles cross-indication relevance within the policy set.
// An explicitly-empty array (e.g., FAKEPAYER) means "we know about this payer
// but have no policies for it" — used by the Phase 4 eval to test the empty-criteria
// fail-safe path. Undefined payer falls through to genericFallback.
const PAYER_POLICIES: Record<string, string[]> = {
  AETNA: ['aetna-cpb-0113', 'aetna-cpb-0462'],
  FAKEPAYER: [],
};

const embeddingModel = openai.embedding('text-embedding-3-small');

// Generic fallback for payers without ingested policies — preserves the previous
// mock's "always-return-something" shape so unrelated PAs don't crash the orchestrator.
function genericFallback(payer_id: string, cpt_code: string): PolicyChunkResult[] {
  return [
    {
      id: `mock-chunk-${payer_id.toLowerCase()}-generic-001`,
      policy_id: `pol-${payer_id.toLowerCase()}-generic`,
      section_number: 1,
      section_title: null,
      similarity: 0.75,
      text: `${payer_id} medical policy for CPT ${cpt_code}: Medical necessity criteria require documented clinical indication, prior treatment failure where applicable, and ordering provider attestation. Coverage subject to benefit plan terms.`,
    },
  ];
}

export const lookupMedicalPolicy = tool({
  description: 'Retrieve relevant medical policy criteria for a payer and procedure code using semantic search over ingested policy chunks',
  inputSchema: z.object({
    payer_id: z.string().describe('Payer ID (e.g., AETNA)'),
    cpt_code: z.string().describe('CPT/HCPCS procedure code'),
    query: z.string().describe('Semantic search query for relevant policy criteria'),
  }),
  execute: async ({ payer_id, cpt_code, query }): Promise<PolicyChunkResult[]> => {
    const policyIds = PAYER_POLICIES[payer_id];
    if (policyIds === undefined) {
      return genericFallback(payer_id, cpt_code);
    }
    // Explicitly-empty payer (e.g., FAKEPAYER) → return no chunks.
    // Forces the policy researcher onto the empty-criteria fail-safe path.
    if (policyIds.length === 0) {
      return [];
    }

    const { embedding } = await embed({ model: embeddingModel, value: query });
    const queryVec = `[${embedding.join(',')}]`;

    // Query-builder form (not raw `sql\`... ANY(${array})\``): drizzle-orm splats
    // JS arrays into row constructors `($2, $3)` instead of binding as `text[]`,
    // which breaks the ANY() match. inArray() generates the right `IN (?, ?)` shape.
    const rows = await db
      .select({
        id: sql<string>`${policyChunks.id}::text`,
        policyId: policyChunks.policyId,
        sectionNumber: policyChunks.sectionNumber,
        sectionTitle: policyChunks.sectionTitle,
        text: policyChunks.text,
        similarity: sql<number>`1 - (${policyChunks.embedding} <=> ${queryVec}::vector)`,
      })
      .from(policyChunks)
      .where(inArray(policyChunks.policyId, policyIds))
      .orderBy(sql`${policyChunks.embedding} <=> ${queryVec}::vector`)
      .limit(8);

    return rows.map((r) => ({
      id: String(r.id),
      policy_id: String(r.policyId),
      section_number: r.sectionNumber === null ? null : Number(r.sectionNumber),
      section_title: r.sectionTitle === null ? null : String(r.sectionTitle),
      text: String(r.text),
      similarity: Number(r.similarity),
    }));
  },
});
