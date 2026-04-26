// Anthropic pricing as of April 2025 (per million tokens) — base input/output rates.
// Source: https://www.anthropic.com/pricing
// Cache pricing modifiers (applied to the base input rate):
//   - cache writes (creation): 1.25x base input
//   - cache reads:             0.10x base input
const PRICING_PER_MILLION: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  'claude-haiku-4-5': { input: 0.8, output: 4.0 },
};

const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

export interface UsageBreakdown {
  uncachedInputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
}

/**
 * Compute cost in cents for a single agent's usage on a single model.
 * Cache-aware: separates uncached, cache-creation, and cache-read input prices.
 */
export function computeCost(model: string, usage: UsageBreakdown): number {
  const rates = PRICING_PER_MILLION[model];
  if (!rates) return 0;
  const M = 1_000_000;
  const cents = 100;
  return (
    (usage.uncachedInputTokens / M) * rates.input * cents +
    (usage.cacheWriteTokens / M) * rates.input * CACHE_WRITE_MULTIPLIER * cents +
    (usage.cacheReadTokens / M) * rates.input * CACHE_READ_MULTIPLIER * cents +
    (usage.outputTokens / M) * rates.output * cents
  );
}
