import { z } from 'zod';

export const TraceEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('agent_started'),
    subagent: z.string(),
    model: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal('agent_completed'),
    subagent: z.string(),
    model: z.string(),
    latency_ms: z.number(),
    input_tokens: z.number().optional(),
    output_tokens: z.number().optional(),
    output: z.unknown().optional(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal('tool_called'),
    subagent: z.string(),
    tool: z.string(),
    input: z.unknown(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal('tool_result'),
    subagent: z.string(),
    tool: z.string(),
    output: z.unknown(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal('text_chunk'),
    subagent: z.string(),
    chunk: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal('run_completed'),
    verdict: z.string().optional(),
    total_tokens: z.number(),
    total_cost_cents: z.number(),
    latency_ms: z.number(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal('run_error'),
    error: z.string(),
    timestamp: z.string(),
  }),
]);

export type TraceEvent = z.infer<typeof TraceEventSchema>;
