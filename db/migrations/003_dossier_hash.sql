BEGIN;

ALTER TABLE investigations
  ADD COLUMN IF NOT EXISTS pre_redteam_snapshot_hash TEXT;

COMMIT;
