import { createAgentUIStreamResponse } from 'ai';
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';
import { sonnet } from '@/lib/ai/models';
import { db } from '@/lib/db/client';
import { priorAuths, patients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { lookupMedicalPolicy } from '@/lib/tools/lookup-medical-policy';

export const maxDuration = 30;

const getActiveAuths = tool({
  description: 'Get the list of active prior authorization requests that need attention',
  inputSchema: z.object({
    status_filter: z.string().optional().describe('Optional status filter: pending, needs_info, p2p_required'),
  }),
  execute: async ({ status_filter }) => {
    const rows = await db
      .select({
        id: priorAuths.id,
        patientFirstName: patients.firstName,
        patientLastName: patients.lastName,
        cptCode: priorAuths.cptCode,
        status: priorAuths.status,
        payerId: priorAuths.payerId,
        planName: priorAuths.planName,
        notes: priorAuths.notes,
        createdAt: priorAuths.createdAt,
      })
      .from(priorAuths)
      .innerJoin(patients, eq(priorAuths.patientId, patients.id))
      .where(
        status_filter
          ? eq(priorAuths.status, status_filter)
          : undefined,
      )
      .limit(20);

    return rows;
  },
});

const assistantAgent = new ToolLoopAgent({
  model: sonnet,
  instructions: `You are an AI assistant for Jamie Alvarez, Intake Admin at Meridian Health.

You help Jamie manage the prior authorization queue. You can:
1. Look up active prior authorization requests using get_active_auths
2. Summarize payer medical policies using lookup_medical_policy
3. Answer questions about prior auth workflow, timelines, and payer requirements
4. Help draft appeal language for denied authorizations

Always be concise and clinical. When citing policy criteria, use the exact language from the retrieved policy.
Do not invent policy criteria — only cite what is retrieved via tools.`,
  tools: {
    get_active_auths: getActiveAuths,
    lookup_medical_policy: lookupMedicalPolicy,
  },
});

export async function POST(request: Request) {
  const { messages } = await request.json() as { messages: unknown[] };

  return createAgentUIStreamResponse({
    agent: assistantAgent,
    uiMessages: messages as Parameters<typeof createAgentUIStreamResponse>[0]['uiMessages'],
  });
}
