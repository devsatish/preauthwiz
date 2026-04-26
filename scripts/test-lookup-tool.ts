import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { lookupMedicalPolicy } = await import('../lib/tools/lookup-medical-policy');
  if (!lookupMedicalPolicy.execute) {
    console.error('execute missing');
    process.exit(1);
  }
  const result = await lookupMedicalPolicy.execute(
    {
      payer_id: 'AETNA',
      cpt_code: 'J0585',
      query: 'medical necessity criteria for chronic migraine onabotulinumtoxinA prior authorization',
    },
    { toolCallId: 'test', messages: [] } as never,
  );
  console.log(`Got ${(result as unknown[]).length} results`);
  for (const r of result as Array<{ id: string; policy_id: string; section_title: string | null; similarity: number; text: string }>) {
    console.log(`  [${r.id.slice(0, 8)}…] ${r.policy_id} | sim=${r.similarity.toFixed(3)} | ${r.section_title?.slice(0, 60) ?? '(no title)'}`);
  }
}

main().catch(err => {
  console.error('ERROR:', err.message);
  if (err.cause) console.error('CAUSE:', err.cause.message ?? err.cause);
  if (err.stack) console.error(err.stack.split('\n').slice(0, 8).join('\n'));
  process.exit(1);
});
