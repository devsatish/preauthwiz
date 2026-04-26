// Anthropic pricing as of April 2025 (per million tokens)
// Source: https://www.anthropic.com/pricing
// Input prices include cache write/read variants; we use standard input pricing here
const PRICING_PER_MILLION: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  'claude-haiku-4-5': { input: 0.8, output: 4.0 },
};

export function computeCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rates = PRICING_PER_MILLION[model];
  if (!rates) return 0;
  const inputCost = (inputTokens / 1_000_000) * rates.input * 100;
  const outputCost = (outputTokens / 1_000_000) * rates.output * 100;
  return inputCost + outputCost;
}
