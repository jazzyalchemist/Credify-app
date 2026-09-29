BEGIN;

ALTER TABLE investigations
  ADD COLUMN IF NOT EXISTS research_saturation_status TEXT NOT NULL DEFAULT 'UNASSESSED',
  ADD COLUMN IF NOT EXISTS research_saturation JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
