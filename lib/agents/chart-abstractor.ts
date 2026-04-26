import { ToolLoopAgent, Output } from 'ai';
import { sonnet } from '@/lib/ai/models';
import { searchPatientChart } from '@/lib/tools/search-patient-chart';
import { ChartAbstractionResultSchema } from '@/lib/schemas/evidence';
import { chartAbstractorInstructions } from '@/lib/ai/prompts/chart-abstractor';

export const chartAbstractor = new ToolLoopAgent({
  model: sonnet,
  temperature: 0,
  instructions: chartAbstractorInstructions(),
  tools: { search_patient_chart: searchPatientChart },
  output: Output.object({ schema: ChartAbstractionResultSchema }),
});
