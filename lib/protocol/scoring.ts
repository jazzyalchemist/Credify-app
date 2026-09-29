export const CREDIBILITY_DIMENSIONS = [
  ["Provenance & Traceability", 12],
  ["Author Expertise", 8],
  ["Methodological Quality", 12],
  ["Citation Integrity", 10],
  ["Data Integrity", 10],
  ["Independent Corroboration", 10],
  ["Funding & Conflicts", 8],
  ["Transparency & Reproducibility", 8],
  ["Historical / Cultural / Temporal Context", 7],
  ["Media / Digital Authenticity", 5],
  ["Corrections / Research Integrity", 5],
  ["Adversarial Resilience", 5],
] as const;

export const CREDIBILITY_TOTAL = CREDIBILITY_DIMENSIONS.reduce(
  (sum, [, points]) => sum + points,
  0,
);

export function credibilityScoreCeiling(options: {
  criticalFailure: boolean;
  unresolvedMaterialConflict: boolean;
  missingRequiredPrimaryEvidence: boolean;
}): number {
  if (options.criticalFailure) return 49;
  if (options.unresolvedMaterialConflict) return 89;
  if (options.missingRequiredPrimaryEvidence) return 94;
  return 100;
}
