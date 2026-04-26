// Entry point: load env BEFORE importing anything that reads process.env.DATABASE_URL.
// db client snapshots the URL at module init; ESM hoisting + dotenv-after-import = silent breakage.
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { cases } = await import('./cases');
  const { runAll } = await import('./runner');
  const { printReport } = await import('./report');

  const results = await runAll(cases, { concurrency: 2 });
  printReport(results);

  const anyFailed = results.some(r => r.status !== 'PASS');
  process.exit(anyFailed ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});
