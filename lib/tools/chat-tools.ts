import { tool } from 'ai';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { priorAuths, patients, providers, authRuns } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { lookupMedicalPolicy as underlyingLookup } from './lookup-medical-policy';

// Chat-friendly wrapper around the underlying vector-search tool. The orchestrator's
// version takes payer_id + cpt_code + query (it knows them from the prior auth row).
// In chat context, the assistant usually only knows the query — defaults payer to AETNA
// (the only payer with ingested policies today) and cpt_code to a placeholder that
// doesn't affect the search semantically (the embedding query is what drives ranking).
export const lookupMedicalPolicy = tool({
  description: 'Search ingested Aetna medical policies for relevant criteria, coverage rules, or contraindications. Use whenever the user asks about what a policy says, requires, or excludes.',
  inputSchema: z.object({
    query: z.string().describe('Natural-language search query, e.g. "chronic migraine criteria for Botox" or "headache prophylaxis preventive trial requirements"'),
  }),
  execute: async ({ query }, options) => {
    if (!underlyingLookup.execute) {
      return { error: 'lookup_medical_policy implementation missing' };
    }
    const result = await underlyingLookup.execute(
      { payer_id: 'AETNA', cpt_code: 'J0585', query },
      options,
    );
    return { chunks: result };
  },
});

export const getActiveAuths = tool({
  description: 'List active prior authorization requests with patient and provider info. Use when the user asks about the queue or wants to see multiple auths.',
  inputSchema: z.object({}),
  execute: async () => {
    const LIMIT = 50;
    const rows = await db
      .select({
        auth_id: priorAuths.id,
        patient_name: patients.firstName,
        patient_last: patients.lastName,
        provider_name: providers.name,
        payer_id: priorAuths.payerId,
        plan_name: priorAuths.planName,
        cpt_code: priorAuths.cptCode,
        dx_codes: priorAuths.dxCodes,
        status: priorAuths.status,
        created_at: priorAuths.createdAt,
        notes: priorAuths.notes,
      })
      .from(priorAuths)
      .innerJoin(patients, eq(priorAuths.patientId, patients.id))
      .innerJoin(providers, eq(priorAuths.providerId, providers.id))
      .orderBy(desc(priorAuths.createdAt))
      .limit(LIMIT + 1);

    const trimmed = rows.slice(0, LIMIT).map(r => ({
      auth_id: r.auth_id,
      patient_name: `${r.patient_name} ${r.patient_last}`,
      provider_name: r.provider_name,
      payer_id: r.payer_id,
      plan_name: r.plan_name,
      cpt_code: r.cpt_code,
      dx_codes: r.dx_codes,
      status: r.status,
      created_at: r.created_at.toISOString(),
      notes: r.notes,
    }));

    return {
      auths: trimmed,
      truncated: rows.length > LIMIT,
      count: trimmed.length,
    };
  },
});

export const getAuthDetails = tool({
  description: 'Get full details for a specific prior auth: auth row, patient, provider, and latest completed orchestrator run if any. Use when the user references a specific auth_id.',
  inputSchema: z.object({
    auth_id: z.string().describe('The prior_auth.id (e.g., "auth-005")'),
  }),
  execute: async ({ auth_id }) => {
    const rows = await db
      .select({
        auth: priorAuths,
        patient: patients,
        provider: providers,
      })
      .from(priorAuths)
      .innerJoin(patients, eq(priorAuths.patientId, patients.id))
      .innerJoin(providers, eq(priorAuths.providerId, providers.id))
      .where(eq(priorAuths.id, auth_id))
      .limit(1);

    if (rows.length === 0) {
      return { error: `Auth not found: ${auth_id}` };
    }
    const row = rows[0];

    const runRows = await db
      .select({
        id: authRuns.id,
        verdict: authRuns.verdict,
        confidence: authRuns.confidence,
        completedAt: authRuns.completedAt,
        totalTokens: authRuns.totalTokens,
        totalCostCents: authRuns.totalCostCents,
        finalVerdict: authRuns.finalVerdict,
      })
      .from(authRuns)
      .where(and(eq(authRuns.priorAuthId, auth_id), eq(authRuns.status, 'completed')))
      .orderBy(desc(authRuns.startedAt))
      .limit(1);

    const latest = runRows[0];
    const fv = (latest?.finalVerdict ?? null) as { score?: number; blocking_issues?: unknown[] } | null;

    return {
      auth: {
        id: row.auth.id,
        cpt_code: row.auth.cptCode,
        dx_codes: row.auth.dxCodes,
        status: row.auth.status,
        payer_id: row.auth.payerId,
        plan_name: row.auth.planName,
        notes: row.auth.notes,
        created_at: row.auth.createdAt.toISOString(),
      },
      patient: {
        id: row.patient.id,
        name: `${row.patient.firstName} ${row.patient.lastName}`,
        dob: row.patient.dob,
        sex: row.patient.sex,
        mrn: row.patient.mrn,
        plan_name: row.patient.planName,
      },
      provider: {
        id: row.provider.id,
        name: row.provider.name,
        specialty: row.provider.specialty,
        organization: row.provider.organization,
      },
      latest_run: latest
        ? {
            run_id: latest.id,
            verdict: latest.verdict,
            score: typeof fv?.score === 'number' ? fv.score : null,
            blocking_count: Array.isArray(fv?.blocking_issues) ? fv.blocking_issues.length : 0,
            completed_at: latest.completedAt?.toISOString() ?? null,
            total_tokens: latest.totalTokens,
            total_cost_cents: Number(latest.totalCostCents ?? 0),
          }
        : null,
    };
  },
});
