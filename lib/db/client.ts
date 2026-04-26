// @neondatabase/serverless HTTP driver chosen over TCP/pooled connections because:
// Vercel serverless functions are ephemeral — connection pools can't persist between invocations.
// The HTTP driver makes a single REST call per query, eliminating cold-start pool warmup
// and the "too many connections" problem that plagues TCP drivers in serverless environments.
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const url = process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost/placeholder';

const sql = neon(url);

export const db = drizzle(sql, { schema });
