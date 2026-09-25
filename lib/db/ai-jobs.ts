import { randomUUID } from "crypto";
import { db } from "./client";

export type AiJobStatus =
  | "QUEUED"
  | "IN_PROGRESS"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface AiJobRecord {
  id: string;
  investigation_id: string;
  job_type: string;
  external_response_id: string;
  model: string;
  redteam_review_id: string | null;
  status: AiJobStatus;
  request_payload: unknown;
  result_payload: unknown | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export async function createAiJob(input: {
  investigationId: string;
  jobType: string;
  externalResponseId: string;
  model: string;
  status: AiJobStatus;
  requestPayload: unknown;
  redteamReviewId?: string | null;
}): Promise<AiJobRecord> {
  const sql = db();
  const id = "AIJ-" + randomUUID();
  const [row] = await sql<AiJobRecord[]>`
    INSERT INTO ai_jobs (
      id,
      investigation_id,
      job_type,
      external_response_id,
      model,
      status,
      request_payload,
      redteam_review_id
    )
    VALUES (
      ${id},
      ${input.investigationId},
      ${input.jobType},
      ${input.externalResponseId},
      ${input.model},
      ${input.status},
      ${sql.json(input.requestPayload as never)},
      ${input.redteamReviewId ?? null}
    )
    RETURNING *
  `;
  return row;
}

export async function getAiJob(
  investigationId: string,
  jobId: string,
): Promise<AiJobRecord | null> {
  const sql = db();
  const rows = await sql<AiJobRecord[]>`
    SELECT *
    FROM ai_jobs
    WHERE id = ${jobId} AND investigation_id = ${investigationId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listAiJobs(
  investigationId: string,
  limit = 20,
): Promise<AiJobRecord[]> {
  const sql = db();
  return sql<AiJobRecord[]>`
    SELECT *
    FROM ai_jobs
    WHERE investigation_id = ${investigationId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

export async function updateAiJobStatus(
  jobId: string,
  status: AiJobStatus,
): Promise<void> {
  const sql = db();
  await sql`
    UPDATE ai_jobs
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${jobId}
  `;
}

export async function claimAiJobForProcessing(
  jobId: string,
): Promise<AiJobRecord | null> {
  const sql = db();
  const rows = await sql<AiJobRecord[]>`
    UPDATE ai_jobs
    SET status = 'PROCESSING', updated_at = NOW()
    WHERE id = ${jobId}
      AND status IN ('QUEUED', 'IN_PROGRESS')
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function completeAiJob(
  jobId: string,
  resultPayload: unknown,
): Promise<void> {
  const sql = db();
  await sql`
    UPDATE ai_jobs
    SET
      status = 'COMPLETED',
      result_payload = ${sql.json(resultPayload as never)},
      error = NULL,
      completed_at = NOW(),
      updated_at = NOW()
    WHERE id = ${jobId}
  `;
}

export async function failAiJob(jobId: string, error: string): Promise<void> {
  const sql = db();
  await sql`
    UPDATE ai_jobs
    SET
      status = 'FAILED',
      error = ${error},
      completed_at = NOW(),
      updated_at = NOW()
    WHERE id = ${jobId}
  `;
}
