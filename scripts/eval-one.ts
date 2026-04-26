import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const targetId = process.argv[2];
  if (!targetId) { console.error('usage: tsx /tmp/eval-one.ts <case_id>'); process.exit(2); }
  const { cases } = await import('@/lib/eval/cases');
  const { runCase } = await import('@/lib/eval/runner');
  const { printReport } = await import('@/lib/eval/report');
  const c = cases.find(x => x.id === targetId);
  if (!c) { console.error(`case ${targetId} not found`); process.exit(2); }
  console.error(`Running ${c.id}...`);
  const t = Date.now();
  const r = await runCase(c);
  console.error(`done in ${((Date.now()-t)/1000).toFixed(1)}s`);
  printReport([r]);
  process.exit(r.status === 'PASS' ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
