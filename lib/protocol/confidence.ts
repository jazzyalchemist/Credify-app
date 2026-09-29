export type FirstPassConfidenceStatus =
  | "VERIFIED"
  | "HIGH_CONFIDENCE"
  | "TENTATIVE"
  | "UNKNOWN"
  | "CONTRADICTED";

export type TemporalAlignment =
  | "ALIGNED"
  | "PARTIAL"
  | "MISALIGNED"
  | "UNKNOWN"
  | "NOT_TIME_SENSITIVE";

export function confidenceBand(confidence: number) {
  if (confidence > 99.999) return "EXTRAORDINARY";
  if (confidence >= 99) return "EXTREMELY_HIGH";
  if (confidence >= 95) return "VERY_HIGH";
  if (confidence >= 90) return "HIGH";
  if (confidence >= 75) return "MODERATELY_HIGH";
  if (confidence >= 60) return "TENTATIVE";
  if (confidence >= 40) return "UNCERTAIN";
  return "WEAK_OR_INSUFFICIENT";
}

function assertRange(confidence: number) {
  if (
    typeof confidence !== "number" ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 100
  ) {
    throw new Error("Confidence must be a finite number from 0 to 100.");
  }
}

export function validateFirstPassConfidence(input: {
  status: FirstPassConfidenceStatus;
  confidence: number;
  requiresPrimaryEvidence: boolean;
  primaryEvidenceRecovered: boolean;
  unresolvedMaterialConflict: boolean;
  criticalFailure: boolean;
  temporalAlignment: TemporalAlignment;
  credibilityMatrixScore: number;
}) {
  assertRange(input.confidence);

  if (input.status === "VERIFIED" && input.confidence < 95) {
    throw new Error("VERIFIED requires at least 95% proposition confidence.");
  }
  if (
    input.status === "HIGH_CONFIDENCE" &&
    (input.confidence < 90 || input.confidence >= 99.999)
  ) {
    throw new Error(
      "HIGH_CONFIDENCE requires 90% to less than 99.999% proposition confidence.",
    );
  }
  if (input.status === "TENTATIVE" && input.confidence > 75) {
    throw new Error("TENTATIVE cannot exceed 75% proposition confidence.");
  }
  if (input.status === "UNKNOWN" && input.confidence > 60) {
    throw new Error("UNKNOWN cannot exceed 60% proposition confidence.");
  }
  if (input.status === "CONTRADICTED" && input.confidence > 40) {
    throw new Error(
      "CONTRADICTED cannot exceed 40% confidence that the proposition is true.",
    );
  }

  if (input.unresolvedMaterialConflict && input.confidence > 75) {
    throw new Error(
      "An unresolved material conflict caps proposition confidence at 75%.",
    );
  }

  if (input.criticalFailure && input.confidence > 75) {
    throw new Error(
      "A critical evidentiary failure caps proposition confidence at 75%.",
    );
  }

  if (
    input.requiresPrimaryEvidence &&
    !input.primaryEvidenceRecovered &&
    input.confidence > 90
  ) {
    throw new Error(
      "A claim missing required primary evidence cannot exceed 90% confidence.",
    );
  }

  if (
    input.temporalAlignment === "MISALIGNED" &&
    input.confidence > 75
  ) {
    throw new Error(
      "Temporally misaligned evidence cannot support more than 75% proposition confidence.",
    );
  }

  if (input.confidence > 99.999) {
    if (
      input.status !== "VERIFIED" ||
      input.unresolvedMaterialConflict ||
      input.criticalFailure ||
      (input.requiresPrimaryEvidence && !input.primaryEvidenceRecovered) ||
      !["ALIGNED", "NOT_TIME_SENSITIVE"].includes(input.temporalAlignment) ||
      input.credibilityMatrixScore < 95
    ) {
      throw new Error(
        "Extraordinary confidence above 99.999% requires VERIFIED status, no unresolved/critical failure, required primary evidence, temporal alignment, and a credibility matrix score of at least 95.",
      );
    }
  }

  return {
    confidence: input.confidence,
    band: confidenceBand(input.confidence),
  };
}

export function validateFinalConfidence(input: {
  status: "UPHELD" | "MODIFIED" | "DISPROVEN" | "UNCERTAIN";
  confidence: number;
  unresolvedChallengeCount: number;
  investigationCriticalFailureCount: number;
  finalMatrixScore: number;
}) {
  assertRange(input.confidence);

  if (input.status === "UNCERTAIN" && input.confidence > 60) {
    throw new Error(
      "UNCERTAIN final wording cannot exceed 60% confidence.",
    );
  }

  if (
    input.unresolvedChallengeCount > 0 &&
    input.confidence > 75
  ) {
    throw new Error(
      "Unresolved RedTeam challenges cap final confidence at 75%.",
    );
  }

  if (
    input.investigationCriticalFailureCount > 0 &&
    input.confidence > 75
  ) {
    throw new Error(
      "Critical final evidentiary failures cap confidence at 75%.",
    );
  }

  if (
    input.confidence > 99.999 &&
    (input.unresolvedChallengeCount > 0 ||
      input.investigationCriticalFailureCount > 0 ||
      input.finalMatrixScore < 95)
  ) {
    throw new Error(
      "Extraordinary final confidence above 99.999% requires no unresolved challenges, no critical evidentiary failures, and a final credibility matrix score of at least 95.",
    );
  }

  return {
    confidence: input.confidence,
    band: confidenceBand(input.confidence),
  };
}
