import type {
  GateResult,
  InvestigationPhase,
  InvestigationState,
} from "./types";

const pass = (warnings: string[] = []): GateResult => ({
  allowed: true,
  blockers: [],
  warnings,
});

const fail = (blockers: string[], warnings: string[] = []): GateResult => ({
  allowed: false,
  blockers,
  warnings,
});

export function canEnterPhase(
  target: InvestigationPhase,
  state: InvestigationState,
): GateResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (target === "IDENTIFICATION" && state.claimCount < 1) {
    blockers.push("At least one explicit claim or research question is required.");
  }

  if (target === "ELIGIBILITY" && !state.screeningComplete) {
    blockers.push("Screening dispositions must be complete before eligibility.");
  }

  if (target === "ANALYSIS") {
    if (!state.retrievalOutcomesComplete) {
      blockers.push("Every screened source needs a retrieval/eligibility outcome.");
    }
    if (!state.provenanceComplete) {
      blockers.push("Material sources require provenance analysis.");
    }
  }

  if (target === "SYNTHESIS") {
    if (!state.sourceIndependenceAssessed) {
      blockers.push("Information-origin independence must be assessed.");
    }
    if (state.sourceCount < 1) {
      blockers.push("Synthesis requires at least one evaluated source.");
    }
  }

  if (target === "PRE_REDTEAM" && !state.claimSynthesisComplete) {
    blockers.push("Every material claim needs a first-pass synthesis.");
  }

  if (target === "REDTEAM" && !state.preRedTeamFrozen) {
    blockers.push("Freeze and version the pre-RedTeam dossier first.");
  }

  if (target === "RECONCILIATION" && !state.redTeamCompleted) {
    blockers.push("Independent adversarial review must be completed.");
  }

  if (target === "FINAL") {
    if (!state.redTeamCompleted) {
      blockers.push("Final report blocked: RedTeam has not completed.");
    }
    if (!state.reconciliationCompleted) {
      blockers.push("Final report blocked: reconciliation has not completed.");
    }
    if (state.unresolvedMaterialConflict) {
      warnings.push(
        "Material conflict remains unresolved; final confidence must be constrained.",
      );
    }
    if (
      state.primaryEvidenceRequired > state.primaryEvidenceRecovered
    ) {
      warnings.push(
        "Some claims requiring primary evidence still lack recovered primary sources.",
      );
    }
    if (state.criticalFailure) {
      warnings.push(
        "Critical-failure override is active; aggregate scores cannot supersede it.",
      );
    }
  }

  return blockers.length ? fail(blockers, warnings) : pass(warnings);
}
