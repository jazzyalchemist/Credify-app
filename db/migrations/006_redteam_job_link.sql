BEGIN;

ALTER TABLE ai_jobs
  ADD COLUMN IF NOT EXISTS redteam_review_id TEXT
  REFERENCES redteam_reviews(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ai_jobs_redteam_review_idx
  ON ai_jobs(redteam_review_id);

COMMIT;
