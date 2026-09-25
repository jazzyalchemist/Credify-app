export type InvestigationPhase =
  | "INTAKE"
  | "IDENTIFICATION"
  | "SCREENING"
  | "ELIGIBILITY"
  | "ANALYSIS"
  | "SYNTHESIS"
  | "PRE_REDTEAM"
  | "REDTEAM"
  | "RECONCILIATION"
  | "FINAL";

export type ClaimStatus =
  | "UNASSESSED"
  | "VERIFIED"
  | "HIGH_CONFIDENCE"
  | "TENTATIVE"
  | "UNKNOWN"
  | "CONTRADICTED"
  | "UPHELD"
  | "MODIFIED"
  | "DISPROVEN"
  | "UNCERTAIN";

export interface ProtocolSnapshot {
  name: string;
  version: string;
  repository: string;
  releaseRef: string;
  commit: string;
  credibilityMatrixTotal: number;
  rivalReviewerCount: number;
  canonical: boolean;
}

export interface InvestigationState {
  phase: InvestigationPhase;
  claimCount: number;
  sourceCount: number;
  primaryEvidenceRequired: number;
  primaryEvidenceRecovered: number;
  screeningComplete: boolean;
  retrievalOutcomesComplete: boolean;
  provenanceComplete: boolean;
  sourceIndependenceAssessed: boolean;
  claimSynthesisComplete: boolean;
  preRedTeamFrozen: boolean;
  redTeamCompleted: boolean;
  reconciliationCompleted: boolean;
  unresolvedMaterialConflict: boolean;
  criticalFailure: boolean;
}

export interface GateResult {
  allowed: boolean;
  blockers: string[];
  warnings: string[];
}
