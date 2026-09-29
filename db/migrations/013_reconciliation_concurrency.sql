BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS one_nonfailed_reconciliation_job
  ON ai_jobs(investigation_id)
  WHERE job_type = 'RECONCILIATION'
    AND status IN ('QUEUED', 'IN_PROGRESS', 'PROCESSING', 'COMPLETED');

COMMIT;
