BEGIN;

ALTER TABLE investigations
  ADD COLUMN IF NOT EXISTS phase_checkpoints JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE investigations
  ADD COLUMN IF NOT EXISTS pre_redteam_snapshot JSONB;

COMMIT;
