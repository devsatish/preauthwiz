// Phase 3: ingests Aetna policy HTML into Neon pgvector
// Run with: pnpm ingest
// This script is a stub — full implementation in Phase 3

import 'dotenv/config';

async function main() {
  console.log('Policy ingestion script — Phase 3 implementation pending');
  console.log('Will ingest:');
  console.log('  • Aetna CPB 0113 — Botulinum Toxin (J0585)');
  console.log('  • Aetna CPB 0462 — Headaches: Nonsurgical Management');
  console.log('');
  console.log('Requires: DATABASE_URL and OPENAI_API_KEY in .env.local');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
