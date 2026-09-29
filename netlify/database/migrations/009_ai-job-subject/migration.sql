BEGIN;

ALTER TABLE ai_jobs
  ADD COLUMN IF NOT EXISTS subject_id TEXT;

CREATE INDEX IF NOT EXISTS ai_jobs_subject_idx
  ON ai_jobs(investigation_id, job_type, subject_id);

COMMIT;
