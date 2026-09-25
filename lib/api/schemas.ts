import { z } from "zod";

export const createInvestigationSchema = z.object({
  title: z.string().trim().min(3).max(180),
  inputMaterial: z.string().trim().min(3).max(100_000),
  investigationMode: z.enum([
    "AUTO",
    "ACADEMIC",
    "NEWS",
    "HISTORICAL",
    "MEDIA",
    "CORPORATE",
    "OSINT",
  ]),
});

export const createClaimSchema = z.object({
  text: z.string().trim().min(3).max(10_000),
  claimType: z.string().trim().min(2).max(80).optional(),
  requiresPrimaryEvidence: z.boolean().optional(),
});

export const createSourceSchema = z.object({
  title: z.string().trim().min(2).max(500),
  sourceType: z.string().trim().min(2).max(80).optional(),
  urlOrIdentifier: z.string().trim().max(2_000).optional(),
  author: z.string().trim().max(300).optional(),
  institution: z.string().trim().max(300).optional(),
  primaryOrSecondary: z.enum(["PRIMARY", "SECONDARY", "UNKNOWN"]).optional(),
});

export const transitionSchema = z.object({
  target: z.enum([
    "INTAKE",
    "IDENTIFICATION",
    "SCREENING",
    "ELIGIBILITY",
    "ANALYSIS",
    "SYNTHESIS",
    "PRE_REDTEAM",
    "REDTEAM",
    "RECONCILIATION",
    "FINAL",
  ]),
});

export const updateClaimSchema = z
  .object({
    claimType: z.string().trim().min(2).max(80).optional(),
    firstPassStatus: z
      .enum([
        "UNASSESSED",
        "VERIFIED",
        "HIGH_CONFIDENCE",
        "TENTATIVE",
        "UNKNOWN",
        "CONTRADICTED",
      ])
      .optional(),
    firstPassConfidence: z.number().min(0).max(100).nullable().optional(),
    requiresPrimaryEvidence: z.boolean().optional(),
    primaryEvidenceRecovered: z.boolean().optional(),
    criticalFailure: z.boolean().optional(),
    unresolvedMaterialConflict: z.boolean().optional(),
    knownUnknowns: z.string().max(20_000).nullable().optional(),
    additionalEvidenceNeeded: z.string().max(20_000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "No fields supplied.");

export const updateSourceSchema = z
  .object({
    author: z.string().trim().max(300).nullable().optional(),
    institution: z.string().trim().max(300).nullable().optional(),
    sourceType: z.string().trim().min(2).max(80).optional(),
    primaryOrSecondary: z.enum(["PRIMARY", "SECONDARY", "UNKNOWN"]).optional(),
    screeningDecision: z
      .enum(["PENDING", "INCLUDED", "EXCLUDED"])
      .optional(),
    provenanceStatus: z
      .enum(["UNASSESSED", "VERIFIED", "PARTIAL", "FAILED"])
      .optional(),
    retrievalStatus: z
      .enum([
        "DISCOVERED",
        "PENDING",
        "RETRIEVED",
        "PARTIAL",
        "NOT_RETRIEVED",
        "EXCLUDED",
      ])
      .optional(),
    informationOriginId: z.string().trim().max(500).nullable().optional(),
    credibilityScore: z.number().min(0).max(100).nullable().optional(),
    includedInSynthesis: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "No fields supplied.");

export const checkpointSchema = z.object({
  phase: z.enum(["SCREENING", "SYNTHESIS", "RECONCILIATION"]),
});
