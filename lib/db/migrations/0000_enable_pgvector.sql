-- Run this manually against Neon BEFORE applying Drizzle migrations
-- Neon Postgres includes pgvector by default; this is a no-op if already enabled
CREATE EXTENSION IF NOT EXISTS vector;
