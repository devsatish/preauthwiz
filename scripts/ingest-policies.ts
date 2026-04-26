// Phase 3: ingests Aetna policy HTML into Neon pgvector.
// Stages:
//   --stage parse  → clean + chunk only, write JSONL preview, no DB writes
//   --stage embed  → embed cleaned chunks via OpenAI, upsert into policies + policy_chunks
// Run with: pnpm tsx scripts/ingest-policies.ts --stage parse
//           pnpm tsx scripts/ingest-policies.ts --stage embed

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as cheerio from 'cheerio';

interface PolicySource {
  policyId: string;
  filename: string;
  cpbNumber: string;
  name: string;
  sourceUrl: string;
}

const POLICIES: PolicySource[] = [
  {
    policyId: 'aetna-cpb-0113',
    filename: 'lib/data/policies/aetna-cpb-0113.html',
    cpbNumber: 'CPB 0113',
    name: 'Botulinum Toxin',
    sourceUrl: 'https://www.aetna.com/cpb/medical/data/100_199/0113.html',
  },
  {
    policyId: 'aetna-cpb-0462',
    filename: 'lib/data/policies/aetna-cpb-0462.html',
    cpbNumber: 'CPB 0462',
    name: 'Headaches: Nonsurgical Management',
    sourceUrl: 'https://www.aetna.com/cpb/medical/data/400_499/0462.html',
  },
];

interface Chunk {
  policyId: string;
  sectionTitle: string | null;
  sectionNumber: number | null;
  text: string;
  charCount: number;
  approxTokens: number;
}

const approxTokens = (s: string) => Math.ceil(s.length / 4);

// Section titles whose chunks we drop entirely (option B: strip References).
const DROP_SECTION_PATTERNS = [/reference/i];

function clean(html: string): string {
  const $ = cheerio.load(html);

  $('script, style, noscript, link, meta, svg, iframe, form, button, input, select').remove();
  $('nav, header, footer, aside').remove();

  const chromePatterns = [
    'social', 'share', 'legal', 'cookie', 'breadcrumb', 'lang', 'search',
    'interlink', 'sidebar', 'footer', 'header', 'navigation', 'banner',
    'a2a', 'sharePopup', 'belowFooter', 'fixedHeaderWrap', 'globalSearch',
    'langLinks', 'legalNotices', 'icons', 'logo', 'feedback',
    'skipnav', 'skip-link', 'top-nav', 'utility',
  ];
  for (const pat of chromePatterns) {
    $(`[class*="${pat}" i]`).remove();
    $(`[id*="${pat}" i]`).remove();
  }

  $('[aria-hidden="true"]').remove();
  $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();
  $('[style*="display:none"], [style*="display: none"]').remove();

  const article = $('.articleModule, .content-wrapper').first();
  const root = article.length > 0 ? article : $('body');

  const blocks: string[] = [];
  root.find('h1, h2, h3, h4, h5, p, li, td, th, dt, dd, pre').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (!t) return;

    const chromeStrings = [
      /^skip to /i, /^print this/i, /^email this/i, /^share this/i,
      /^back to top/i, /^site map/i, /^contact us/i, /^find a doctor/i,
      /^©\s*\d{4}/, /^aetna inc\.?$/i,
    ];
    if (chromeStrings.some(re => re.test(t))) return;

    const tag = (el as cheerio.TagElement).tagName?.toLowerCase();
    if (tag && /^h[1-6]$/.test(tag)) {
      blocks.push(`\n## ${t}\n`);
    } else {
      blocks.push(t);
    }
  });

  return blocks.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function chunk(policyId: string, cleaned: string): Chunk[] {
  const lines = cleaned.split('\n');
  const sections: Array<{ title: string | null; body: string[] }> = [];
  let current: { title: string | null; body: string[] } = { title: null, body: [] };
  for (const line of lines) {
    const headingMatch = line.match(/^## (.+)$/);
    if (headingMatch) {
      if (current.title || current.body.length > 0) sections.push(current);
      current = { title: headingMatch[1].trim(), body: [] };
    } else if (line.trim()) {
      current.body.push(line);
    }
  }
  if (current.title || current.body.length > 0) sections.push(current);

  const TARGET_MIN = 500;
  const TARGET_MAX = 1000;
  const chunks: Chunk[] = [];
  let sectionNumber = 0;

  for (const section of sections) {
    sectionNumber++;
    // Option B: drop References sections entirely. Bibliographies are retrieval-irrelevant
    // for criteria queries and only inflate the vector space.
    if (section.title && DROP_SECTION_PATTERNS.some(re => re.test(section.title!))) continue;

    const header = section.title ? `Section: ${section.title}\n\n` : '';
    let buffer = header;

    const flush = () => {
      const trimmed = buffer.trim();
      if (!trimmed || trimmed === header.trim()) return;
      chunks.push({
        policyId,
        sectionTitle: section.title,
        sectionNumber,
        text: trimmed,
        charCount: trimmed.length,
        approxTokens: approxTokens(trimmed),
      });
      buffer = header;
    };

    for (const paragraph of section.body) {
      const candidate = buffer + paragraph + '\n';
      if (approxTokens(candidate) > TARGET_MAX && approxTokens(buffer) >= TARGET_MIN) {
        flush();
        buffer = header + paragraph + '\n';
      } else {
        buffer = candidate;
      }
    }
    flush();
  }

  return chunks.filter(c => c.approxTokens >= 50);
}

async function stageParse() {
  const allChunks: Chunk[] = [];
  for (const p of POLICIES) {
    const html = readFileSync(resolve(process.cwd(), p.filename), 'utf-8');
    const cleaned = clean(html);
    const chunks = chunk(p.policyId, cleaned);
    allChunks.push(...chunks);

    const totalChars = chunks.reduce((a, c) => a + c.charCount, 0);
    const totalTokens = chunks.reduce((a, c) => a + c.approxTokens, 0);
    const avgTokens = chunks.length ? Math.round(totalTokens / chunks.length) : 0;

    console.log(`\n=== ${p.policyId} (${p.name}) ===`);
    console.log(`Cleaned text: ${(cleaned.length / 1024).toFixed(1)} KB`);
    console.log(`Chunks:       ${chunks.length}`);
    console.log(`Avg chunk:    ~${avgTokens} tokens`);
    console.log(`Total tokens: ~${totalTokens.toLocaleString()}`);
  }

  const previewPath = resolve(process.cwd(), 'lib/data/policies/_chunks-preview.jsonl');
  writeFileSync(previewPath, allChunks.map(c => JSON.stringify(c)).join('\n'));
  console.log(`\nWrote ${allChunks.length} chunk preview rows → ${previewPath}`);
}

async function stageEmbed() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY missing in .env.local');
    process.exit(1);
  }
  const { embedMany, embed } = await import('ai');
  const { openai } = await import('@ai-sdk/openai');
  const { db } = await import('../lib/db/client');
  const { policies, policyChunks } = await import('../lib/db/schema');
  const { eq, sql: dsql } = await import('drizzle-orm');

  const embeddingModel = openai.embedding('text-embedding-3-small');
  const BATCH_SIZE = 100;
  let totalEmbeddingTokens = 0;
  const insertedPerPolicy: Record<string, number> = {};

  for (const p of POLICIES) {
    const html = readFileSync(resolve(process.cwd(), p.filename), 'utf-8');
    const cleaned = clean(html);
    const chunks = chunk(p.policyId, cleaned);

    console.log(`\n[${p.policyId}] ${chunks.length} chunks to embed`);

    // Upsert the policy row.
    await db
      .insert(policies)
      .values({
        id: p.policyId,
        payerId: 'AETNA',
        name: p.name,
        cpbNumber: p.cpbNumber,
        sourceUrl: p.sourceUrl,
      })
      .onConflictDoUpdate({
        target: policies.id,
        set: { name: p.name, cpbNumber: p.cpbNumber, sourceUrl: p.sourceUrl },
      });

    // Idempotent re-run: drop existing chunks for this policy.
    await db.delete(policyChunks).where(eq(policyChunks.policyId, p.policyId));

    // Embed in batches.
    let inserted = 0;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const { embeddings, usage } = await embedMany({
        model: embeddingModel,
        values: batch.map(c => c.text),
      });
      totalEmbeddingTokens += usage.tokens ?? 0;

      const rows = batch.map((c, j) => ({
        policyId: c.policyId,
        sectionNumber: c.sectionNumber,
        sectionTitle: c.sectionTitle,
        text: c.text,
        embedding: embeddings[j],
        metadata: { charCount: c.charCount, approxTokens: c.approxTokens } as Record<string, unknown>,
      }));
      await db.insert(policyChunks).values(rows);
      inserted += rows.length;
      process.stdout.write(`  batch ${Math.floor(i / BATCH_SIZE) + 1}: +${rows.length} rows (running total ${inserted})\n`);
    }
    insertedPerPolicy[p.policyId] = inserted;
  }

  // Cost: text-embedding-3-small is $0.02 / 1M input tokens.
  const costDollars = (totalEmbeddingTokens / 1_000_000) * 0.02;

  console.log(`\n=== Insert summary ===`);
  for (const [pid, count] of Object.entries(insertedPerPolicy)) {
    console.log(`  ${pid}: ${count} rows`);
  }
  console.log(`Total embedding tokens: ${totalEmbeddingTokens.toLocaleString()}`);
  console.log(`Total cost: $${costDollars.toFixed(6)}`);

  // Similarity smoke test: fresh embedding for a chronic-migraine query.
  const queryText =
    'chronic migraine onabotulinumtoxinA prior authorization criteria 15 headache days per month';
  console.log(`\n=== Similarity smoke test ===`);
  console.log(`Query: "${queryText}"`);

  const { embedding: queryEmbedding } = await embed({
    model: embeddingModel,
    value: queryText,
  });

  const queryVec = `[${queryEmbedding.join(',')}]`;
  const result = await db.execute(dsql`
    SELECT
      policy_id,
      section_title,
      LEFT(text, 280) AS preview,
      embedding <=> ${queryVec}::vector AS distance
    FROM policy_chunks
    WHERE policy_id IN ('aetna-cpb-0113', 'aetna-cpb-0462')
    ORDER BY embedding <=> ${queryVec}::vector
    LIMIT 5
  `);

  const rows = (result as { rows?: Array<Record<string, unknown>> }).rows
    ?? (result as unknown as Array<Record<string, unknown>>);
  console.log(`\nTop 5 matches:`);
  rows.forEach((r, i) => {
    console.log(`\n${i + 1}. [${r.policy_id}] section: ${r.section_title ?? '(none)'}`);
    console.log(`   distance: ${Number(r.distance).toFixed(4)}`);
    console.log(`   preview:  ${r.preview}`);
  });
}

const stageIdx = process.argv.indexOf('--stage');
const stage = stageIdx >= 0 ? process.argv[stageIdx + 1] : undefined;

async function main() {
  if (stage === 'parse') return stageParse();
  if (stage === 'embed') return stageEmbed();
  console.error('Usage: tsx scripts/ingest-policies.ts --stage <parse|embed>');
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
