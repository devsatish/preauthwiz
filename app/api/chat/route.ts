import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai';
import { haiku } from '@/lib/ai/models';
import { chatAssistantInstructions } from '@/lib/ai/prompts/chat-assistant';
import { getActiveAuths, getAuthDetails, lookupMedicalPolicy } from '@/lib/tools/chat-tools';
// lookupMedicalPolicy here is the chat-friendly wrapper from chat-tools, NOT the
// orchestrator's version with payer_id + cpt_code params.

// Chat turn with up to 8 tool-call rounds (stepCountIs(8)) — multi-step
// research questions can chain several tool calls. 120s gives headroom
// without going to the full 300s Auto-Pilot needs.
export const maxDuration = 120;

export async function POST(request: Request) {
  const { messages } = (await request.json()) as { messages: UIMessage[] };

  const result = streamText({
    model: haiku,
    system: chatAssistantInstructions(),
    messages: await convertToModelMessages(messages),
    tools: {
      get_active_auths: getActiveAuths,
      get_auth_details: getAuthDetails,
      lookup_medical_policy: lookupMedicalPolicy,
    },
    // Allow several rounds of tool→reason→tool so the assistant can chain
    // (e.g., get_active_auths then drill into one with get_auth_details).
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse();
}
