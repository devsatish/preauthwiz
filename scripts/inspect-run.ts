import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  // Dynamic import after env is loaded — db client reads DATABASE_URL at module-init time.
  const { db } = await import('../lib/db/client');
  const { authRuns, authRunEvents } = await import('../lib/db/schema');
  const { and, desc, eq } = await import('drizzle-orm');

  const runIdArg = process.argv[2];
  const caseFilter = process.argv[3] ?? 'auth-005';

  if (runIdArg === '--list') {
    const rows = await db
      .select({
        id: authRuns.id,
        priorAuthId: authRuns.priorAuthId,
        verdict: authRuns.verdict,
        status: authRuns.status,
        startedAt: authRuns.startedAt,
      })
      .from(authRuns)
      .where(eq(authRuns.priorAuthId, caseFilter))
      .orderBy(desc(authRuns.startedAt))
      .limit(20);
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  if (runIdArg === '--last-approve') {
    const rows = await db
      .select({
        id: authRuns.id,
        verdict: authRuns.verdict,
        startedAt: authRuns.startedAt,
      })
      .from(authRuns)
      .where(
        and(
          eq(authRuns.priorAuthId, caseFilter),
          eq(authRuns.verdict, 'auto_approve_eligible'),
        ),
      )
      .orderBy(desc(authRuns.startedAt))
      .limit(1);
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  if (!runIdArg) {
    console.error('Usage: tsx scripts/inspect-run.ts <runId> | --list | --last-approve [caseId]');
    process.exit(1);
  }

  const run = await db.select().from(authRuns).where(eq(authRuns.id, runIdArg)).limit(1);
  const events = await db
    .select()
    .from(authRunEvents)
    .where(eq(authRunEvents.runId, runIdArg))
    .orderBy(authRunEvents.timestamp);

  console.log('=== RUN ===');
  console.log(JSON.stringify(run[0], null, 2));
  console.log('\n=== EVENTS ===');
  for (const ev of events) {
    console.log(`\n--- ${ev.subagent} / ${ev.status} (${ev.timestamp.toISOString()}) ---`);
    if (ev.input) console.log('input:', JSON.stringify(ev.input, null, 2));
    if (ev.output) console.log('output:', JSON.stringify(ev.output, null, 2));
    if (ev.model) console.log(`model: ${ev.model}, latencyMs: ${ev.latencyMs}, tokens: ${ev.inputTokens}/${ev.outputTokens}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
