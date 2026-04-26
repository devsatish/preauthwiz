// Phase 4: runs the 18-case eval suite against the live pipeline
// Run with: pnpm eval

import 'dotenv/config';

async function main() {
  console.log('PreAuthWiz Eval Suite — Phase 4 implementation pending');
  console.log('Will run 18 stratified test cases:');
  console.log('  • 5 clean approvals');
  console.log('  • 5 clean denials');
  console.log('  • 5 ambiguous middle cases');
  console.log('  • 3 adversarial edge cases');
  console.log('');
  console.log('Requires: DATABASE_URL and ANTHROPIC_API_KEY in .env.local');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
