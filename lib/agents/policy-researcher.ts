import { ToolLoopAgent, Output } from 'ai';
import { sonnet } from '@/lib/ai/models';
import { lookupMedicalPolicy } from '@/lib/tools/lookup-medical-policy';
import { PolicyResearchResultSchema } from '@/lib/schemas/policy';
import { policyResearcherInstructions } from '@/lib/ai/prompts/policy-researcher';

export const policyResearcher = new ToolLoopAgent({
  model: sonnet,
  instructions: policyResearcherInstructions(),
  tools: { lookup_medical_policy: lookupMedicalPolicy },
  output: Output.object({ schema: PolicyResearchResultSchema }),
});
