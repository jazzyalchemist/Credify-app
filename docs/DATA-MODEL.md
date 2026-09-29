# Credify Data Model — v0.1

This document describes the schema actually implemented by the ordered SQL migrations in `db/migrations/`.

## Investigation

Table: `investigations`

Core identity / input:

- `id`
- `title`
- `input_material`
- `investigation_mode`
- `current_phase`
- `created_at`
- `updated_at`

Protocol provenance:

- `protocol_name`
- `protocol_version`
- `protocol_repository`
- `protocol_release_ref`
- `protocol_commit`
- `protocol_snapshot`

Workflow / freeze:

- `phase_checkpoints`
- `pre_redteam_snapshot`
- `pre_redteam_snapshot_hash`
- `pre_redteam_frozen_at`
- `finalized_at`

## Claim

Table: `claims`

- `id`
- `investigation_id`
- `text`
- `claim_type`
- `requires_primary_evidence`
- `primary_evidence_recovered`
- `first_pass_status`
- `first_pass_confidence`
- `critical_failure`
- `unresolved_material_conflict`
- `known_unknowns`
- `additional_evidence_needed`
- `final_status`
- `final_confidence`
- `final_wording`
- `final_rationale`
- timestamps

First-pass and final fields are deliberately separate so adversarial reconciliation cannot overwrite the original Page-1 state without leaving a trace.

## Source

Table: `sources`

- `id`
- `investigation_id`
- `title`
- `author`
- `institution`
- `source_type`
- `url_or_identifier`
- `publication_date`
- `access_date`
- `primary_or_secondary`
- `peer_review_status`
- `correction_retraction_status`
- `screening_decision`
- `provenance_status`
- `funding_conflicts`
- `credibility_score`
- `included_in_synthesis`
- `retrieval_status`
- `information_origin_id`
- `information_origin_status`
- `metadata`
- timestamps

`information_origin_status` distinguishes an origin that was never assessed from one that was seriously investigated but remained unresolved.

## ClaimSourceEdge

Table: `claim_source_edges`

Represents support, contradiction, context, or provenance relationships.

- `id`
- `investigation_id`
- `claim_id`
- `source_id`
- `relationship`
- `strength`
- `locator`
- `notes`
- `created_at`

Uniqueness: `claim_id + source_id + relationship`.

## EvidenceChain

Table: `evidence_chains`

- `id`
- `investigation_id`
- `origin_source_id`
- `independence_assessment`
- `shared_wire_or_release`
- `shared_dataset`
- `shared_author`
- `shared_institution`
- `shared_funder`
- `downstream_source_ids`
- `notes`
- `created_at`

Credify rebuilds these records from audited information-origin state so repeated downstream URLs do not become fake independent corroboration.

## CredibilityAssessment

Table: `credibility_assessments`

- `id`
- `investigation_id`
- `subject_type`
- `subject_id`
- `stage`
- `dimension_scores`
- `total_score`
- `critical_failures`
- `rationale`
- `evidence_refs`
- timestamps

Uniqueness: `subject_type + subject_id + stage`.

The 12 dimension scores are persisted separately from the aggregate total.

## SearchLog

Table: `search_logs`

- `id`
- `investigation_id`
- `claim_ids`
- `database_or_platform`
- `query_exact`
- `language`
- `jurisdiction`
- `date_range`
- `executed_at`
- `result_count`
- `screened_count`
- `notes`

## RetrievalLog

Table: `retrieval_logs`

- `id`
- `investigation_id`
- `source_id`
- `claim_ids`
- `status`
- `attempted_at`
- `method`
- `reason_not_retrieved`
- `alternate_source_found`
- `notes`

## AIJob

Table: `ai_jobs`

- `id`
- `investigation_id`
- `job_type`
- `subject_id`
- `external_response_id`
- `model`
- `status`
- `request_payload`
- `result_payload`
- `error`
- `redteam_review_id`
- `created_at`
- `updated_at`
- `completed_at`

Statuses:

- `QUEUED`
- `IN_PROGRESS`
- `PROCESSING`
- `COMPLETED`
- `FAILED`

Database indexes enforce active singleton stages, per-source audit uniqueness, one AI job per RedTeam reviewer, and one nonfailed reconciliation run.

## RedTeamReview

Table: `redteam_reviews`

- `id`
- `investigation_id`
- `reviewer_role`
- `isolated_initial_review`
- `model_provider`
- `model_version`
- `status`
- `started_at`
- `completed_at`
- `output`

A partial unique index permits at most one `PENDING / IN_PROGRESS / COMPLETED` record for each investigation + role while allowing failed historical attempts to remain in the audit trail.

## Challenge

Table: `challenges`

- `id`
- `review_id`
- `investigation_id`
- `claim_id`
- `attack_method`
- `evidence`
- `proposed_classification`
- `proposed_confidence`
- `created_at`

## Reconciliation

Table: `reconciliations`

- `id`
- `challenge_id`
- `investigation_id`
- `classification`
- `evidence_for`
- `evidence_against`
- `independently_reproduced`
- `adjudication`
- `original_wording`
- `revised_wording`
- `original_confidence`
- `revised_confidence`
- `unresolved_issue`
- `rationale`
- `created_at`

Uniqueness: one reconciliation row per challenge.

## Report

Table: `reports`

- `id`
- `investigation_id`
- `stage` (`PRE_REDTEAM` or `FINAL`)
- `structured_content`
- `markdown_content`
- `sha256`
- `model`
- `ai_job_id`
- `created_at`

Reports are append-only versioned artifacts. The pre-RedTeam report included in the frozen dossier is identified by ID and SHA-256.

## AuditEvent

Table: `audit_events`

- `id`
- `investigation_id`
- `event_type`
- `actor`
- `payload`
- `created_at`

The frozen Page-1 dossier contains the full audit chronology that existed before the freeze event itself.

## Not implemented in v0.1

There is currently **no object-storage Artifact table** for uploaded files, images, datasets, archived webpages, or binary evidence. Adding binary/file ingestion requires a future schema and provenance design; it should not be inferred from this v0.1 data model.
