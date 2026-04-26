import { z } from 'zod';

export const EvidenceItemSchema = z.object({
  source_type: z.enum(['Observation', 'Condition', 'MedicationStatement', 'Procedure', 'DiagnosticReport', 'ClinicalNote']),
  source_id: z.string(),
  date: z.string(),
  excerpt: z.string(),
  relevance_score: z.number().min(0).max(1),
});

export const CriterionEvidenceSchema = z.object({
  criterion_id: z.string(),
  met: z.enum(['yes', 'no', 'partial', 'unknown']),
  evidence: z.array(EvidenceItemSchema),
  reasoning: z.string(),
});

export const ChartAbstractionResultSchema = z.object({
  evidence_by_criterion: z.array(CriterionEvidenceSchema),
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type CriterionEvidence = z.infer<typeof CriterionEvidenceSchema>;
export type ChartAbstractionResult = z.infer<typeof ChartAbstractionResultSchema>;
