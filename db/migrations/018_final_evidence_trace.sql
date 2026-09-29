BEGIN;

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS final_evidence_trace JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
