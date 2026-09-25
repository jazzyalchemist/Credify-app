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

async function assertPageOneMutable(investigationId: string) {
  const investigation = await getInvestigation(investigationId);
  if (!investigation) throw new Error("Investigation not found.");
  if (investigation.pre_redteam_frozen_at) {
    throw new Error(
      "Page-1 evidence is immutable after the pre-RedTeam dossier is frozen.",
    );
  }
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
  await assertPageOneMutable(investigationId);
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
  await assertPageOneMutable(investigationId);
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

export async function updateClaim(
  investigationId: string,
  claimId: string,
  input: {
    claimType?: string;
    firstPassStatus?: string;
    firstPassConfidence?: number | null;
    requiresPrimaryEvidence?: boolean;
    primaryEvidenceRecovered?: boolean;
    criticalFailure?: boolean;
    unresolvedMaterialConflict?: boolean;
    knownUnknowns?: string | null;
    additionalEvidenceNeeded?: string | null;
  },
): Promise<ClaimRecord | null> {
  await assertPageOneMutable(investigationId);
  const sql = db();
  const current = await sql<ClaimRecord[]>`
    SELECT * FROM claims
    WHERE id = ${claimId} AND investigation_id = ${investigationId}
    LIMIT 1
  `;
  if (!current[0]) return null;

  const next = {
    claimType: input.claimType ?? current[0].claim_type,
    firstPassStatus: input.firstPassStatus ?? current[0].first_pass_status,
    firstPassConfidence:
      input.firstPassConfidence === undefined
        ? current[0].first_pass_confidence
        : input.firstPassConfidence,
    requiresPrimaryEvidence:
      input.requiresPrimaryEvidence ?? current[0].requires_primary_evidence,
    primaryEvidenceRecovered:
      input.primaryEvidenceRecovered ?? current[0].primary_evidence_recovered,
    criticalFailure: input.criticalFailure ?? current[0].critical_failure,
    unresolvedMaterialConflict:
      input.unresolvedMaterialConflict ??
      current[0].unresolved_material_conflict,
    knownUnknowns:
      input.knownUnknowns === undefined
        ? current[0].known_unknowns
        : input.knownUnknowns,
    additionalEvidenceNeeded:
      input.additionalEvidenceNeeded === undefined
        ? current[0].additional_evidence_needed
        : input.additionalEvidenceNeeded,
  };

  const [row] = await sql<ClaimRecord[]>`
    UPDATE claims
    SET
      claim_type = ${next.claimType},
      first_pass_status = ${next.firstPassStatus},
      first_pass_confidence = ${next.firstPassConfidence},
      requires_primary_evidence = ${next.requiresPrimaryEvidence},
      primary_evidence_recovered = ${next.primaryEvidenceRecovered},
      critical_failure = ${next.criticalFailure},
      unresolved_material_conflict = ${next.unresolvedMaterialConflict},
      known_unknowns = ${next.knownUnknowns},
      additional_evidence_needed = ${next.additionalEvidenceNeeded},
      updated_at = NOW()
    WHERE id = ${claimId} AND investigation_id = ${investigationId}
    RETURNING *
  `;

  await touchInvestigation(investigationId);
  await appendAuditEvent(investigationId, "CLAIM_UPDATED", {
    claimId,
    fields: Object.keys(input),
  });
  return row ?? null;
}

export async function updateSource(
  investigationId: string,
  sourceId: string,
  input: {
    author?: string | null;
    institution?: string | null;
    sourceType?: string;
    primaryOrSecondary?: string;
    screeningDecision?: string;
    provenanceStatus?: string;
    retrievalStatus?: string;
    informationOriginId?: string | null;
    credibilityScore?: number | null;
    includedInSynthesis?: boolean;
  },
): Promise<SourceRecord | null> {
  await assertPageOneMutable(investigationId);
  const sql = db();
  const current = await sql<SourceRecord[]>`
    SELECT * FROM sources
    WHERE id = ${sourceId} AND investigation_id = ${investigationId}
    LIMIT 1
  `;
  if (!current[0]) return null;

  const next = {
    author: input.author === undefined ? current[0].author : input.author,
    institution:
      input.institution === undefined ? current[0].institution : input.institution,
    sourceType: input.sourceType ?? current[0].source_type,
    primaryOrSecondary:
      input.primaryOrSecondary ?? current[0].primary_or_secondary,
    screeningDecision:
      input.screeningDecision ?? current[0].screening_decision,
    provenanceStatus:
      input.provenanceStatus ?? current[0].provenance_status,
    retrievalStatus:
      input.retrievalStatus ?? current[0].retrieval_status,
    informationOriginId:
      input.informationOriginId === undefined
        ? current[0].information_origin_id
        : input.informationOriginId,
    credibilityScore:
      input.credibilityScore === undefined
        ? current[0].credibility_score
        : input.credibilityScore,
    includedInSynthesis:
      input.includedInSynthesis ?? current[0].included_in_synthesis,
  };

  const [row] = await sql<SourceRecord[]>`
    UPDATE sources
    SET
      author = ${next.author},
      institution = ${next.institution},
      source_type = ${next.sourceType},
      primary_or_secondary = ${next.primaryOrSecondary},
      screening_decision = ${next.screeningDecision},
      provenance_status = ${next.provenanceStatus},
      retrieval_status = ${next.retrievalStatus},
      information_origin_id = ${next.informationOriginId},
      credibility_score = ${next.credibilityScore},
      included_in_synthesis = ${next.includedInSynthesis},
      updated_at = NOW()
    WHERE id = ${sourceId} AND investigation_id = ${investigationId}
    RETURNING *
  `;

  await touchInvestigation(investigationId);
  await appendAuditEvent(investigationId, "SOURCE_UPDATED", {
    sourceId,
    fields: Object.keys(input),
  });
  return row ?? null;
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
      COUNT(*) FILTER (
        WHERE screening_decision = 'INCLUDED' AND included_in_synthesis
      )::int AS source_count,
      COUNT(*) FILTER (
        WHERE screening_decision = 'INCLUDED'
          AND included_in_synthesis
          AND retrieval_status IN ('DISCOVERED', 'PENDING')
      )::int AS retrieval_incomplete,
      COUNT(*) FILTER (
        WHERE screening_decision = 'INCLUDED'
          AND included_in_synthesis
          AND provenance_status = 'UNASSESSED'
      )::int AS provenance_incomplete,
      COUNT(*) FILTER (
        WHERE screening_decision = 'INCLUDED'
          AND included_in_synthesis
          AND information_origin_id IS NULL
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

  if (phase === "SCREENING") {
    const [counts] = await sql<{
      total: number;
      pending: number;
      included: number;
    }[]>`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE screening_decision = 'PENDING')::int AS pending,
        COUNT(*) FILTER (WHERE screening_decision = 'INCLUDED')::int AS included
      FROM sources
      WHERE investigation_id = ${investigationId}
    `;

    if (counts.total < 1) {
      throw new Error("Screening cannot complete without identified sources.");
    }
    if (counts.pending > 0) {
      throw new Error(
        "Every identified source needs an INCLUDED or EXCLUDED screening disposition.",
      );
    }
    if (counts.included < 1) {
      throw new Error(
        "At least one source must survive screening before eligibility.",
      );
    }
  }

  if (phase === "SYNTHESIS") {
    const [counts] = await sql<{
      total: number;
      incomplete: number;
    }[]>`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE first_pass_status = 'UNASSESSED'
             OR first_pass_confidence IS NULL
        )::int AS incomplete
      FROM claims
      WHERE investigation_id = ${investigationId}
    `;

    if (counts.total < 1 || counts.incomplete > 0) {
      throw new Error(
        "Every material claim needs a first-pass status and confidence before synthesis can be completed.",
      );
    }
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

  const [
    claims,
    sources,
    state,
    claimSourceEdges,
    evidenceChains,
    searchLogs,
    retrievalLogs,
  ] = await Promise.all([
    getClaims(investigationId),
    getSources(investigationId),
    buildInvestigationState(investigationId),
    sql`SELECT * FROM claim_source_edges WHERE investigation_id = ${investigationId} ORDER BY created_at ASC`,
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
    claimSourceEdges,
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
