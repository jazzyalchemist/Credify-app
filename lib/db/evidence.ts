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

export async function rebuildEvidenceChains(investigationId: string) {
  const sql = db();
  const sources = await sql<SourceRecord[]>`
    SELECT *
    FROM sources
    WHERE investigation_id = ${investigationId}
      AND screening_decision = 'INCLUDED'
      AND included_in_synthesis
      AND information_origin_status <> 'UNASSESSED'
    ORDER BY created_at ASC, id ASC
  `;

  await sql`
    DELETE FROM evidence_chains
    WHERE investigation_id = ${investigationId}
  `;

  const created: Array<{
    id: string;
    assessment: string;
    sourceIds: string[];
    origin: string | null;
    dependencyType: string | null;
    dependencyKey: string | null;
  }> = [];

  async function insertChain(input: {
    assessment: string;
    members: SourceRecord[];
    origin?: string | null;
    originSourceId?: string | null;
    dependencyType?: string | null;
    dependencyKey?: string | null;
    sharedWireOrRelease?: boolean;
    sharedDataset?: boolean;
    sharedAuthor?: boolean;
    sharedInstitution?: boolean;
    sharedFunder?: boolean;
    note: string;
  }) {
    const id = "CHAIN-" + randomUUID();
    const sourceIds = input.members.map((source) => source.id).sort();

    await sql`
      INSERT INTO evidence_chains (
        id,
        investigation_id,
        origin_source_id,
        independence_assessment,
        shared_wire_or_release,
        shared_dataset,
        shared_author,
        shared_institution,
        shared_funder,
        downstream_source_ids,
        notes
      )
      VALUES (
        ${id},
        ${investigationId},
        ${input.originSourceId ?? null},
        ${input.assessment},
        ${input.sharedWireOrRelease ?? false},
        ${input.sharedDataset ?? false},
        ${input.sharedAuthor ?? false},
        ${input.sharedInstitution ?? false},
        ${input.sharedFunder ?? false},
        ${sql.json(sourceIds as never)},
        ${input.note}
      )
    `;

    created.push({
      id,
      assessment: input.assessment,
      sourceIds,
      origin: input.origin ?? null,
      dependencyType: input.dependencyType ?? null,
      dependencyKey: input.dependencyKey ?? null,
    });
  }

  const originGroups = new Map<string, SourceRecord[]>();
  for (const source of sources) {
    const key =
      source.information_origin_status === "VERIFIED" &&
      source.information_origin_id
        ? "VERIFIED:" + source.information_origin_id
        : "UNRESOLVED:" + source.id;

    const group = originGroups.get(key) ?? [];
    group.push(source);
    originGroups.set(key, group);
  }

  for (const [key, members] of originGroups) {
    const verified = key.startsWith("VERIFIED:");
    const origin = verified ? key.slice("VERIFIED:".length) : null;
    const originSource =
      verified && origin
        ? members.find((source) => source.url_or_identifier === origin) ?? null
        : null;

    await insertChain({
      assessment: !verified
        ? "UNRESOLVED_ORIGIN"
        : members.length > 1
          ? "SHARED_INFORMATION_ORIGIN"
          : "DISTINCT_INFORMATION_ORIGIN",
      members,
      origin,
      originSourceId: originSource?.id ?? null,
      note: origin
        ? "Verified information origin: " + origin
        : "Information origin remained unresolved after audit.",
    });
  }

  type DependencyType =
    | "WIRE_OR_RELEASE"
    | "DATASET"
    | "AUTHOR"
    | "INSTITUTION"
    | "FUNDER";

  const dependencyGroups = new Map<
    string,
    { type: DependencyType; key: string; members: Map<string, SourceRecord> }
  >();

  function addDependency(
    type: DependencyType,
    keyValue: unknown,
    source: SourceRecord,
  ) {
    if (typeof keyValue !== "string") return;
    const key = keyValue.trim();
    if (!key) return;

    const mapKey = type + ":" + key;
    const group =
      dependencyGroups.get(mapKey) ??
      { type, key, members: new Map<string, SourceRecord>() };
    group.members.set(source.id, source);
    dependencyGroups.set(mapKey, group);
  }

  for (const source of sources) {
    const raw =
      source.independence_fingerprint &&
      typeof source.independence_fingerprint === "object" &&
      !Array.isArray(source.independence_fingerprint)
        ? (source.independence_fingerprint as Record<string, unknown>)
        : {};

    const wire =
      raw.wire_or_release &&
      typeof raw.wire_or_release === "object" &&
      !Array.isArray(raw.wire_or_release)
        ? (raw.wire_or_release as Record<string, unknown>)
        : {};
    addDependency("WIRE_OR_RELEASE", wire.key, source);

    for (const [field, type] of [
      ["datasets", "DATASET"],
      ["authors", "AUTHOR"],
      ["institutions", "INSTITUTION"],
      ["funders", "FUNDER"],
    ] as const) {
      const values = Array.isArray(raw[field]) ? raw[field] : [];
      for (const value of values) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        addDependency(type, (value as Record<string, unknown>).key, source);
      }
    }
  }

  for (const group of [...dependencyGroups.values()].sort((a, b) =>
    (a.type + ":" + a.key).localeCompare(b.type + ":" + b.key),
  )) {
    const members = [...group.members.values()];
    if (members.length < 2) continue;

    await insertChain({
      assessment: "DEPENDENCY_SHARED_" + group.type,
      members,
      dependencyType: group.type,
      dependencyKey: group.key,
      sharedWireOrRelease: group.type === "WIRE_OR_RELEASE",
      sharedDataset: group.type === "DATASET",
      sharedAuthor: group.type === "AUTHOR",
      sharedInstitution: group.type === "INSTITUTION",
      sharedFunder: group.type === "FUNDER",
      note:
        "Evidence-backed shared dependency signal (" +
        group.type +
        "): " +
        group.key +
        ". This is a dependence signal, not automatic proof that the evidence is invalid.",
    });
  }

  return created;
}
