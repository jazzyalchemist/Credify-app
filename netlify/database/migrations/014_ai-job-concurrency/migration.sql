BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS one_active_singleton_ai_stage
  ON ai_jobs(investigation_id, job_type)
  WHERE job_type IN (
    'DECOMPOSE',
    'DISCOVERY',
    'SCREENING',
    'SYNTHESIS',
    'PRE_REDTEAM_REPORT',
    'FINAL_REPORT'
  )
    AND status IN ('QUEUED', 'IN_PROGRESS', 'PROCESSING');

CREATE UNIQUE INDEX IF NOT EXISTS one_active_source_audit_per_subject
  ON ai_jobs(investigation_id, job_type, subject_id)
  WHERE job_type = 'SOURCE_AUDIT'
    AND subject_id IS NOT NULL
    AND status IN ('QUEUED', 'IN_PROGRESS', 'PROCESSING');

CREATE UNIQUE INDEX IF NOT EXISTS one_job_per_redteam_review
  ON ai_jobs(redteam_review_id)
  WHERE redteam_review_id IS NOT NULL;

COMMIT;
