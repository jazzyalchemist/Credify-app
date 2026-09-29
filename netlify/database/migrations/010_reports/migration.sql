BEGIN;

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  structured_content JSONB NOT NULL,
  markdown_content TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  model TEXT,
  ai_job_id TEXT REFERENCES ai_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reports_investigation_idx
  ON reports(investigation_id, stage, created_at DESC);

COMMIT;
