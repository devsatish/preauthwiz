import { tool } from 'ai';
import { z } from 'zod';
import type { EvidenceItem } from '@/lib/schemas/evidence';
import aaliyahChart from '@/lib/data/charts/aaliyah-johnson.json';
import patEpisodicChart from '@/lib/data/charts/pat-test-episodic.json';
import patPartialChart from '@/lib/data/charts/pat-test-partial.json';
import patPcpChart from '@/lib/data/charts/pat-test-pcp.json';
import patStaleChart from '@/lib/data/charts/pat-test-stale.json';

type FHIRResource = {
  resourceType: string;
  id: string;
  [key: string]: unknown;
};

type FHIRBundle = {
  entry: Array<{ resource: FHIRResource }>;
};

// Patient-id → FHIR Bundle registry. Phase 4 added test fixtures for the eval harness.
const PATIENT_CHARTS: Record<string, FHIRBundle> = {
  'pat-003': aaliyahChart as FHIRBundle,
  'pat-test-episodic': patEpisodicChart as FHIRBundle,
  'pat-test-partial': patPartialChart as FHIRBundle,
  'pat-test-pcp': patPcpChart as FHIRBundle,
  'pat-test-stale': patStaleChart as FHIRBundle,
};

function mapFHIRToEvidence(resource: FHIRResource, query: string): EvidenceItem | null {
  void query;
  const type = resource.resourceType;

  if (type === 'Condition') {
    const coding = (resource.code as { coding?: Array<{ display?: string }> })?.coding?.[0];
    const note = (resource.note as Array<{ text?: string }>)?.[0]?.text ?? '';
    const onset = resource.onsetDateTime as string | undefined;
    return {
      source_type: 'Condition',
      source_id: resource.id,
      date: onset ?? 'unknown',
      excerpt: `${coding?.display ?? 'Condition'}: ${note}`,
      relevance_score: 0.9,
    };
  }

  if (type === 'Observation') {
    const note = (resource.note as Array<{ text?: string }>)?.[0]?.text ?? '';
    const value = resource.valueQuantity as { value?: number; unit?: string } | undefined;
    const period = resource.effectivePeriod as { start?: string } | undefined;
    return {
      source_type: 'Observation',
      source_id: resource.id,
      date: period?.start ?? 'unknown',
      excerpt: value
        ? `${value.value} ${value.unit}. ${note}`
        : note,
      relevance_score: 0.85,
    };
  }

  if (type === 'MedicationStatement') {
    const med = resource.medicationCodeableConcept as { text?: string } | undefined;
    const note = (resource.note as Array<{ text?: string }>)?.[0]?.text ?? '';
    const period = resource.effectivePeriod as { start?: string; end?: string } | undefined;
    return {
      source_type: 'MedicationStatement',
      source_id: resource.id,
      date: period?.start ?? 'unknown',
      excerpt: `${med?.text ?? 'Medication'} (${period?.start} to ${period?.end ?? 'ongoing'}): ${note}`,
      relevance_score: 0.88,
    };
  }

  if (type === 'DiagnosticReport') {
    const conclusion = resource.conclusion as string | undefined;
    const effective = resource.effectiveDateTime as string | undefined;
    return {
      source_type: 'DiagnosticReport',
      source_id: resource.id,
      date: effective ?? 'unknown',
      excerpt: conclusion ?? 'Diagnostic report',
      relevance_score: 0.92,
    };
  }

  if (type === 'Procedure') {
    const code = resource.code as { text?: string } | undefined;
    const note = (resource.note as Array<{ text?: string }>)?.[0]?.text ?? '';
    const period = resource.performedPeriod as { start?: string } | undefined;
    return {
      source_type: 'Procedure',
      source_id: resource.id,
      date: period?.start ?? 'unknown',
      excerpt: `${code?.text ?? 'Procedure'}: ${note}`,
      relevance_score: 0.87,
    };
  }

  return null;
}

// Dispatches on patient_id via PATIENT_CHARTS registry. Patients without a registered
// chart get an empty result (graceful degradation — chart abstractor handles empty evidence).
export const searchPatientChart = tool({
  description: 'Search patient chart for clinical evidence relevant to a prior authorization request',
  inputSchema: z.object({
    patient_id: z.string().describe('Patient ID'),
    query: z.string().describe('Clinical query to find relevant chart evidence'),
  }),
  execute: async ({ patient_id, query }): Promise<EvidenceItem[]> => {
    const bundle = PATIENT_CHARTS[patient_id];
    if (!bundle) return [];

    const evidence: EvidenceItem[] = [];
    for (const entry of bundle.entry) {
      const resource = entry.resource;
      if (resource.resourceType === 'Patient') continue;
      const item = mapFHIRToEvidence(resource, query);
      if (item) evidence.push(item);
    }
    return evidence;
  },
});
