import { ToolLoopAgent, Output } from 'ai';
import { sonnet } from '@/lib/ai/models';
import { searchPatientChart } from '@/lib/tools/search-patient-chart';
import { ChartAbstractionResultSchema } from '@/lib/schemas/evidence';
import { chartAbstractorInstructions } from '@/lib/ai/prompts/chart-abstractor';
import aaliyahChart from '@/lib/data/charts/aaliyah-johnson.json';

// Per-patient FHIR Bundle lookup. Phase 2: only Aaliyah is fixtured; other patients
// fall through to no inlined chart (tool calls still work, just no cache benefit).
const CHART_FIXTURES: Record<string, unknown> = {
  'pat-003': aaliyahChart,
};

/**
 * Build a chart abstractor with the patient's FHIR bundle inlined as a cached
 * system block. The model still has access to the search_patient_chart tool —
 * the inlined bundle gives it cached reference context, the tool returns
 * pre-shaped EvidenceItems for output. In production we'd switch to a content-
 * addressable cache or load-on-demand; for the demo this pattern shows both the
 * caching strategy and the tool-augmented agent loop.
 */
export function createChartAbstractor(patientId: string) {
  const fixture = CHART_FIXTURES[patientId];

  const systemBlocks: Array<{
    role: 'system';
    content: string;
    providerOptions?: { anthropic: { cacheControl: { type: 'ephemeral'; ttl?: '5m' | '1h' } } };
  }> = [{ role: 'system', content: chartAbstractorInstructions() }];

  if (fixture) {
    systemBlocks.push({
      role: 'system',
      content: `PATIENT CHART REFERENCE (FHIR Bundle for ${patientId}):\n\n${JSON.stringify(fixture, null, 2)}`,
      // Cache breakpoint: Anthropic caches everything up to and including this block.
      // 1h TTL chosen for demo robustness (5m default would expire mid-session).
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' } } },
    });
  }

  return new ToolLoopAgent({
    model: sonnet,
    temperature: 0,
    instructions: systemBlocks,
    tools: { search_patient_chart: searchPatientChart },
    output: Output.object({ schema: ChartAbstractionResultSchema }),
  });
}
