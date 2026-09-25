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
