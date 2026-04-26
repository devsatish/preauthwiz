import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  uuid,
  customType,
  index,
} from 'drizzle-orm/pg-core';

// pgvector type — stored as text in Drizzle but cast to vector in raw SQL queries
const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config) {
    const dim = (config as { dimensions?: number } | undefined)?.dimensions ?? 1536;
    return `vector(${dim})`;
  },
  fromDriver(value: string): number[] {
    return value
      .replace('[', '')
      .replace(']', '')
      .split(',')
      .map(Number);
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
});

export const patients = pgTable('patients', {
  id: text('id').primaryKey(),
  mrn: text('mrn').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  dob: text('dob').notNull(),
  sex: text('sex').notNull(),
  planId: text('plan_id').notNull(),
  planName: text('plan_name').notNull(),
  payerId: text('payer_id').notNull(),
  dxCodes: text('dx_codes').array().notNull().default([]),
  phone: text('phone'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const providers = pgTable('providers', {
  id: text('id').primaryKey(),
  npi: text('npi').notNull().unique(),
  name: text('name').notNull(),
  specialty: text('specialty').notNull(),
  organization: text('organization').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const priorAuths = pgTable('prior_auths', {
  id: text('id').primaryKey(),
  patientId: text('patient_id').notNull().references(() => patients.id),
  providerId: text('provider_id').notNull().references(() => providers.id),
  cptCode: text('cpt_code').notNull(),
  dxCodes: text('dx_codes').array().notNull().default([]),
  status: text('status').notNull(),
  payerId: text('payer_id').notNull(),
  planName: text('plan_name').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const policies = pgTable('policies', {
  id: text('id').primaryKey(),
  payerId: text('payer_id').notNull(),
  name: text('name').notNull(),
  cpbNumber: text('cpb_number'),
  lastUpdated: text('last_updated'),
  sourceUrl: text('source_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const policyChunks = pgTable('policy_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  policyId: text('policy_id').notNull().references(() => policies.id),
  pageNumber: integer('page_number'),
  sectionNumber: integer('section_number'),
  sectionTitle: text('section_title'),
  text: text('text').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
  metadata: jsonb('metadata'),
  cptCodes: text('cpt_codes').array().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const authRuns = pgTable(
  'auth_runs',
  {
    id: text('id').primaryKey(),
    priorAuthId: text('prior_auth_id').notNull().references(() => priorAuths.id),
    status: text('status').notNull().default('pending'),
    verdict: text('verdict'),
    confidence: numeric('confidence', { precision: 4, scale: 3 }),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
    totalTokens: integer('total_tokens').default(0),
    totalCostCents: numeric('total_cost_cents', { precision: 10, scale: 4 }).default('0'),
    finalLetter: text('final_letter'),
    finalVerdict: jsonb('final_verdict'),
  },
  (table) => [
    index('auth_runs_prior_auth_started_idx').on(table.priorAuthId, table.startedAt.desc()),
  ],
);

export const authRunEvents = pgTable('auth_run_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: text('run_id').notNull().references(() => authRuns.id),
  subagent: text('subagent').notNull(),
  status: text('status').notNull(),
  input: jsonb('input'),
  output: jsonb('output'),
  model: text('model'),
  latencyMs: integer('latency_ms'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const evalRuns = pgTable('eval_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  summary: jsonb('summary'),
});

export const evalResults = pgTable('eval_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  evalRunId: uuid('eval_run_id').notNull().references(() => evalRuns.id),
  caseId: text('case_id').notNull(),
  expectedVerdict: text('expected_verdict').notNull(),
  actualVerdict: text('actual_verdict'),
  correct: boolean('correct'),
  groundednessScore: numeric('groundedness_score', { precision: 4, scale: 3 }),
  draftScore: numeric('draft_score', { precision: 4, scale: 3 }),
  calibrationBucket: text('calibration_bucket'),
  details: jsonb('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
export type Provider = typeof providers.$inferSelect;
export type NewProvider = typeof providers.$inferInsert;
export type PriorAuth = typeof priorAuths.$inferSelect;
export type NewPriorAuth = typeof priorAuths.$inferInsert;
export type Policy = typeof policies.$inferSelect;
export type PolicyChunk = typeof policyChunks.$inferSelect;
export type AuthRun = typeof authRuns.$inferSelect;
export type AuthRunEvent = typeof authRunEvents.$inferSelect;
export type EvalRun = typeof evalRuns.$inferSelect;
export type EvalResult = typeof evalResults.$inferSelect;
