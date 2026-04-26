// Load env BEFORE importing the db client. ESM hoisting + the db client snapshotting
// process.env.DATABASE_URL at module init means an `import 'dotenv/config'` AFTER the
// db import is a no-op for the connection. Dynamic imports preserve the load order.
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function seed() {
  const { db } = await import('@/lib/db/client');
  const { patients, providers, priorAuths, authRuns, authRunEvents } = await import('@/lib/db/schema');
  const { syntheticPatients } = await import('@/lib/data/patients');
  const { syntheticProviders } = await import('@/lib/data/providers');
  const { syntheticPriorAuths } = await import('@/lib/data/prior-auths');

  console.log('Seeding database...');

  // Idempotent — clear in FK order. auth_run_events references auth_runs; auth_runs
  // references prior_auths. Wipe child tables first.
  await db.delete(authRunEvents);
  await db.delete(authRuns);
  await db.delete(priorAuths);
  await db.delete(patients);
  await db.delete(providers);

  console.log('Inserting patients...');
  await db.insert(patients).values(syntheticPatients);

  console.log('Inserting providers...');
  await db.insert(providers).values(syntheticProviders);

  console.log('Inserting prior auths...');
  await db.insert(priorAuths).values(syntheticPriorAuths);

  console.log('Seed complete.');
  console.log(`  ${syntheticPatients.length} patients`);
  console.log(`  ${syntheticProviders.length} providers`);
  console.log(`  ${syntheticPriorAuths.length} prior auths`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
