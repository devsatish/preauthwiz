// Eval results persistence — writes each run's CaseResult[] to disk as JSON.
// .eval-results/latest.json is the canonical "most recent" pointer the /evals page reads.
// .eval-results/<timestamp>.json is the archive. Both are gitignored — eval runs are
// reproducible from cases.ts; persisted artifacts are a per-developer cache.

import { mkdirSync, writeFileSync, renameSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CaseResult } from './cases';

export interface EvalResultsBundle {
  timestamp: string; // ISO
  total_cost_cents: number;
  total_wall_ms: number;
  pass_count: number;
  fail_count: number;
  error_count: number;
  results: CaseResult[];
}

const RESULTS_DIR = '.eval-results';

export function writeResults(results: CaseResult[]): EvalResultsBundle {
  const timestamp = new Date().toISOString();
  const total_cost_cents = results.reduce((a, r) => a + r.actual.total_cost_cents, 0);
  const total_wall_ms = results.reduce((a, r) => a + r.actual.latency_ms, 0);
  const pass_count = results.filter(r => r.status === 'PASS').length;
  const fail_count = results.filter(r => r.status === 'FAIL').length;
  const error_count = results.filter(r => r.status === 'ERROR').length;

  const bundle: EvalResultsBundle = {
    timestamp,
    total_cost_cents,
    total_wall_ms,
    pass_count,
    fail_count,
    error_count,
    results,
  };

  const dir = resolve(process.cwd(), RESULTS_DIR);
  mkdirSync(dir, { recursive: true });

  const tsFile = resolve(dir, `${timestamp.replace(/[:.]/g, '-')}.json`);
  const latestFile = resolve(dir, 'latest.json');
  const tmpFile = `${latestFile}.tmp`;

  const json = JSON.stringify(bundle, null, 2);
  // Archive the timestamped copy first; then atomic write to latest via rename.
  writeFileSync(tsFile, json);
  writeFileSync(tmpFile, json);
  renameSync(tmpFile, latestFile);

  return bundle;
}

// Used by the /evals page (server component) to read the most recent run.
// Returns null if no eval has been persisted yet.
export function readLatestResults(): EvalResultsBundle | null {
  const file = resolve(process.cwd(), RESULTS_DIR, 'latest.json');
  if (!existsSync(file)) return null;
  try {
    const raw = readFileSync(file, 'utf-8');
    return JSON.parse(raw) as EvalResultsBundle;
  } catch {
    return null;
  }
}
