import { createHash, randomUUID } from "crypto";
import { db } from "./client";
import type {
  ClaimRecord,
  InvestigationRecord,
  SourceRecord,
} from "./types";
import { PROTOCOL } from "@/lib/protocol/manifest";
import type {
  InvestigationPhase,
  InvestigationState,
} from "@/lib/protocol/types";
import { canEnterPhase } from "@/lib/protocol/gates";

export interface CreateInvestigationInput {
  title: string;
  inputMaterial: string;
  investigationMode: string;
}

const PHASE_ORDER: InvestigationPhase[] = [
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
];

function expectedNextPhase(current: InvestigationPhase): InvestigationPhase | null {
  const index = PHASE_ORDER.indexOf(current);
  return PHASE_ORDER[index + 1] ?? null;
}

export async function createInvestigation(
  input: CreateInvestigationInput,
): Promise<InvestigationRecord> {
  const sql = db();
  const id = "INV-" + randomUUID();
  const [row] = await sql<InvestigationRecord[]>`
    INSERT INTO investigations (
      id,
      title,
      input_material,
      investigation_mode,
      current_phase,
      protocol_name,
      protocol_version,
      protocol_repository,
      protocol_release_ref,
      protocol_commit,
      protocol_snapshot
    )
    VALUES (
      ${id},
      ${input.title},
      ${input.inputMaterial},
      ${input.investigationMode},
      'INTAKE',
      ${PROTOCOL.name},
      ${PROTOCOL.version},
      ${PROTOCOL.repository},
      ${PROTOCOL.releaseRef},
      ${PROTOCOL.commit},
      ${sql.json(PROTOCOL as never)}
    )
    RETURNING *
  `;

  await appendAuditEvent(id, "INVESTIGATION_CREATED", {
    protocol: PROTOCOL,
    mode: input.investigationMode,
  });

  return row;
}

export async function listInvestigations(
  limit = 50,
): Promise<InvestigationRecord[]> {
  const sql = db();
  return sql<InvestigationRecord[]>`
    SELECT *
    FROM investigations
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `;
}

export async function getInvestigation(
  id: string,
): Promise<InvestigationRecord | null> {
  const sql = db();
  const rows = await sql<InvestigationRecord[]>`
    SELECT *
    FROM investigations
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getClaims(investigationId: string): Promise<ClaimRecord[]> {
  const sql = db();
  return sql<ClaimRecord[]>`
    SELECT *
    FROM claims
    WHERE investigation_id = ${investigationId}
    ORDER BY created_at ASC
  `;
}

export async function createClaim(
  investigationId: string,
  input: {
    text: string;
    claimType?: string;
    requiresPrimaryEvidence?: boolean;
  },
): Promise<ClaimRecord> {
  const sql = db();
  const id = "CLM-" + randomUUID();
  const [row] = await sql<ClaimRecord[]>`
    INSERT INTO claims (
      id,
      investigation_id,
      text,
      claim_type,
      requires_primary_evidence
    )
    VALUES (
      ${id},
      ${investigationId},
      ${input.text},
      ${input.claimType ?? "UNCLASSIFIED"},
      ${input.requiresPrimaryEvidence ?? false}
    )
    RETURNING *
  `;

  await touchInvestigation(investigationId);
  await appendAuditEvent(investigationId, "CLAIM_CREATED", { claimId: id });
  return row;
}

export async function getSources(
  investigationId: string,
): Promise<SourceRecord[]> {
  const sql = db();
  return sql<SourceRecord[]>`
    SELECT *
    FROM sources
    WHERE investigation_id = ${investigationId}
    ORDER BY created_at ASC
  `;
}

export async function createSource(
  investigationId: string,
  input: {
    title: string;
    sourceType?: string;
    urlOrIdentifier?: string;
    author?: string;
    institution?: string;
    primaryOrSecondary?: string;
  },
): Promise<SourceRecord> {
  const sql = db();
  const id = "SRC-" + randomUUID();
  const [row] = await sql<SourceRecord[]>`
    INSERT INTO sources (
      id,
      investigation_id,
      title,
      source_type,
      url_or_identifier,
      author,
      institution,
      primary_or_secondary
    )
    VALUES (
      ${id},
      ${investigationId},
      ${input.title},
      ${input.sourceType ?? "UNKNOWN"},
      ${input.urlOrIdentifier ?? null},
      ${input.author ?? null},
      ${input.institution ?? null},
      ${input.primaryOrSecondary ?? "UNKNOWN"}
    )
    RETURNING *
  `;

  await touchInvestigation(investigationId);
  await appendAuditEvent(investigationId, "SOURCE_CREATED", { sourceId: id });
  return row;
}

export async function buildInvestigationState(
  investigationId: string,
): Promise<InvestigationState> {
  const sql = db();
  const investigation = await getInvestigation(investigationId);
  if (!investigation) throw new Error("Investigation not found.");

  const [claimStats] = await sql<{
    claim_count: number;
    primary_required: number;
    primary_recovered: number;
    unresolved: number;
    critical: number;
  }[]>`
    SELECT
      COUNT(*)::int AS claim_count,
      COUNT(*) FILTER (WHERE requires_primary_evidence)::int AS primary_required,
      COUNT(*) FILTER (
        WHERE requires_primary_evidence AND primary_evidence_recovered
      )::int AS primary_recovered,
      COUNT(*) FILTER (WHERE unresolved_material_conflict)::int AS unresolved,
      COUNT(*) FILTER (WHERE critical_failure)::int AS critical
    FROM claims
    WHERE investigation_id = ${investigationId}
  `;

  const [sourceStats] = await sql<{
    source_count: number;
    retrieval_incomplete: number;
    provenance_incomplete: number;
    origin_unassessed: number;
  }[]>`
    SELECT
      COUNT(*)::int AS source_count,
      COUNT(*) FILTER (
        WHERE retrieval_status IN ('DISCOVERED', 'PENDING')
      )::int AS retrieval_incomplete,
      COUNT(*) FILTER (
        WHERE provenance_status = 'UNASSESSED'
      )::int AS provenance_incomplete,
      COUNT(*) FILTER (
        WHERE information_origin_id IS NULL
      )::int AS origin_unassessed
    FROM sources
    WHERE investigation_id = ${investigationId}
  `;

  const [redteamStats] = await sql<{
    total: number;
    incomplete: number;
  }[]>`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status <> 'COMPLETED')::int AS incomplete
    FROM redteam_reviews
    WHERE investigation_id = ${investigationId}
  `;

  const [reconciliationStats] = await sql<{
    challenge_count: number;
    reconciled: number;
  }[]>`
    SELECT
      (SELECT COUNT(*)::int FROM challenges
        WHERE investigation_id = ${investigationId}) AS challenge_count,
      (SELECT COUNT(*)::int FROM reconciliations
        WHERE investigation_id = ${investigationId}) AS reconciled
  `;

  const checkpoints = investigation.phase_checkpoints ?? {};

  return {
    phase: investigation.current_phase,
    claimCount: claimStats.claim_count,
    sourceCount: sourceStats.source_count,
    primaryEvidenceRequired: claimStats.primary_required,
    primaryEvidenceRecovered: claimStats.primary_recovered,
    screeningComplete: Boolean(checkpoints.SCREENING),
    retrievalOutcomesComplete:
      sourceStats.source_count > 0 && sourceStats.retrieval_incomplete === 0,
    provenanceComplete:
      sourceStats.source_count > 0 && sourceStats.provenance_incomplete === 0,
    sourceIndependenceAssessed:
      sourceStats.source_count > 0 && sourceStats.origin_unassessed === 0,
    claimSynthesisComplete: Boolean(checkpoints.SYNTHESIS),
    preRedTeamFrozen: Boolean(investigation.pre_redteam_frozen_at),
    redTeamCompleted:
      redteamStats.total >= PROTOCOL.rivalReviewerCount &&
      redteamStats.incomplete === 0,
    reconciliationCompleted:
      Boolean(checkpoints.RECONCILIATION) &&
      reconciliationStats.challenge_count === reconciliationStats.reconciled,
    unresolvedMaterialConflict: claimStats.unresolved > 0,
    criticalFailure: claimStats.critical > 0,
  };
}

export async function transitionInvestigation(
  investigationId: string,
  target: InvestigationPhase,
) {
  const sql = db();
  const investigation = await getInvestigation(investigationId);
  if (!investigation) throw new Error("Investigation not found.");

  const expected = expectedNextPhase(investigation.current_phase);
  if (target !== expected) {
    return {
      transitioned: false as const,
      gate: {
        allowed: false,
        blockers: [
          expected
            ? "Protocol phases are sequential. Expected next phase: " + expected + "."
            : "This investigation is already at the final phase.",
        ],
        warnings: [],
      },
    };
  }

  const state = await buildInvestigationState(investigationId);
  const gate = canEnterPhase(target, state);
  if (!gate.allowed) {
    return { transitioned: false as const, gate };
  }

  const finalizedAt =
    target === "FINAL" ? new Date() : investigation.finalized_at;

  const [row] = await sql<InvestigationRecord[]>`
    UPDATE investigations
    SET
      current_phase = ${target},
      finalized_at = ${finalizedAt},
      updated_at = NOW()
    WHERE id = ${investigationId}
    RETURNING *
  `;

  await appendAuditEvent(investigationId, "PHASE_TRANSITION", {
    from: investigation.current_phase,
    to: target,
    warnings: gate.warnings,
  });

  return { transitioned: true as const, gate, investigation: row };
}

export async function markPhaseCheckpoint(
  investigationId: string,
  phase: "SCREENING" | "SYNTHESIS" | "RECONCILIATION",
) {
  const sql = db();
  const investigation = await getInvestigation(investigationId);
  if (!investigation) throw new Error("Investigation not found.");

  if (investigation.current_phase !== phase) {
    throw new Error(
      "Checkpoint can only be completed for the current investigation phase.",
    );
  }

  if (phase === "RECONCILIATION") {
    const state = await buildInvestigationState(investigationId);
    const [counts] = await sql<{ challenge_count: number; reconciled: number }[]>`
      SELECT
        (SELECT COUNT(*)::int FROM challenges
          WHERE investigation_id = ${investigationId}) AS challenge_count,
        (SELECT COUNT(*)::int FROM reconciliations
          WHERE investigation_id = ${investigationId}) AS reconciled
    `;

    if (
      !state.redTeamCompleted ||
      counts.challenge_count !== counts.reconciled
    ) {
      throw new Error(
        "Reconciliation cannot be completed until the full RedTeam is complete and every challenge has a disposition.",
      );
    }
  }

  const [row] = await sql<InvestigationRecord[]>`
    UPDATE investigations
    SET
      phase_checkpoints =
        COALESCE(phase_checkpoints, '{}'::jsonb) ||
        jsonb_build_object(${phase}, true),
      updated_at = NOW()
    WHERE id = ${investigationId}
    RETURNING *
  `;

  await appendAuditEvent(investigationId, "PHASE_CHECKPOINT_COMPLETED", {
    phase,
  });

  return row;
}

export async function freezePreRedTeamDossier(investigationId: string) {
  const sql = db();
  const investigation = await getInvestigation(investigationId);
  if (!investigation) throw new Error("Investigation not found.");

  if (investigation.current_phase !== "PRE_REDTEAM") {
    throw new Error("The dossier can only be frozen during PRE_REDTEAM.");
  }

  if (investigation.pre_redteam_frozen_at) {
    throw new Error("The pre-RedTeam dossier is already frozen.");
  }

  const [claims, sources, state, evidenceChains, searchLogs, retrievalLogs] =
    await Promise.all([
      getClaims(investigationId),
      getSources(investigationId),
      buildInvestigationState(investigationId),
      sql`SELECT * FROM evidence_chains WHERE investigation_id = ${investigationId} ORDER BY created_at ASC`,
      sql`SELECT * FROM search_logs WHERE investigation_id = ${investigationId} ORDER BY executed_at ASC`,
      sql`SELECT * FROM retrieval_logs WHERE investigation_id = ${investigationId} ORDER BY attempted_at ASC`,
    ]);

  const frozenAt = new Date();
  const snapshot = {
    frozenAt: frozenAt.toISOString(),
    protocol: investigation.protocol_snapshot,
    investigation: {
      id: investigation.id,
      title: investigation.title,
      inputMaterial: investigation.input_material,
      mode: investigation.investigation_mode,
      phase: investigation.current_phase,
    },
    state,
    claims,
    sources,
    evidenceChains,
    searchLogs,
    retrievalLogs,
  };

  const canonicalJson = JSON.stringify(snapshot);
  const snapshotHash = createHash("sha256").update(canonicalJson).digest("hex");

  const [row] = await sql<InvestigationRecord[]>`
    UPDATE investigations
    SET
      pre_redteam_snapshot = ${sql.json(snapshot as never)},
      pre_redteam_snapshot_hash = ${snapshotHash},
      pre_redteam_frozen_at = ${frozenAt},
      updated_at = NOW()
    WHERE id = ${investigationId}
    RETURNING *
  `;

  await appendAuditEvent(investigationId, "PRE_REDTEAM_DOSSIER_FROZEN", {
    sha256: snapshotHash,
    frozenAt: frozenAt.toISOString(),
  });

  return { investigation: row, sha256: snapshotHash };
}

export async function appendAuditEvent(
  investigationId: string,
  eventType: string,
  payload: unknown,
) {
  const sql = db();
  await sql`
    INSERT INTO audit_events (id, investigation_id, event_type, payload)
    VALUES (
      ${"AUD-" + randomUUID()},
      ${investigationId},
      ${eventType},
      ${sql.json(payload as never)}
    )
  `;
}

async function touchInvestigation(id: string) {
  const sql = db();
  await sql`
    UPDATE investigations
    SET updated_at = NOW()
    WHERE id = ${id}
  `;
}
