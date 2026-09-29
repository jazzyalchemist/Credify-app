BEGIN;

ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS independence_fingerprint JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
