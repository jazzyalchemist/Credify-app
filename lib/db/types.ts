import type { InvestigationPhase } from "@/lib/protocol/types";

export interface InvestigationRecord {
  id: string;
  title: string;
  input_material: string;
  investigation_mode: string;
  current_phase: InvestigationPhase;
  protocol_name: string;
  protocol_version: string;
  protocol_repository: string;
  protocol_release_ref: string;
  protocol_commit: string;
  protocol_snapshot: unknown;
  phase_checkpoints: Record<string, boolean>;
  pre_redteam_snapshot: unknown | null;
  pre_redteam_snapshot_hash: string | null;
  pre_redteam_frozen_at: Date | null;
  finalized_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ClaimRecord {
  id: string;
  investigation_id: string;
  text: string;
  claim_type: string;
  first_pass_status: string;
  first_pass_confidence: string | null;
  final_status: string;
  final_confidence: string | null;
  final_wording: string | null;
  final_rationale: string | null;
  requires_primary_evidence: boolean;
  primary_evidence_recovered: boolean;
  critical_failure: boolean;
  unresolved_material_conflict: boolean;
  known_unknowns: string | null;
  additional_evidence_needed: string | null;
}

export interface SourceRecord {
  id: string;
  investigation_id: string;
  title: string;
  author: string | null;
  institution: string | null;
  source_type: string;
  url_or_identifier: string | null;
  primary_or_secondary: string;
  provenance_status: string;
  credibility_score: string | null;
  screening_decision: string;
  retrieval_status: string;
  included_in_synthesis: boolean;
  information_origin_id: string | null;
}
