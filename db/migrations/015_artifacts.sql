BEGIN;

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'SUBMITTED_MATERIAL',
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  sha256 TEXT NOT NULL,
  storage_provider TEXT NOT NULL DEFAULT 'NETLIFY_BLOBS',
  storage_key TEXT NOT NULL,
  capture_method TEXT NOT NULL DEFAULT 'USER_UPLOAD',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(investigation_id, sha256)
);

CREATE INDEX IF NOT EXISTS artifacts_investigation_idx
  ON artifacts(investigation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS artifacts_source_idx
  ON artifacts(source_id);

COMMIT;
