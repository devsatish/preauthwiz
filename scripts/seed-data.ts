import 'dotenv/config';
import { db } from '@/lib/db/client';
import { patients, providers, priorAuths } from '@/lib/db/schema';
import { syntheticPatients } from '@/lib/data/patients';
import { syntheticProviders } from '@/lib/data/providers';
import { syntheticPriorAuths } from '@/lib/data/prior-auths';

async function seed() {
  console.log('Seeding database...');

  // Idempotent — clear before reinserting
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
