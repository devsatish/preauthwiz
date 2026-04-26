import { NextRequest } from 'next/server';
import { runOrchestrator } from '@/lib/agents/orchestrator';
import type { TraceEvent } from '@/lib/schemas/trace';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { priorAuthId } = (await request.json()) as { priorAuthId: string };

  if (!priorAuthId) {
    return new Response(JSON.stringify({ error: 'priorAuthId required' }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: TraceEvent) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      }

      try {
        await runOrchestrator(priorAuthId, emit);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        emit({
          type: 'run_error',
          error: message,
          timestamp: new Date().toISOString(),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
