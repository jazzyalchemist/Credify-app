BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS redteam_one_live_role_per_investigation
  ON redteam_reviews(investigation_id, reviewer_role)
  WHERE status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED');

COMMIT;
