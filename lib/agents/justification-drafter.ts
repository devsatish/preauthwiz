import { ToolLoopAgent } from 'ai';
import { sonnet } from '@/lib/ai/models';
import type { Intake } from '@/lib/schemas/patient';
import type { EligibilityResult } from '@/lib/schemas/eligibility';
import type { PolicyResearchResult } from '@/lib/schemas/policy';
import type { ChartAbstractionResult } from '@/lib/schemas/evidence';
import type { RiskScoringResult } from '@/lib/schemas/verdict';
import { justificationDrafterInstructions } from '@/lib/ai/prompts/justification-drafter';

export function createJustificationDrafter(
  intake: Intake,
  eligibility: EligibilityResult,
  policy: PolicyResearchResult,
  evidence: ChartAbstractionResult,
  scored: RiskScoringResult,
) {
  return new ToolLoopAgent({
    model: sonnet,
    instructions: justificationDrafterInstructions(intake, eligibility, policy, evidence, scored),
  });
}
