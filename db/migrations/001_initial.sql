BEGIN;

CREATE TABLE IF NOT EXISTS investigations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  input_material TEXT NOT NULL,
  investigation_mode TEXT NOT NULL,
  current_phase TEXT NOT NULL DEFAULT 'INTAKE',
  protocol_name TEXT NOT NULL,
  protocol_version TEXT NOT NULL,
  protocol_repository TEXT NOT NULL,
  protocol_release_ref TEXT NOT NULL,
  protocol_commit TEXT NOT NULL,
  protocol_snapshot JSONB NOT NULL,
  pre_redteam_frozen_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  claim_type TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
  first_pass_status TEXT NOT NULL DEFAULT 'UNASSESSED',
  first_pass_confidence NUMERIC(6,3),
  final_status TEXT NOT NULL DEFAULT 'UNASSESSED',
  final_confidence NUMERIC(6,3),
  requires_primary_evidence BOOLEAN NOT NULL DEFAULT FALSE,
  primary_evidence_recovered BOOLEAN NOT NULL DEFAULT FALSE,
  critical_failure BOOLEAN NOT NULL DEFAULT FALSE,
  unresolved_material_conflict BOOLEAN NOT NULL DEFAULT FALSE,
  known_unknowns TEXT,
  additional_evidence_needed TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS claims_investigation_idx ON claims(investigation_id);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  institution TEXT,
  source_type TEXT NOT NULL DEFAULT 'UNKNOWN',
  url_or_identifier TEXT,
  publication_date TIMESTAMPTZ,
  access_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  primary_or_secondary TEXT NOT NULL DEFAULT 'UNKNOWN',
  peer_review_status TEXT,
  correction_retraction_status TEXT,
  provenance_status TEXT NOT NULL DEFAULT 'UNASSESSED',
  funding_conflicts TEXT,
  credibility_score NUMERIC(6,2),
  included_in_synthesis BOOLEAN NOT NULL DEFAULT TRUE,
  retrieval_status TEXT NOT NULL DEFAULT 'DISCOVERED',
  information_origin_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sources_investigation_idx ON sources(investigation_id);
CREATE INDEX IF NOT EXISTS sources_origin_idx ON sources(information_origin_id);

CREATE TABLE IF NOT EXISTS claim_source_edges (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL,
  strength TEXT,
  locator TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(claim_id, source_id, relationship)
);

CREATE INDEX IF NOT EXISTS claim_source_edges_claim_idx ON claim_source_edges(claim_id);

CREATE TABLE IF NOT EXISTS evidence_chains (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  origin_source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  independence_assessment TEXT NOT NULL DEFAULT 'UNASSESSED',
  shared_wire_or_release BOOLEAN NOT NULL DEFAULT FALSE,
  shared_dataset BOOLEAN NOT NULL DEFAULT FALSE,
  shared_author BOOLEAN NOT NULL DEFAULT FALSE,
  shared_institution BOOLEAN NOT NULL DEFAULT FALSE,
  shared_funder BOOLEAN NOT NULL DEFAULT FALSE,
  downstream_source_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS search_logs (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  claim_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  database_or_platform TEXT NOT NULL,
  query_exact TEXT NOT NULL,
  language TEXT,
  jurisdiction TEXT,
  date_range TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result_count INTEGER,
  screened_count INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS retrieval_logs (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  claim_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method TEXT,
  reason_not_retrieved TEXT,
  alternate_source_found BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS redteam_reviews (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  reviewer_role TEXT NOT NULL,
  isolated_initial_review BOOLEAN NOT NULL DEFAULT TRUE,
  model_provider TEXT,
  model_version TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  output JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES redteam_reviews(id) ON DELETE CASCADE,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  attack_method TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  proposed_classification TEXT,
  proposed_confidence NUMERIC(6,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reconciliations (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL UNIQUE REFERENCES challenges(id) ON DELETE CASCADE,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  classification TEXT NOT NULL,
  evidence_for JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_against JSONB NOT NULL DEFAULT '[]'::jsonb,
  independently_reproduced BOOLEAN NOT NULL DEFAULT FALSE,
  adjudication TEXT NOT NULL,
  original_wording TEXT,
  revised_wording TEXT,
  original_confidence NUMERIC(6,3),
  revised_confidence NUMERIC(6,3),
  unresolved_issue TEXT,
  rationale TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_events_investigation_idx
  ON audit_events(investigation_id, created_at DESC);

COMMIT;
