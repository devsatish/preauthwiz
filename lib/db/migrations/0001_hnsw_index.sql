-- Run after tables are created
-- HNSW index for fast approximate nearest-neighbor search on policy embeddings
-- vector_cosine_ops matches the cosine distance operator (<=>)
CREATE INDEX IF NOT EXISTS policy_chunks_embedding_idx
  ON policy_chunks USING hnsw (embedding vector_cosine_ops);
