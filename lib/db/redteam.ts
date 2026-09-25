import { randomUUID } from "crypto";
import { db } from "./client";

export interface RedTeamReviewRecord {
  id: string;
  investigation_id: string;
  reviewer_role: string;
  isolated_initial_review: boolean;
  model_provider: string | null;
  model_version: string | null;
  status: string;
  started_at: Date | null;
  completed_at: Date | null;
  output: unknown;
}

export interface ChallengeRecord {
  id: string;
  review_id: string;
  investigation_id: string;
  claim_id: string;
  attack_method: string;
  evidence: unknown;
  proposed_classification: string | null;
  proposed_confidence: string | null;
  created_at: Date;
}

export interface ReconciliationRecord {
  id: string;
  challenge_id: string;
  investigation_id: string;
  classification: string;
  evidence_for: unknown;
  evidence_against: unknown;
  independently_reproduced: boolean;
  adjudication: string;
  original_wording: string | null;
  revised_wording: string | null;
  original_confidence: string | null;
  revised_confidence: string | null;
  unresolved_issue: string | null;
  rationale: string;
  created_at: Date;
}

export async function createRedTeamReview(input: {
  investigationId: string;
  reviewerRole: string;
  modelProvider?: string;
  modelVersion?: string;
}): Promise<RedTeamReviewRecord> {
  const sql = db();
  const id = "RTR-" + randomUUID();
  const [row] = await sql<RedTeamReviewRecord[]>`
    INSERT INTO redteam_reviews (
      id,
      investigation_id,
      reviewer_role,
      isolated_initial_review,
      model_provider,
      model_version,
      status,
      started_at
    )
    VALUES (
      ${id},
      ${input.investigationId},
      ${input.reviewerRole},
      true,
      ${input.modelProvider ?? "OpenAI"},
      ${input.modelVersion ?? null},
      'PENDING',
      NOW()
    )
    RETURNING *
  `;
  return row;
}

export async function listRedTeamReviews(
  investigationId: string,
): Promise<RedTeamReviewRecord[]> {
  const sql = db();
  return sql<RedTeamReviewRecord[]>`
    SELECT *
    FROM redteam_reviews
    WHERE investigation_id = ${investigationId}
    ORDER BY started_at ASC
  `;
}

export async function setRedTeamReviewStatus(
  reviewId: string,
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED",
  output?: unknown,
): Promise<void> {
  const sql = db();
  const completedAt = status === "COMPLETED" || status === "FAILED"
    ? new Date()
    : null;

  await sql`
    UPDATE redteam_reviews
    SET
      status = ${status},
      output = CASE
        WHEN ${output === undefined} THEN output
        ELSE ${sql.json((output ?? {}) as never)}
      END,
      completed_at = ${completedAt}
    WHERE id = ${reviewId}
  `;
}

export async function createChallenge(input: {
  reviewId: string;
  investigationId: string;
  claimId: string;
  attackMethod: string;
  evidence: unknown;
  proposedClassification?: string | null;
  proposedConfidence?: number | null;
}): Promise<ChallengeRecord> {
  const sql = db();
  const id = "CHL-" + randomUUID();
  const [row] = await sql<ChallengeRecord[]>`
    INSERT INTO challenges (
      id,
      review_id,
      investigation_id,
      claim_id,
      attack_method,
      evidence,
      proposed_classification,
      proposed_confidence
    )
    VALUES (
      ${id},
      ${input.reviewId},
      ${input.investigationId},
      ${input.claimId},
      ${input.attackMethod},
      ${sql.json(input.evidence as never)},
      ${input.proposedClassification ?? null},
      ${input.proposedConfidence ?? null}
    )
    RETURNING *
  `;
  return row;
}

export async function listChallenges(
  investigationId: string,
): Promise<ChallengeRecord[]> {
  const sql = db();
  return sql<ChallengeRecord[]>`
    SELECT *
    FROM challenges
    WHERE investigation_id = ${investigationId}
    ORDER BY created_at ASC
  `;
}

export async function listReconciliations(
  investigationId: string,
): Promise<ReconciliationRecord[]> {
  const sql = db();
  return sql<ReconciliationRecord[]>`
    SELECT *
    FROM reconciliations
    WHERE investigation_id = ${investigationId}
    ORDER BY created_at ASC
  `;
}

export async function createReconciliation(input: {
  challengeId: string;
  investigationId: string;
  classification: string;
  evidenceFor: unknown;
  evidenceAgainst: unknown;
  independentlyReproduced: boolean;
  adjudication: string;
  originalWording?: string | null;
  revisedWording?: string | null;
  originalConfidence?: number | null;
  revisedConfidence?: number | null;
  unresolvedIssue?: string | null;
  rationale: string;
}): Promise<ReconciliationRecord> {
  const sql = db();
  const id = "REC-" + randomUUID();
  const [row] = await sql<ReconciliationRecord[]>`
    INSERT INTO reconciliations (
      id,
      challenge_id,
      investigation_id,
      classification,
      evidence_for,
      evidence_against,
      independently_reproduced,
      adjudication,
      original_wording,
      revised_wording,
      original_confidence,
      revised_confidence,
      unresolved_issue,
      rationale
    )
    VALUES (
      ${id},
      ${input.challengeId},
      ${input.investigationId},
      ${input.classification},
      ${sql.json(input.evidenceFor as never)},
      ${sql.json(input.evidenceAgainst as never)},
      ${input.independentlyReproduced},
      ${input.adjudication},
      ${input.originalWording ?? null},
      ${input.revisedWording ?? null},
      ${input.originalConfidence ?? null},
      ${input.revisedConfidence ?? null},
      ${input.unresolvedIssue ?? null},
      ${input.rationale}
    )
    ON CONFLICT (challenge_id)
    DO UPDATE SET
      classification = EXCLUDED.classification,
      evidence_for = EXCLUDED.evidence_for,
      evidence_against = EXCLUDED.evidence_against,
      independently_reproduced = EXCLUDED.independently_reproduced,
      adjudication = EXCLUDED.adjudication,
      original_wording = EXCLUDED.original_wording,
      revised_wording = EXCLUDED.revised_wording,
      original_confidence = EXCLUDED.original_confidence,
      revised_confidence = EXCLUDED.revised_confidence,
      unresolved_issue = EXCLUDED.unresolved_issue,
      rationale = EXCLUDED.rationale
    RETURNING *
  `;
  return row;
}

export async function applyFinalClaimAssessment(input: {
  investigationId: string;
  claimId: string;
  status: "UPHELD" | "MODIFIED" | "DISPROVEN" | "UNCERTAIN";
  confidence: number;
  wording: string;
  rationale: string;
}): Promise<void> {
  const sql = db();
  await sql`
    UPDATE claims
    SET
      final_status = ${input.status},
      final_confidence = ${input.confidence},
      final_wording = ${input.wording},
      final_rationale = ${input.rationale},
      updated_at = NOW()
    WHERE id = ${input.claimId}
      AND investigation_id = ${input.investigationId}
  `;
}
