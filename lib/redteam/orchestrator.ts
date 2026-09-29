import type { AiJobRecord } from "@/lib/db/ai-jobs";
import {
  createAiJob,
  listAiJobs,
} from "@/lib/db/ai-jobs";
import {
  appendAuditEvent,
  buildInvestigationState,
  getClaims,
  getInvestigation,
} from "@/lib/db/repository";
import { createSearchLog } from "@/lib/db/evidence";
import {
  upsertCredibilityAssessment,
  type DimensionScores,
} from "@/lib/db/credibility";
import {
  applyFinalClaimAssessment,
  createChallenge,
  createReconciliation,
  createRedTeamReview,
  failOrphanedRedTeamReviews,
  listChallenges,
  listRedTeamReviews,
  setRedTeamReviewStatus,
} from "@/lib/db/redteam";
import {
  cancelBackgroundResponse,
  createBackgroundResponse,
  extractCodeInterpreterUsage,
  extractOutputText,
  extractWebQueries,
  extractWebSources,
  hasWebSearchCall,
  researchModel,
  type OpenAIResponse,
} from "@/lib/ai/openai";
import {
  reconciliationPrompt,
  reconciliationSystem,
  redTeamPrompt,
  redTeamSystem,
} from "./prompts";
import {
  RECONCILIATION_SCHEMA,
  REDTEAM_REVIEW_SCHEMA,
} from "./schemas";
import { REDTEAM_ROLES } from "./roles";
import { listArtifacts } from "@/lib/db/artifacts";
import { loadVerifiedArtifactInputPart } from "@/lib/artifacts/verified";
import { artifactNeedsQuantitativeForensics } from "@/lib/artifacts/content";
import { persistBackgroundJobOrCancel } from "@/lib/ai/job-launch";
import {
  loadCanonicalReconciliationProtocol,
  loadCanonicalRedTeamProtocol,
} from "@/lib/protocol/canonical";

type RedTeamOutput = {
  summary: string;
  claim_reviews: Array<{
    claim_id: string;
    outcome:
      | "SURVIVED_SCRUTINY"
      | "CHALLENGED"
      | "UNRESOLVED"
      | "NOT_APPLICABLE_TO_ROLE";
    attack_summary: string;
    strongest_counterevidence_sought: string;
    evidence_gap: string;
    self_falsification_condition: string;
  }>;
  challenges: Array<{
    claim_id: string;
    attack_method: string;
    finding: string;
    evidence_urls: string[];
    proposed_classification:
      | "VALIDATED_ERROR"
      | "VALIDATED_OMISSION"
      | "CONFIDENCE_OVERSTATEMENT"
      | "METHODOLOGICAL_WEAKNESS"
      | "SOURCE_INDEPENDENCE_FAILURE"
      | "UNRESOLVED_CONFLICT";
    proposed_claim_status: "UPHELD" | "MODIFIED" | "DISPROVEN" | "UNCERTAIN";
    proposed_confidence: number;
    rationale: string;
    evidence_strength:
      | "DIRECT_PRIMARY"
      | "INDEPENDENT_CORROBORATED"
      | "SECONDARY"
      | "METHODOLOGICAL_LOGICAL"
      | "TENTATIVE";
    materiality: "CRITICAL" | "MATERIAL";
    self_falsification_condition: string;
    unresolved_questions: string[];
  }>;
  global_findings: string[];
};

type ReconciliationOutput = {
  summary: string;
  investigation_dimension_scores: DimensionScores;
  investigation_critical_failures: string[];
  investigation_rationale: string;
  adjudications: Array<{
    challenge_id: string;
    classification:
      | "VALIDATED_ERROR"
      | "VALIDATED_OMISSION"
      | "CONFIDENCE_OVERSTATEMENT"
      | "METHODOLOGICAL_WEAKNESS"
      | "SOURCE_INDEPENDENCE_FAILURE"
      | "UNRESOLVED_CONFLICT"
      | "CHALLENGE_REJECTED";
    independently_reproduced: boolean;
    adjudication: string;
    evidence_for_refs: string[];
    evidence_against_refs: string[];
    revised_wording: string;
    revised_confidence: number;
    unresolved_issue: string;
    rationale: string;
  }>;
  final_claims: Array<{
    claim_id: string;
    status: "UPHELD" | "MODIFIED" | "DISPROVEN" | "UNCERTAIN";
    confidence: number;
    wording: string;
    rationale: string;
    driving_challenge_ids: string[];
    surviving_evidence_refs: string[];
    unresolved_challenge_ids: string[];
    change_summary: string;
  }>;
};

function parseJson<T>(text: string): T {
  if (!text) throw new Error("AI response contained no structured output.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("AI response could not be parsed as structured JSON.");
  }
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch {
    return value.trim();
  }
}

function frozenSourceRefs(snapshot: unknown): Set<string> {
  const refs = new Set<string>();
  if (!snapshot || typeof snapshot !== "object") return refs;

  const sources = Array.isArray((snapshot as { sources?: unknown[] }).sources)
    ? (snapshot as { sources: unknown[] }).sources
    : [];

  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const id = (source as { id?: unknown }).id;
    const url = (source as { url_or_identifier?: unknown }).url_or_identifier;

    if (typeof id === "string") refs.add(id);
    if (typeof url === "string" && /^https?:\/\//i.test(url)) {
      refs.add(normalizeUrl(url));
    }
  }

  return refs;
}

function challengeAcceptedUrls(evidence: unknown): string[] {
  if (!evidence || typeof evidence !== "object") return [];
  const urls = (evidence as { acceptedEvidenceUrls?: unknown })
    .acceptedEvidenceUrls;
  return Array.isArray(urls)
    ? urls.filter((value): value is string => typeof value === "string")
    : [];
}

function frozenSourceUrls(snapshot: unknown): Set<string> {
  const urls = new Set<string>();
  if (!snapshot || typeof snapshot !== "object") return urls;

  const sources = Array.isArray((snapshot as { sources?: unknown[] }).sources)
    ? (snapshot as { sources: unknown[] }).sources
    : [];

  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const value = (source as { url_or_identifier?: unknown }).url_or_identifier;
    if (typeof value === "string" && /^https?:\/\//i.test(value)) {
      urls.add(normalizeUrl(value));
    }
  }

  return urls;
}

function frozenArtifactManifest(snapshot: unknown) {
  const manifest = new Map<string, string>();
  if (!snapshot || typeof snapshot !== "object") return manifest;

  const values = Array.isArray(
    (snapshot as { artifacts?: unknown[] }).artifacts,
  )
    ? (snapshot as { artifacts: unknown[] }).artifacts
    : [];

  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const id = (value as { id?: unknown }).id;
    const sha256 = (value as { sha256?: unknown }).sha256;
    if (typeof id === "string" && typeof sha256 === "string") {
      manifest.set(id, sha256);
    }
  }

  return manifest;
}

async function loadFrozenArtifactContext(
  investigationId: string,
  snapshot: unknown,
) {
  const artifacts = await listArtifacts(investigationId);
  const frozenManifest = frozenArtifactManifest(snapshot);

  if (artifacts.length !== frozenManifest.size) {
    throw new Error(
      "Current artifact ledger does not match the frozen dossier artifact count.",
    );
  }

  const contentParts: unknown[] = [];
  for (const artifact of artifacts) {
    const frozenHash = frozenManifest.get(artifact.id);
    if (!frozenHash || frozenHash !== artifact.sha256) {
      throw new Error(
        "Artifact " +
          artifact.id +
          " does not match the SHA-256 recorded in the frozen dossier.",
      );
    }

    contentParts.push({
      type: "input_text",
      text:
        "FROZEN ARTIFACT MAPPING: " +
        artifact.id +
        " -> source " +
        (artifact.source_id ?? "unlinked") +
        " | filename=" +
        artifact.original_filename +
        " | mime=" +
        artifact.mime_type +
        " | sha256=" +
        artifact.sha256,
    });
    contentParts.push(await loadVerifiedArtifactInputPart(artifact));
  }

  return {
    artifacts,
    contentParts,
    hasTabularArtifacts: artifacts.some((artifact) =>
      artifactNeedsQuantitativeForensics(artifact.mime_type),
    ),
    hashes: artifacts.map((artifact) => ({
      id: artifact.id,
      sha256: artifact.sha256,
      sourceId: artifact.source_id,
      mimeType: artifact.mime_type,
    })),
  };
}

function mapExternalStatus(status: string) {
  if (status === "queued") return "QUEUED" as const;
  if (status === "in_progress") return "IN_PROGRESS" as const;
  if (status === "completed") return "IN_PROGRESS" as const;
  return "FAILED" as const;
}

function assertExactCoverage(
  expectedIds: string[],
  receivedIds: string[],
  label: string,
) {
  const expected = new Set(expectedIds);
  const seen = new Set<string>();
  const unknown: string[] = [];
  const duplicates: string[] = [];

  for (const id of receivedIds) {
    if (!expected.has(id)) unknown.push(id);
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
  }

  const missing = expectedIds.filter((id) => !seen.has(id));

  if (unknown.length || duplicates.length || missing.length) {
    throw new Error(
      label +
        " coverage failed. Missing: " +
        (missing.join(", ") || "none") +
        "; unknown: " +
        (unknown.join(", ") || "none") +
        "; duplicates: " +
        (duplicates.join(", ") || "none") +
        ".",
    );
  }
}

export async function startRedTeam(investigationId: string) {
  const investigation = await getInvestigation(investigationId);
  if (!investigation) throw new Error("Investigation not found.");

  if (investigation.current_phase !== "REDTEAM") {
    throw new Error("The rival swarm can only run during the REDTEAM phase.");
  }
  if (!investigation.pre_redteam_frozen_at || !investigation.pre_redteam_snapshot) {
    throw new Error("Freeze the pre-RedTeam dossier before starting rival review.");
  }

  const orphanedReviewIds =
    await failOrphanedRedTeamReviews(investigationId);
  if (orphanedReviewIds.length > 0) {
    await appendAuditEvent(investigationId, "REDTEAM_ORPHANED_STARTS_FAILED", {
      reviewIds: orphanedReviewIds,
      reason:
        "No active AI job was linked within the reviewer-start lease window.",
    });
  }

  const model = researchModel();
  const canonicalProtocol = await loadCanonicalRedTeamProtocol();
  const artifactContext = await loadFrozenArtifactContext(
    investigationId,
    investigation.pre_redteam_snapshot,
  );
  const started: Array<{ role: string; reviewId: string; jobId: string }> = [];
  const skipped: Array<{ role: string; reason: string }> = [];
  const errors: Array<{ role: string; error: string }> = [];

  for (const role of REDTEAM_ROLES) {
    const review = await createRedTeamReview({
      investigationId,
      reviewerRole: role.key,
      modelProvider: "OpenAI",
      modelVersion: model,
    });

    if (!review) {
      skipped.push({
        role: role.key,
        reason: "role already active or completed",
      });
      continue;
    }

    try {
      const requestPayload = {
        model,
        reasoning: { effort: "high" },
        tools: [
          {
            type: "web_search",
            search_context_size: "high",
          },
          ...(role.key === "DATA_FIGURE_FORENSICS" &&
          artifactContext.hasTabularArtifacts
            ? [
                {
                  type: "code_interpreter",
                  container: { type: "auto" },
                },
              ]
            : []),
        ],
        tool_choice: "required",
        include: ["web_search_call.action.sources"],
        input: [
          {
            role: "system",
            content: redTeamSystem(role.name, role.mission, canonicalProtocol),
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: redTeamPrompt(
                  investigation,
                  role.name,
                  investigation.pre_redteam_snapshot,
                ),
              },
              ...artifactContext.contentParts,
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "credify_redteam_review",
            strict: true,
            schema: REDTEAM_REVIEW_SCHEMA,
          },
        },
      };

      const response = await createBackgroundResponse(requestPayload);
      await setRedTeamReviewStatus(review.id, "IN_PROGRESS");

      const job = await persistBackgroundJobOrCancel({
        investigationId,
        jobType: "REDTEAM_REVIEW",
        response,
        fallbackModel: model,
        status: mapExternalStatus(response.status),
        requestPayload: {
          purpose: "redteam_review",
          protocolCommit: investigation.protocol_commit,
          dossierSha256: investigation.pre_redteam_snapshot_hash,
          role: role.key,
          frozenArtifactHashes: artifactContext.hashes,
          quantitativeForensicsRequired:
            role.key === "DATA_FIGURE_FORENSICS" &&
            artifactContext.hasTabularArtifacts,
        },
        redteamReviewId: review.id,
      });

      started.push({
        role: role.key,
        reviewId: review.id,
        jobId: job.id,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to start reviewer.";
      await setRedTeamReviewStatus(review.id, "FAILED", { error: message });
      errors.push({ role: role.key, error: message });
    }
  }

  await appendAuditEvent(investigationId, "REDTEAM_SWARM_START_ATTEMPT", {
    started,
    skipped,
    errors,
    orphanedReviewIds,
    dossierSha256: investigation.pre_redteam_snapshot_hash,
    frozenArtifactCount: artifactContext.artifacts.length,
    tabularArtifactsPresent: artifactContext.hasTabularArtifacts,
  });

  return { started, skipped, errors, orphanedReviewIds };
}

export async function processRedTeamReviewResponse(
  job: AiJobRecord,
  response: OpenAIResponse,
) {
  if (!job.redteam_review_id) {
    throw new Error("RedTeam AI job is missing its reviewer record link.");
  }

  const investigation = await getInvestigation(job.investigation_id);
  if (!investigation) throw new Error("Investigation not found.");
  if (!investigation.pre_redteam_snapshot) {
    throw new Error("Frozen dossier is unavailable.");
  }

  const [claims, reviews, artifactContext] = await Promise.all([
    getClaims(job.investigation_id),
    listRedTeamReviews(job.investigation_id),
    loadFrozenArtifactContext(
      job.investigation_id,
      investigation.pre_redteam_snapshot,
    ),
  ]);
  const reviewer = reviews.find(
    (review) => review.id === job.redteam_review_id,
  );
  if (!reviewer) {
    throw new Error("RedTeam reviewer record is unavailable.");
  }

  if (!hasWebSearchCall(response)) {
    throw new Error(
      "Rival reviewer did not execute the required independent web-search step.",
    );
  }

  const codeInterpreterUsage = extractCodeInterpreterUsage(response);
  const quantitativeForensicsRequired =
    reviewer.reviewer_role === "DATA_FIGURE_FORENSICS" &&
    artifactContext.hasTabularArtifacts;

  if (
    quantitativeForensicsRequired &&
    (
      codeInterpreterUsage.completedCallCount < 1 ||
      codeInterpreterUsage.codePresentCallCount < 1
    )
  ) {
    throw new Error(
      "Data/Stat/Figure rival did not complete verifiable Python recomputation against the frozen tabular artifact set.",
    );
  }

  const claimIds = new Set(claims.map((claim) => claim.id));
  const output = parseJson<RedTeamOutput>(extractOutputText(response));
  const claimReviewIds = output.claim_reviews.map((item) => item.claim_id);
  const seenClaimReviewIds = new Set<string>();
  const duplicateClaimReviewIds: string[] = [];
  const unknownClaimReviewIds: string[] = [];

  for (const claimId of claimReviewIds) {
    if (!claimIds.has(claimId)) unknownClaimReviewIds.push(claimId);
    if (seenClaimReviewIds.has(claimId)) duplicateClaimReviewIds.push(claimId);
    seenClaimReviewIds.add(claimId);
  }

  const missingClaimReviewIds = [...claimIds].filter(
    (claimId) => !seenClaimReviewIds.has(claimId),
  );

  if (
    unknownClaimReviewIds.length ||
    duplicateClaimReviewIds.length ||
    missingClaimReviewIds.length
  ) {
    throw new Error(
      "Rival reviewer claim-coverage ledger failed. Missing: " +
        (missingClaimReviewIds.join(", ") || "none") +
        "; unknown: " +
        ([...new Set(unknownClaimReviewIds)].join(", ") || "none") +
        "; duplicates: " +
        ([...new Set(duplicateClaimReviewIds)].join(", ") || "none") +
        ".",
    );
  }

  const challengedClaimIds = new Set(
    output.challenges.map((challenge) => challenge.claim_id),
  );

  for (const review of output.claim_reviews) {
    const hasChallenge = challengedClaimIds.has(review.claim_id);
    if (
      ["CHALLENGED", "UNRESOLVED"].includes(review.outcome) &&
      !hasChallenge
    ) {
      throw new Error(
        "Rival reviewer marked " +
          review.claim_id +
          " as " +
          review.outcome +
          " without a structured challenge.",
      );
    }

    if (
      ["SURVIVED_SCRUTINY", "NOT_APPLICABLE_TO_ROLE"].includes(
        review.outcome,
      ) &&
      hasChallenge
    ) {
      throw new Error(
        "Rival reviewer challenge ledger contradicts the claim-review outcome for " +
          review.claim_id +
          ".",
      );
    }
  }

  const toolSources = extractWebSources(response);
  const trustedUrls = frozenSourceUrls(investigation.pre_redteam_snapshot);

  for (const source of toolSources) {
    trustedUrls.add(normalizeUrl(source.url));
  }

  const queries = extractWebQueries(response);
  for (const query of queries) {
    await createSearchLog({
      investigationId: job.investigation_id,
      claimIds: claims.map((claim) => claim.id),
      databaseOrPlatform: "OpenAI Responses web_search / RedTeam",
      queryExact: query,
      resultCount: toolSources.length,
      notes:
        "Unique source count exposed by the full rival-review response; not asserted as a per-query search-engine count.",
    });
  }

  const unknownClaimIds = [
    ...new Set(
      output.challenges
        .map((challenge) => challenge.claim_id)
        .filter((claimId) => !claimIds.has(claimId)),
    ),
  ];

  if (unknownClaimIds.length > 0) {
    throw new Error(
      "Rival reviewer returned challenges for unknown claim IDs: " +
        unknownClaimIds.join(", ") +
        ".",
    );
  }

  const createdChallengeIds: string[] = [];
  const rejectedEvidenceUrls: string[] = [];

  for (const challenge of output.challenges) {

    const acceptedUrls: string[] = [];
    const rejectedUrls: string[] = [];

    for (const url of challenge.evidence_urls) {
      if (trustedUrls.has(normalizeUrl(url))) {
        acceptedUrls.push(url);
      } else {
        rejectedUrls.push(url);
        rejectedEvidenceUrls.push(url);
      }
    }

    const record = await createChallenge({
      reviewId: job.redteam_review_id,
      investigationId: job.investigation_id,
      claimId: challenge.claim_id,
      attackMethod: challenge.attack_method,
      evidence: {
        finding: challenge.finding,
        acceptedEvidenceUrls: acceptedUrls,
        rejectedEvidenceUrls: rejectedUrls,
        proposedClaimStatus: challenge.proposed_claim_status,
        rationale: challenge.rationale,
        evidenceStrength: challenge.evidence_strength,
        materiality: challenge.materiality,
        selfFalsificationCondition: challenge.self_falsification_condition,
        unresolvedQuestions: challenge.unresolved_questions,
      },
      proposedClassification: challenge.proposed_classification,
      proposedConfidence: challenge.proposed_confidence,
    });

    createdChallengeIds.push(record.id);
  }

  const reviewOutput = {
    summary: output.summary,
    claimReviews: output.claim_reviews,
    globalFindings: output.global_findings,
    createdChallengeIds,
    rejectedEvidenceUrls,
    webQueries: queries,
    toolSources,
    frozenArtifactHashes: artifactContext.hashes,
    toolVerification: {
      webSearchUsed: true,
      quantitativeForensicsRequired,
      codeInterpreter: codeInterpreterUsage,
    },
  };

  await setRedTeamReviewStatus(
    job.redteam_review_id,
    "COMPLETED",
    reviewOutput,
  );

  await appendAuditEvent(job.investigation_id, "REDTEAM_REVIEW_COMPLETED", {
    reviewId: job.redteam_review_id,
    jobId: job.id,
    challengeCount: createdChallengeIds.length,
    claimReviewCount: output.claim_reviews.length,
    survivedScrutinyCount: output.claim_reviews.filter(
      (item) => item.outcome === "SURVIVED_SCRUTINY",
    ).length,
    rejectedEvidenceUrls,
    toolSourceCount: toolSources.length,
    frozenArtifactCount: artifactContext.artifacts.length,
    quantitativeForensicsRequired,
    pythonCompletedCallCount: codeInterpreterUsage.completedCallCount,
  });

  return reviewOutput;
}

export async function markLinkedRedTeamJobFailed(
  job: AiJobRecord,
  message: string,
) {
  if (!job.redteam_review_id) return;
  await setRedTeamReviewStatus(job.redteam_review_id, "FAILED", {
    error: message,
    jobId: job.id,
  });
}

export async function startReconciliation(investigationId: string) {
  const investigation = await getInvestigation(investigationId);
  if (!investigation) throw new Error("Investigation not found.");
  if (investigation.current_phase !== "RECONCILIATION") {
    throw new Error(
      "Blind reconciliation can only run during the RECONCILIATION phase.",
    );
  }

  const state = await buildInvestigationState(investigationId);
  if (!state.redTeamCompleted) {
    throw new Error(
      "All eight distinct rival reviewer roles must complete before reconciliation.",
    );
  }

  const active = (await listAiJobs(investigationId)).filter(
    (job) =>
      job.job_type === "RECONCILIATION" &&
      ["QUEUED", "IN_PROGRESS", "PROCESSING"].includes(job.status),
  );
  if (active.length > 0) {
    throw new Error("A reconciliation job is already active.");
  }

  const claims = await getClaims(investigationId);
  const challenges = await listChallenges(investigationId);
  const model = researchModel();
  const canonicalProtocol = await loadCanonicalReconciliationProtocol();

  const requestPayload = {
    model,
    reasoning: { effort: "high" },
    tools: [
      {
        type: "web_search",
        search_context_size: "high",
},
    ],
    tool_choice: "auto",
    include: ["web_search_call.action.sources"],
    input: [
      { role: "system", content: reconciliationSystem(canonicalProtocol) },
      {
        role: "user",
        content: reconciliationPrompt(investigation, claims, challenges),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "credify_blind_reconciliation",
        strict: true,
        schema: RECONCILIATION_SCHEMA,
      },
    },
  };

  const response = await createBackgroundResponse(requestPayload);

  let job: AiJobRecord;
  try {
    job = await createAiJob({
      investigationId,
      jobType: "RECONCILIATION",
      externalResponseId: response.id,
      model: response.model || model,
      status: mapExternalStatus(response.status),
      requestPayload: {
        purpose: "blind_reconciliation",
        protocolCommit: investigation.protocol_commit,
        dossierSha256: investigation.pre_redteam_snapshot_hash,
        challengeIds: challenges.map((challenge) => challenge.id),
        claimIds: claims.map((claim) => claim.id),
      },
    });
  } catch (error) {
    let cancellationError: string | null = null;
    try {
      await cancelBackgroundResponse(response.id);
    } catch (cancelError) {
      cancellationError =
        cancelError instanceof Error
          ? cancelError.message
          : "Unable to cancel orphaned background response.";
    }

    await appendAuditEvent(
      investigationId,
      "RECONCILIATION_JOB_PERSISTENCE_REJECTED",
      {
        responseId: response.id,
        cancellationError,
        error:
          error instanceof Error
            ? error.message
            : "Unable to persist reconciliation job.",
      },
    );

    throw new Error(
      "A reconciliation run could not be registered, usually because another nonfailed reconciliation already exists. The unowned background response was cancelled when possible.",
    );
  }

  await appendAuditEvent(investigationId, "RECONCILIATION_JOB_STARTED", {
    jobId: job.id,
    responseId: response.id,
    challengeCount: challenges.length,
    claimCount: claims.length,
  });

  return job;
}

export async function processReconciliationResponse(
  job: AiJobRecord,
  response: OpenAIResponse,
) {
  const investigation = await getInvestigation(job.investigation_id);
  if (!investigation) throw new Error("Investigation not found.");

  const claims = await getClaims(job.investigation_id);
  const challenges = await listChallenges(job.investigation_id);
  const output = parseJson<ReconciliationOutput>(extractOutputText(response));

  assertExactCoverage(
    challenges.map((challenge) => challenge.id),
    output.adjudications.map((item) => item.challenge_id),
    "Challenge adjudication",
  );
  assertExactCoverage(
    claims.map((claim) => claim.id),
    output.final_claims.map((item) => item.claim_id),
    "Final claim assessment",
  );

  const claimById = new Map(claims.map((claim) => [claim.id, claim]));
  const challengeById = new Map(
    challenges.map((challenge) => [challenge.id, challenge]),
  );

  const toolSources = extractWebSources(response);
  const queries = extractWebQueries(response);

  const trustedEvidenceRefs = frozenSourceRefs(
    investigation.pre_redteam_snapshot,
  );
  for (const challenge of challenges) {
    trustedEvidenceRefs.add(challenge.id);
    for (const url of challengeAcceptedUrls(challenge.evidence)) {
      trustedEvidenceRefs.add(normalizeUrl(url));
    }
  }
  for (const source of toolSources) {
    trustedEvidenceRefs.add(normalizeUrl(source.url));
  }

  const invalidEvidenceRefs: string[] = [];
  for (const adjudication of output.adjudications) {
    for (const ref of [
      ...adjudication.evidence_for_refs,
      ...adjudication.evidence_against_refs,
    ]) {
      const normalized = /^https?:\/\//i.test(ref) ? normalizeUrl(ref) : ref;
      if (!trustedEvidenceRefs.has(normalized)) {
        invalidEvidenceRefs.push(ref);
      }
    }
  }

  const adjudicationByChallengeId = new Map(
    output.adjudications.map((item) => [item.challenge_id, item]),
  );

  for (const finalClaim of output.final_claims) {
    const driving = [...new Set(finalClaim.driving_challenge_ids)];
    const unresolved = [...new Set(finalClaim.unresolved_challenge_ids)];

    for (const challengeId of [...driving, ...unresolved]) {
      const challenge = challengeById.get(challengeId);
      if (!challenge) {
        throw new Error(
          "Final claim trace referenced unknown challenge ID: " + challengeId + ".",
        );
      }
      if (challenge.claim_id !== finalClaim.claim_id) {
        throw new Error(
          "Final claim trace referenced a challenge belonging to a different claim: " +
            challengeId +
            ".",
        );
      }
    }

    for (const challengeId of unresolved) {
      const adjudication = adjudicationByChallengeId.get(challengeId);
      if (!adjudication || adjudication.classification !== "UNRESOLVED_CONFLICT") {
        throw new Error(
          "Final claim trace marked a challenge unresolved without an UNRESOLVED_CONFLICT adjudication: " +
            challengeId +
            ".",
        );
      }
    }

    for (const ref of finalClaim.surviving_evidence_refs) {
      const normalized = /^https?:\/\//i.test(ref) ? normalizeUrl(ref) : ref;
      if (!trustedEvidenceRefs.has(normalized)) {
        invalidEvidenceRefs.push(ref);
      }
    }

    const firstPass = claimById.get(finalClaim.claim_id);
    if (!firstPass) {
      throw new Error("Final claim trace refers to an unknown claim.");
    }

    const wordingChanged = finalClaim.wording.trim() !== firstPass.text.trim();
    const confidenceChanged =
      firstPass.first_pass_confidence !== null &&
      Math.abs(
        finalClaim.confidence - Number(firstPass.first_pass_confidence),
      ) > 0.001;

    if (
      (finalClaim.status !== "UPHELD" || wordingChanged || confidenceChanged) &&
      driving.length === 0 &&
      finalClaim.surviving_evidence_refs.length === 0
    ) {
      throw new Error(
        "A modified final claim must identify a driving challenge or surviving evidence reference.",
      );
    }
  }

  if (invalidEvidenceRefs.length > 0) {
    throw new Error(
      "Reconciliation referenced evidence that is not in the frozen dossier, " +
        "validated challenge evidence, or its own web-search results: " +
        [...new Set(invalidEvidenceRefs)].join(", "),
    );
  }

  for (const query of queries) {
    await createSearchLog({
      investigationId: job.investigation_id,
      claimIds: claims.map((claim) => claim.id),
      databaseOrPlatform: "OpenAI Responses web_search / Reconciliation",
      queryExact: query,
      resultCount: toolSources.length,
      notes:
        "Unique source count exposed by the full reconciliation response; not asserted as a per-query search-engine count.",
    });
  }

  const reconciliationIds: string[] = [];

  for (const adjudication of output.adjudications) {
    const challenge = challengeById.get(adjudication.challenge_id);
    if (!challenge) {
      throw new Error("Unknown challenge during reconciliation.");
    }
    const claim = claimById.get(challenge.claim_id);
    if (!claim) {
      throw new Error("Challenge refers to an unknown claim.");
    }

    const record = await createReconciliation({
      challengeId: challenge.id,
      investigationId: job.investigation_id,
      classification: adjudication.classification,
      evidenceFor: adjudication.evidence_for_refs,
      evidenceAgainst: adjudication.evidence_against_refs,
      independentlyReproduced: adjudication.independently_reproduced,
      adjudication: adjudication.adjudication,
      originalWording: claim.text,
      revisedWording: adjudication.revised_wording,
      originalConfidence:
        claim.first_pass_confidence === null
          ? null
          : Number(claim.first_pass_confidence),
      revisedConfidence: adjudication.revised_confidence,
      unresolvedIssue: adjudication.unresolved_issue || null,
      rationale: adjudication.rationale,
    });

    reconciliationIds.push(record.id);
  }

  for (const finalClaim of output.final_claims) {
    await applyFinalClaimAssessment({
      investigationId: job.investigation_id,
      claimId: finalClaim.claim_id,
      status: finalClaim.status,
      confidence: finalClaim.confidence,
      wording: finalClaim.wording,
      rationale: finalClaim.rationale,
      evidenceTrace: {
        drivingChallengeIds: [...new Set(finalClaim.driving_challenge_ids)],
        survivingEvidenceRefs: [
          ...new Set(finalClaim.surviving_evidence_refs),
        ],
        unresolvedChallengeIds: [
          ...new Set(finalClaim.unresolved_challenge_ids),
        ],
        changeSummary: finalClaim.change_summary,
      },
    });
  }

  const investigationAssessment = await upsertCredibilityAssessment({
    investigationId: job.investigation_id,
    subjectType: "INVESTIGATION",
    subjectId: job.investigation_id,
    stage: "FINAL",
    dimensionScores: output.investigation_dimension_scores,
    criticalFailures: output.investigation_critical_failures,
    rationale: {
      overall: output.investigation_rationale,
      basis:
        "Final investigation-level matrix reflects evidence surviving independent rival review and blind reconciliation; it is not a vote count or arithmetic average.",
    },
    evidenceRefs: [
      ...claims.map((claim) => claim.id),
      ...challenges.map((challenge) => challenge.id),
    ],
  });

  const result = {
    summary: output.summary,
    reconciliationIds,
    finalClaims: output.final_claims,
    investigationMatrix: {
      totalScore: Number(investigationAssessment.total_score),
      dimensionScores: output.investigation_dimension_scores,
      criticalFailures: output.investigation_critical_failures,
      rationale: output.investigation_rationale,
    },
    webQueries: queries,
    toolSources,
  };

  await appendAuditEvent(job.investigation_id, "BLIND_RECONCILIATION_COMPLETED", {
    jobId: job.id,
    challengeCount: challenges.length,
    claimCount: claims.length,
    reconciliationCount: reconciliationIds.length,
    finalInvestigationScore: Number(investigationAssessment.total_score),
    finalInvestigationCriticalFailureCount:
      output.investigation_critical_failures.length,
    toolSourceCount: toolSources.length,
  });

  return result;
}
