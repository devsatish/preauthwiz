import { ToolLoopAgent, Output } from 'ai';
import { sonnet } from '@/lib/ai/models';
import { lookupMedicalPolicy } from '@/lib/tools/lookup-medical-policy';
import { PolicyResearchResultSchema } from '@/lib/schemas/policy';
import { policyResearcherInstructions } from '@/lib/ai/prompts/policy-researcher';

// Static instructions (~1,327 tokens after the Fix A rewrite — clears the 1024-token
// Sonnet caching floor). Wrapped as a SystemModelMessage with ephemeral cacheControl
// so warm runs read the prompt from cache instead of re-paying input tokens for it.
// Dynamic chunks from lookup_medical_policy tool calls remain uncached (vary per query).
export const policyResearcher = new ToolLoopAgent({
  model: sonnet,
  temperature: 0,
  instructions: [
    {
      role: 'system',
      content: policyResearcherInstructions(),
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' } } },
    },
  ],
  tools: { lookup_medical_policy: lookupMedicalPolicy },
  output: Output.object({ schema: PolicyResearchResultSchema }),
});
