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
});

export type Intake = z.infer<typeof IntakeSchema>;
