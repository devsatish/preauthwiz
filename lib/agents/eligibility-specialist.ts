import { ToolLoopAgent, Output } from 'ai';
import { haiku } from '@/lib/ai/models';
import { checkEligibility } from '@/lib/tools/check-eligibility';
import { EligibilityResultSchema } from '@/lib/schemas/eligibility';
import { eligibilitySpecialistInstructions } from '@/lib/ai/prompts/eligibility-specialist';

export const eligibilitySpecialist = new ToolLoopAgent({
  model: haiku,
  instructions: eligibilitySpecialistInstructions(),
  tools: { check_eligibility: checkEligibility },
  output: Output.object({ schema: EligibilityResultSchema }),
});
