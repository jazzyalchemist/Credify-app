BEGIN;

CREATE TABLE IF NOT EXISTS ai_jobs (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  external_response_id TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_payload JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ai_jobs_investigation_idx
  ON ai_jobs(investigation_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ai_jobs_external_response_idx
  ON ai_jobs(external_response_id);

COMMIT;
