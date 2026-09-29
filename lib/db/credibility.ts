import { randomUUID } from "crypto";
import { db } from "./client";
import { CREDIBILITY_DIMENSIONS } from "@/lib/protocol/scoring";

export type CredibilityDimensionKey =
  | "provenance_traceability"
  | "author_expertise"
  | "methodological_quality"
  | "citation_integrity"
  | "data_integrity"
  | "independent_corroboration"
  | "funding_conflicts"
  | "transparency_reproducibility"
  | "historical_cultural_temporal_context"
  | "media_digital_authenticity"
  | "corrections_research_integrity"
  | "adversarial_resilience";

export const DIMENSION_MAXIMA: Record<CredibilityDimensionKey, number> = {
  provenance_traceability: 12,
  author_expertise: 8,
  methodological_quality: 12,
  citation_integrity: 10,
  data_integrity: 10,
  independent_corroboration: 10,
  funding_conflicts: 8,
  transparency_reproducibility: 8,
  historical_cultural_temporal_context: 7,
  media_digital_authenticity: 5,
  corrections_research_integrity: 5,
  adversarial_resilience: 5,
};

if (
  Object.values(DIMENSION_MAXIMA).reduce((sum, value) => sum + value, 0) !==
  CREDIBILITY_DIMENSIONS.reduce((sum, [, value]) => sum + value, 0)
) {
  throw new Error("Credibility assessment maxima diverge from protocol matrix.");
}

export interface DimensionScore {
  score: number;
  rationale: string;
}

export type DimensionScores = Record<CredibilityDimensionKey, DimensionScore>;

export interface CredibilityAssessmentRecord {
  id: string;
  investigation_id: string;
  subject_type: string;
  subject_id: string;
  stage: string;
  dimension_scores: DimensionScores;
  total_score: string;
  critical_failures: unknown;
  rationale: unknown;
  evidence_refs: unknown;
  created_at: Date;
  updated_at: Date;
}

export function validateAndTotalDimensionScores(
  scores: DimensionScores,
): number {
  let total = 0;

  for (const [key, max] of Object.entries(DIMENSION_MAXIMA) as Array<
    [CredibilityDimensionKey, number]
  >) {
    const value = scores[key]?.score;
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > max
    ) {
      throw new Error(
        "Invalid credibility dimension score for " +
          key +
          ". Expected 0-" +
          max +
          ".",
      );
    }
    total += value;
  }

  return total;
}

export async function upsertCredibilityAssessment(input: {
  investigationId: string;
  subjectType: "SOURCE" | "CLAIM" | "INVESTIGATION";
  subjectId: string;
  stage?: "FIRST_PASS" | "FINAL";
  dimensionScores: DimensionScores;
  criticalFailures?: unknown[];
  rationale?: unknown;
  evidenceRefs?: unknown[];
}): Promise<CredibilityAssessmentRecord> {
  const sql = db();
  const total = validateAndTotalDimensionScores(input.dimensionScores);
  const stage = input.stage ?? "FIRST_PASS";

  const [row] = await sql<CredibilityAssessmentRecord[]>`
    INSERT INTO credibility_assessments (
      id,
      investigation_id,
      subject_type,
      subject_id,
      stage,
      dimension_scores,
      total_score,
      critical_failures,
      rationale,
      evidence_refs
    )
    VALUES (
      ${"CRA-" + randomUUID()},
      ${input.investigationId},
      ${input.subjectType},
      ${input.subjectId},
      ${stage},
      ${sql.json(input.dimensionScores as never)},
      ${total},
      ${sql.json((input.criticalFailures ?? []) as never)},
      ${sql.json((input.rationale ?? {}) as never)},
      ${sql.json((input.evidenceRefs ?? []) as never)}
    )
    ON CONFLICT (subject_type, subject_id, stage)
    DO UPDATE SET
      dimension_scores = EXCLUDED.dimension_scores,
      total_score = EXCLUDED.total_score,
      critical_failures = EXCLUDED.critical_failures,
      rationale = EXCLUDED.rationale,
      evidence_refs = EXCLUDED.evidence_refs,
      updated_at = NOW()
    RETURNING *
  `;

  return row;
}

export async function listCredibilityAssessments(
  investigationId: string,
): Promise<CredibilityAssessmentRecord[]> {
  const sql = db();
  return sql<CredibilityAssessmentRecord[]>`
    SELECT *
    FROM credibility_assessments
    WHERE investigation_id = ${investigationId}
    ORDER BY created_at ASC
  `;
}
