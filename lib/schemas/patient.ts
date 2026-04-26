import { z } from 'zod';

export const IntakeSchema = z.object({
  priorAuthId: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  patientDob: z.string(),
  patientSex: z.string(),
  planId: z.string(),
  planName: z.string(),
  payerId: z.string(),
  providerId: z.string(),
  providerName: z.string(),
  cptCode: z.string(),
  dxCodes: z.array(z.string()),
  mrn: z.string(),
  // Free-text notes from the prior auth request — typically contains the requested
  // dose, treatment frequency, or other request-specific details. Required by the
  // justification drafter to cite the actual requested values, not policy defaults.
  notes: z.string().nullable(),
});

export type Intake = z.infer<typeof IntakeSchema>;
