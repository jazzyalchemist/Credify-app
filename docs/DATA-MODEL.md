# Credify Data Model — v0.1 Draft

## Investigation

- id
- title
- input_material
- investigation_mode
- current_phase
- protocol_name
- protocol_version
- protocol_repository
- protocol_commit
- created_at
- updated_at
- pre_redteam_frozen_at
- finalized_at

## Claim

- id
- investigation_id
- text
- claim_type
- first_pass_status
- first_pass_confidence
- final_status
- final_confidence
- critical_failure
- unresolved_material_conflict
- known_unknowns
- additional_evidence_needed

## Source

- id
- investigation_id
- title
- author
- institution
- source_type
- url_or_identifier
- publication_date
- access_date
- primary_or_secondary
- peer_review_status
- correction_retraction_status
- provenance_status
- funding_conflicts
- credibility_score
- included_in_synthesis
- retrieval_status

## ClaimSourceEdge

Represents support, contradiction, context, or provenance relationship between a claim and a source.

- claim_id
- source_id
- relationship
- strength
- locator
- notes

## EvidenceChain

- id
- investigation_id
- origin_source_id
- independence_assessment
- shared_wire_or_release
- shared_dataset
- shared_author
- shared_institution
- shared_funder
- downstream_source_ids

## SearchLog

- search_id
- investigation_id
- claim_ids
- database_or_platform
- query_exact
- language
- jurisdiction
- date_range
- executed_at
- result_count

## RetrievalLog

- retrieval_id
- source_id
- status
- attempted_at
- failure_reason
- alternate_source_found

## RedTeamReview

- id
- investigation_id
- reviewer_role
- isolated_initial_review
- model_provider
- model_version
- started_at
- completed_at

## Challenge

- id
- review_id
- claim_id
- attack_method
- evidence
- proposed_classification
- proposed_confidence

## Reconciliation

- challenge_id
- classification
- evidence_for
- evidence_against
- independently_reproduced
- adjudication
- original_wording
- revised_wording
- original_confidence
- revised_confidence
- unresolved_issue
- rationale

## Artifact

- id
- investigation_id
- source_id
- type
- object_storage_key
- sha256
- original_filename
- mime_type
- captured_at
