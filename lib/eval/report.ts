import type { CaseResult } from './cases';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

function statusBadge(s: 'PASS' | 'FAIL' | 'ERROR'): string {
  if (s === 'PASS') return `${GREEN}PASS${RESET}`;
  if (s === 'FAIL') return `${RED}FAIL${RESET}`;
  return `${YELLOW}ERR ${RESET}`;
}

function pad(s: string, n: number): string {
  if (s.length >= n) return s.slice(0, n);
  return s + ' '.repeat(n - s.length);
}

export function printReport(results: CaseResult[]): void {
  const total = results.length;
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const errored = results.filter(r => r.status === 'ERROR').length;
  const totalCost = results.reduce((a, r) => a + r.actual.total_cost_cents, 0);
  const totalLatency = results.reduce((a, r) => a + r.actual.latency_ms, 0);

  console.log('');
  console.log(`${BOLD}=== Eval results ===${RESET}`);
  console.log(
    `${total} cases · ${GREEN}${passed} pass${RESET} · ${RED}${failed} fail${RESET} · ${YELLOW}${errored} err${RESET} · wall ${(totalLatency / 1000).toFixed(1)}s · cost $${(totalCost / 100).toFixed(4)}`,
  );
  console.log('');

  // Header
  console.log(
    `${DIM}${pad('case id', 38)}  ${pad('cat', 12)}  ${pad('expected', 22)}  ${pad('actual', 22)}  ${pad('status', 6)}  ${pad('score', 6)}  ${pad('blk', 4)}  ${pad('crit', 5)}  ${pad('lat (s)', 8)}  ${pad('cost', 8)}${RESET}`,
  );
  console.log(`${DIM}${'-'.repeat(150)}${RESET}`);

  for (const r of results) {
    const score = r.actual.score.toFixed(2);
    const lat = (r.actual.latency_ms / 1000).toFixed(1);
    const cost = `$${(r.actual.total_cost_cents / 100).toFixed(3)}`;
    const expected = r.case.expected.verdict_one_of
      ? r.case.expected.verdict_one_of.map(v => v.replace(/_/g, ' ')).join(' | ')
      : (r.case.expected.verdict ?? '—').replace(/_/g, ' ');
    const actual = (r.actual.verdict || '—').replace(/_/g, ' ');
    console.log(
      `${pad(r.case.id, 38)}  ${pad(r.case.category, 12)}  ${pad(expected, 22)}  ${pad(actual, 22)}  ${statusBadge(r.status)}    ${pad(score, 6)}  ${pad(String(r.actual.blocking_count), 4)}  ${pad(String(r.actual.criteria_count), 5)}  ${pad(lat, 8)}  ${pad(cost, 8)}`,
    );
  }

  // Failure details
  const failures = results.filter(r => r.status === 'FAIL' || r.status === 'ERROR');
  if (failures.length > 0) {
    console.log('');
    console.log(`${BOLD}=== Failure detail ===${RESET}`);
    for (const r of failures) {
      console.log('');
      console.log(`${BOLD}${r.case.id}${RESET} ${DIM}(${r.case.category})${RESET}`);
      console.log(`  ${DIM}${r.case.description}${RESET}`);
      if (r.runId) console.log(`  ${DIM}runId:${RESET} ${r.runId}  ${DIM}→ /autopilot/trace/${r.runId}${RESET}`);
      if (r.error) {
        console.log(`  ${RED}ERROR:${RESET} ${r.error}`);
      }
      for (const f of r.failures) {
        console.log(`  ${RED}✗${RESET} ${f}`);
      }
      if (r.case.notes) {
        console.log(`  ${CYAN}why this case exists:${RESET} ${r.case.notes}`);
      }
    }
  }
  console.log('');
}
