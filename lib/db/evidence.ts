import { randomUUID } from "crypto";
import { db } from "./client";
import type { SourceRecord } from "./types";

export async function findSourceByUrl(
  investigationId: string,
  url: string,
): Promise<SourceRecord | null> {
  const sql = db();
  const rows = await sql<SourceRecord[]>`
    SELECT *
    FROM sources
    WHERE investigation_id = ${investigationId}
      AND url_or_identifier = ${url}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function linkClaimSource(input: {
  investigationId: string;
  claimId: string;
  sourceId: string;
  relationship: string;
  strength?: string | null;
  locator?: string | null;
  notes?: string | null;
}) {
  const sql = db();
  await sql`
    INSERT INTO claim_source_edges (
      id,
      investigation_id,
      claim_id,
      source_id,
      relationship,
      strength,
      locator,
      notes
    )
    VALUES (
      ${"EDGE-" + randomUUID()},
      ${input.investigationId},
      ${input.claimId},
      ${input.sourceId},
      ${input.relationship},
      ${input.strength ?? null},
      ${input.locator ?? null},
      ${input.notes ?? null}
    )
    ON CONFLICT (claim_id, source_id, relationship)
    DO UPDATE SET
      strength = EXCLUDED.strength,
      locator = EXCLUDED.locator,
      notes = EXCLUDED.notes
  `;
}

export async function createSearchLog(input: {
  investigationId: string;
  claimIds: string[];
  databaseOrPlatform: string;
  queryExact: string;
  language?: string | null;
  jurisdiction?: string | null;
  resultCount?: number | null;
  notes?: string | null;
}) {
  const sql = db();
  await sql`
    INSERT INTO search_logs (
      id,
      investigation_id,
      claim_ids,
      database_or_platform,
      query_exact,
      language,
      jurisdiction,
      result_count,
      notes
    )
    VALUES (
      ${"SEA-" + randomUUID()},
      ${input.investigationId},
      ${sql.json(input.claimIds as never)},
      ${input.databaseOrPlatform},
      ${input.queryExact},
      ${input.language ?? null},
      ${input.jurisdiction ?? null},
      ${input.resultCount ?? null},
      ${input.notes ?? null}
    )
  `;
}


export async function listClaimSourceEdges(investigationId: string) {
  const sql = db();
  return sql`
    SELECT *
    FROM claim_source_edges
    WHERE investigation_id = ${investigationId}
    ORDER BY created_at ASC
  `;
}


export async function listEvidenceChains(investigationId: string) {
  const sql = db();
  return sql`
    SELECT *
    FROM evidence_chains
    WHERE investigation_id = ${investigationId}
    ORDER BY created_at ASC
  `;
}
