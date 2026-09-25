import { createHash, randomUUID } from "crypto";
import { db } from "./client";

export interface ReportRecord {
  id: string;
  investigation_id: string;
  stage: "PRE_REDTEAM" | "FINAL";
  structured_content: unknown;
  markdown_content: string;
  sha256: string;
  model: string | null;
  ai_job_id: string | null;
  created_at: Date;
}

export async function createReport(input: {
  investigationId: string;
  stage: "PRE_REDTEAM" | "FINAL";
  structuredContent: unknown;
  markdownContent: string;
  model?: string | null;
  aiJobId?: string | null;
}): Promise<ReportRecord> {
  const sql = db();
  const sha256 = createHash("sha256")
    .update(input.markdownContent)
    .digest("hex");

  const [row] = await sql<ReportRecord[]>`
    INSERT INTO reports (
      id,
      investigation_id,
      stage,
      structured_content,
      markdown_content,
      sha256,
      model,
      ai_job_id
    )
    VALUES (
      ${"RPT-" + randomUUID()},
      ${input.investigationId},
      ${input.stage},
      ${sql.json(input.structuredContent as never)},
      ${input.markdownContent},
      ${sha256},
      ${input.model ?? null},
      ${input.aiJobId ?? null}
    )
    RETURNING *
  `;

  return row;
}

export async function getLatestReport(
  investigationId: string,
  stage: "PRE_REDTEAM" | "FINAL",
): Promise<ReportRecord | null> {
  const sql = db();
  const rows = await sql<ReportRecord[]>`
    SELECT *
    FROM reports
    WHERE investigation_id = ${investigationId}
      AND stage = ${stage}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listReports(
  investigationId: string,
): Promise<ReportRecord[]> {
  const sql = db();
  return sql<ReportRecord[]>`
    SELECT *
    FROM reports
    WHERE investigation_id = ${investigationId}
    ORDER BY created_at ASC
  `;
}


export async function getReport(
  investigationId: string,
  reportId: string,
): Promise<ReportRecord | null> {
  const sql = db();
  const rows = await sql<ReportRecord[]>`
    SELECT *
    FROM reports
    WHERE id = ${reportId}
      AND investigation_id = ${investigationId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}
