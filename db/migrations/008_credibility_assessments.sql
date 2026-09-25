BEGIN;

CREATE TABLE IF NOT EXISTS credibility_assessments (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'FIRST_PASS',
  dimension_scores JSONB NOT NULL,
  total_score NUMERIC(6,2) NOT NULL,
  critical_failures JSONB NOT NULL DEFAULT '[]'::jsonb,
  rationale JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(subject_type, subject_id, stage)
);

CREATE INDEX IF NOT EXISTS credibility_assessments_investigation_idx
  ON credibility_assessments(investigation_id, subject_type, stage);

COMMIT;
