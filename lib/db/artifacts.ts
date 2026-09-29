import { randomUUID } from "crypto";
import { db } from "./client";

export const MAX_ARTIFACT_BYTES = 4 * 1024 * 1024;
export const MAX_ARTIFACT_COUNT = 8;
export const MAX_TOTAL_ARTIFACT_BYTES = 16 * 1024 * 1024;

export const SUPPORTED_ARTIFACT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/markdown",
  "text/html",
  "text/xml",
  "application/xml",
  "application/json",
  "text/csv",
  "application/csv",
  "text/tab-separated-values",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/rtf",
  "text/rtf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
]);

export interface ArtifactRecord {
  id: string;
  investigation_id: string;
  source_id: string | null;
  role: string;
  original_filename: string;
  mime_type: string;
  byte_size: number | string;
  sha256: string;
  storage_provider: string;
  storage_key: string;
  capture_method: string;
  captured_at: Date;
  created_at: Date;
}

export async function listArtifacts(
  investigationId: string,
): Promise<ArtifactRecord[]> {
  const sql = db();
  return sql<ArtifactRecord[]>`
    SELECT *
    FROM artifacts
    WHERE investigation_id = ${investigationId}
    ORDER BY created_at ASC, id ASC
  `;
}

export async function getArtifact(
  investigationId: string,
  artifactId: string,
): Promise<ArtifactRecord | null> {
  const sql = db();
  const rows = await sql<ArtifactRecord[]>`
    SELECT *
    FROM artifacts
    WHERE investigation_id = ${investigationId}
      AND id = ${artifactId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getArtifactBySourceId(
  investigationId: string,
  sourceId: string,
): Promise<ArtifactRecord | null> {
  const sql = db();
  const rows = await sql<ArtifactRecord[]>`
    SELECT *
    FROM artifacts
    WHERE investigation_id = ${investigationId}
      AND source_id = ${sourceId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function findArtifactBySha(
  investigationId: string,
  sha256: string,
): Promise<ArtifactRecord | null> {
  const sql = db();
  const rows = await sql<ArtifactRecord[]>`
    SELECT *
    FROM artifacts
    WHERE investigation_id = ${investigationId}
      AND sha256 = ${sha256}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function assertArtifactUploadAllowed(investigationId: string) {
  const sql = db();
  const investigations = await sql<
    Array<{
      current_phase: string;
      pre_redteam_frozen_at: Date | null;
    }>
  >`
    SELECT current_phase, pre_redteam_frozen_at
    FROM investigations
    WHERE id = ${investigationId}
    LIMIT 1
  `;

  const investigation = investigations[0];
  if (!investigation) throw new Error("Investigation not found.");
  if (investigation.pre_redteam_frozen_at) {
    throw new Error("Artifacts are immutable after dossier freeze.");
  }
  if (!["INTAKE", "IDENTIFICATION"].includes(investigation.current_phase)) {
    throw new Error(
      "New artifacts may only be submitted during INTAKE or IDENTIFICATION.",
    );
  }

  const [stats] = await sql<
    Array<{ count: number; total_bytes: string }>
  >`
    SELECT
      COUNT(*)::int AS count,
      COALESCE(SUM(byte_size), 0)::text AS total_bytes
    FROM artifacts
    WHERE investigation_id = ${investigationId}
  `;

  return {
    count: Number(stats.count),
    totalBytes: Number(stats.total_bytes),
  };
}

export async function createArtifact(input: {
  id?: string;
  investigationId: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  storageKey: string;
  role?: string;
  captureMethod?: string;
}): Promise<ArtifactRecord> {
  const sql = db();
  const id = input.id ?? "ART-" + randomUUID();

  const [row] = await sql<ArtifactRecord[]>`
    INSERT INTO artifacts (
      id,
      investigation_id,
      role,
      original_filename,
      mime_type,
      byte_size,
      sha256,
      storage_provider,
      storage_key,
      capture_method
    )
    VALUES (
      ${id},
      ${input.investigationId},
      ${input.role ?? "SUBMITTED_MATERIAL"},
      ${input.originalFilename},
      ${input.mimeType},
      ${input.byteSize},
      ${input.sha256},
      'NETLIFY_BLOBS',
      ${input.storageKey},
      ${input.captureMethod ?? "USER_UPLOAD"}
    )
    RETURNING *
  `;

  return row;
}

export async function ensureArtifactSources(
  investigationId: string,
): Promise<Array<{ artifactId: string; sourceId: string }>> {
  const sql = db();

  return sql.begin(async (tx) => {
    const artifacts = await tx<ArtifactRecord[]>`
      SELECT *
      FROM artifacts
      WHERE investigation_id = ${investigationId}
      ORDER BY created_at ASC, id ASC
      FOR UPDATE
    `;

    const linked: Array<{ artifactId: string; sourceId: string }> = [];

    for (const artifact of artifacts) {
      if (artifact.source_id) {
        linked.push({
          artifactId: artifact.id,
          sourceId: artifact.source_id,
        });
        continue;
      }

      const sourceId = "SRC-" + randomUUID();
      await tx`
        INSERT INTO sources (
          id,
          investigation_id,
          title,
          source_type,
          url_or_identifier,
          primary_or_secondary,
          retrieval_status,
          provenance_status,
          metadata
        )
        VALUES (
          ${sourceId},
          ${investigationId},
          ${artifact.original_filename},
          'UPLOADED_ARTIFACT',
          ${"artifact:" + artifact.id},
          'UNKNOWN',
          'RETRIEVED',
          'UNASSESSED',
          ${tx.json({
            artifactId: artifact.id,
            sha256: artifact.sha256,
            mimeType: artifact.mime_type,
            byteSize: Number(artifact.byte_size),
            captureMethod: artifact.capture_method,
          } as never)}
        )
      `;

      await tx`
        UPDATE artifacts
        SET source_id = ${sourceId}
        WHERE id = ${artifact.id}
          AND investigation_id = ${investigationId}
      `;

      linked.push({ artifactId: artifact.id, sourceId });
    }

    return linked;
  });
}
