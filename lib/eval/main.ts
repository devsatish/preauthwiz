// Entry point: load env BEFORE importing anything that reads process.env.DATABASE_URL.
// db client snapshots the URL at module init; ESM hoisting + dotenv-after-import = silent breakage.
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { cases } = await import('./cases');
  const { runAll } = await import('./runner');
  const { printReport } = await import('./report');
  const { writeResults } = await import('./persist');

  const results = await runAll(cases, { concurrency: 2 });
  printReport(results);

  // Persist to .eval-results/{timestamp}.json + atomic latest.json so the /evals
  // dashboard can render the most recent run. Failures here are non-fatal — the
  // exit code below is what CI/eval orchestration depends on.
  try {
    const bundle = writeResults(results);
    console.log(`\nPersisted to .eval-results/latest.json (${bundle.results.length} cases, ${bundle.pass_count} pass, ${bundle.fail_count} fail)`);
  } catch (err) {
    console.error('Warning: failed to persist eval results:', err);
  }

  const anyFailed = results.some(r => r.status !== 'PASS');
  process.exit(anyFailed ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});
