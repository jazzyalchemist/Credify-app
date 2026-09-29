import type { ClaimRecord } from "@/lib/db/types";
import {
  appendAuditEvent,
  createClaim,
  createSource,
  getClaims,
  getInvestigation,
} from "@/lib/db/repository";
import {
  claimAiJobForProcessing,
  completeAiJob,
  failAiJob,
  getAiJob,
  listAiJobs,
  updateAiJobStatus,
  aiProcessingLeaseExpired,
  type AiJobRecord,
} from "@/lib/db/ai-jobs";
import {
  createSearchLog,
  findSourceByUrl,
  linkClaimSource,
} from "@/lib/db/evidence";
import {
  createBackgroundResponse,
  extractOutputText,
  extractWebQueries,
  extractWebSources,
  researchModel,
  retrieveResponse,
  type OpenAIResponse,
} from "./openai";
import { CREDIFY_RESEARCH_SYSTEM, decompositionPrompt, discoveryPrompt } from "./prompts";
import { DECOMPOSITION_SCHEMA, DISCOVERY_SCHEMA } from "./schemas";
import { loadCanonicalInitialProtocol } from "@/lib/protocol/canonical";
import {
  markLinkedRedTeamJobFailed,
  processReconciliationResponse,
  processRedTeamReviewResponse,
} from "@/lib/redteam/orchestrator";
import {
  processScreeningResponse,
  processSourceAuditResponse,
  processSynthesisResponse,
} from "@/lib/ai/page1-orchestrator";
import { processReportResponse } from "@/lib/ai/reports";
import { persistBackgroundJobOrCancel } from "@/lib/ai/job-launch";
import {
  ensureArtifactSources,
  listArtifacts,
} from "@/lib/db/artifacts";
import { loadVerifiedArtifactInputPart } from "@/lib/artifacts/verified";

type DecompositionOutput = {
  domain: string;
  research_questions: string[];
  claims: Array<{
    text: string;
    claim_type: string;
    requires_primary_evidence: boolean;
    why_material: string;
  }>;
  search_strategy: {
    languages: string[];
    jurisdictions: string[];
    evidence_streams: string[];
    opposing_queries: string[];
  };
  known_ambiguities: string[];
};

type SearchStrategy = DecompositionOutput["search_strategy"];

type DiscoveryOutput = {
  research_summary: string;
  selected_sources: Array<{
    url: string;
    title: string;
    source_type: string;
    primary_or_secondary: "PRIMARY" | "SECONDARY" | "UNKNOWN";
    claim_ids: string[];
    evidence_role: "SUPPORTS" | "CONTRADICTS" | "CONTEXT" | "PROVENANCE";
    selection_rationale: string;
  }>;
  contrary_evidence_sought: string[];
  coverage_gaps: string[];
};

function mapExternalStatus(status: string) {
  if (status === "queued") return "QUEUED" as const;
  if (status === "in_progress") return "IN_PROGRESS" as const;
  if (status === "completed") return "IN_PROGRESS" as const;
  return "FAILED" as const;
}


function validStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string")
  );
}

function searchStrategyFromDecompositionJobs(
  jobs: AiJobRecord[],
): SearchStrategy | null {
  const job = jobs.find(
    (candidate) =>
      candidate.job_type === "DECOMPOSE" &&
      candidate.status === "COMPLETED" &&
      candidate.result_payload,
  );
  if (!job?.result_payload || typeof job.result_payload !== "object") {
    return null;
  }

  const payload = job.result_payload as Record<string, unknown>;
  const output =
    payload.output && typeof payload.output === "object"
      ? (payload.output as Record<string, unknown>)
      : null;
  const decomposition =
    output?.decomposition && typeof output.decomposition === "object"
      ? (output.decomposition as Record<string, unknown>)
      : null;
  const strategy =
    decomposition?.search_strategy &&
    typeof decomposition.search_strategy === "object"
      ? (decomposition.search_strategy as Record<string, unknown>)
      : null;

  if (
    !strategy ||
    !validStringArray(strategy.languages) ||
    !validStringArray(strategy.jurisdictions) ||
    !validStringArray(strategy.evidence_streams) ||
    !validStringArray(strategy.opposing_queries)
  ) {
    return null;
  }

  return {
    languages: strategy.languages,
    jurisdictions: strategy.jurisdictions,
    evidence_streams: strategy.evidence_streams,
    opposing_queries: strategy.opposing_queries,
  };
}

function searchStrategyFromJobPayload(payload: unknown): SearchStrategy | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const strategy =
    record.plannedSearchStrategy &&
    typeof record.plannedSearchStrategy === "object"
      ? (record.plannedSearchStrategy as Record<string, unknown>)
      : null;

  if (
    !strategy ||
    !validStringArray(strategy.languages) ||
    !validStringArray(strategy.jurisdictions) ||
    !validStringArray(strategy.evidence_streams) ||
    !validStringArray(strategy.opposing_queries)
  ) {
    return null;
  }

  return {
    languages: strategy.languages,
    jurisdictions: strategy.jurisdictions,
    evidence_streams: strategy.evidence_streams,
    opposing_queries: strategy.opposing_queries,
  };
}

function inputContainsUrl(value: string) {
  return /https?:\/\/[^\s<>"')\]]+/i.test(value);
}

function normalizedUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch {
    return value.trim();
  }
}

function parseJson<T>(text: string): T {
  if (!text) throw new Error("AI response contained no structured output.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("AI response could not be parsed as structured JSON.");
  }
}

export async function startDecomposition(investigationId: string) {
  const investigation = await getInvestigation(investigationId);
  if (!investigation) throw new Error("Investigation not found.");
  if (investigation.pre_redteam_frozen_at) {
    throw new Error("The Page-1 dossier is frozen.");
  }
  if (investigation.current_phase !== "INTAKE") {
    throw new Error("Claim decomposition is only available during INTAKE.");
  }

  const priorJobs = await listAiJobs(investigationId, 100);
  const activeJobs = priorJobs.filter((job) =>
    ["QUEUED", "IN_PROGRESS", "PROCESSING"].includes(job.status),
  );
  if (activeJobs.length > 0) {
    throw new Error("Another AI research job is already active for this investigation.");
  }

  const claims = await getClaims(investigationId);
  if (claims.length > 0) {
    throw new Error(
      "Claims already exist. Remove or review them rather than silently replacing the claim ledger.",
    );
  }

  const model = researchModel();
  const [canonicalProtocol, artifacts] = await Promise.all([
    loadCanonicalInitialProtocol(),
    listArtifacts(investigationId),
  ]);
  const artifactParts = await Promise.all(
    artifacts.map((artifact) => loadVerifiedArtifactInputPart(artifact)),
  );
  const requestPayload = {
    model,
    reasoning: { effort: "medium" },
    tools: [
      {
        type: "web_search",
        search_context_size: "high",
      },
    ],
    tool_choice: inputContainsUrl(investigation.input_material)
      ? "required"
      : "auto",
    include: ["web_search_call.action.sources"],
    input: [
      {
        role: "system",
        content: CREDIFY_RESEARCH_SYSTEM + "\n\n" + canonicalProtocol,
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: decompositionPrompt(investigation),
          },
          ...artifactParts,
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "credify_claim_decomposition",
        strict: true,
        schema: DECOMPOSITION_SCHEMA,
      },
    },
  };

  const response = await createBackgroundResponse(requestPayload);
  const job = await persistBackgroundJobOrCancel({
    investigationId,
    jobType: "DECOMPOSE",
    response,
    fallbackModel: model,
    status: mapExternalStatus(response.status),
    requestPayload: {
      model,
      protocolCommit: investigation.protocol_commit,
      purpose: "claim_decomposition",
      artifactIds: artifacts.map((artifact) => artifact.id),
      artifactHashes: artifacts.map((artifact) => ({
        id: artifact.id,
        sha256: artifact.sha256,
      })),
    },
  });

  await appendAuditEvent(investigationId, "AI_JOB_STARTED", {
    jobId: job.id,
    jobType: job.job_type,
    responseId: response.id,
    model: job.model,
  });

  return job;
}

export async function startDiscovery(investigationId: string) {
  const investigation = await getInvestigation(investigationId);
  if (!investigation) throw new Error("Investigation not found.");
  if (investigation.pre_redteam_frozen_at) {
    throw new Error("The Page-1 dossier is frozen.");
  }
  if (investigation.current_phase !== "IDENTIFICATION") {
    throw new Error("Evidence discovery is only available during IDENTIFICATION.");
  }

  const priorJobs = await listAiJobs(investigationId, 100);
  const activeJobs = priorJobs.filter((job) =>
    ["QUEUED", "IN_PROGRESS", "PROCESSING"].includes(job.status),
  );
  if (activeJobs.length > 0) {
    throw new Error("Another AI research job is already active for this investigation.");
  }

  const linkedArtifacts = await ensureArtifactSources(investigationId);
  if (linkedArtifacts.length > 0) {
    await appendAuditEvent(investigationId, "ARTIFACT_SOURCES_ENSURED", {
      artifactSources: linkedArtifacts,
      note:
        "Submitted artifacts entered the source ledger for downstream screening and eligibility; this does not itself establish credibility.",
    });
  }

  const claims = await getClaims(investigationId);
  if (claims.length < 1) {
    throw new Error("Evidence discovery requires at least one decomposed claim.");
  }

  const plannedSearchStrategy =
    searchStrategyFromDecompositionJobs(priorJobs);

  const model = researchModel();
  const canonicalProtocol = await loadCanonicalInitialProtocol();
  const requestPayload = {
    model,
    reasoning: { effort: "high" },
    tools: [
      {
        type: "web_search",
        search_context_size: "high",
},
    ],
    tool_choice: "required",
    include: ["web_search_call.action.sources"],
    input: [
      {
        role: "system",
        content: CREDIFY_RESEARCH_SYSTEM + "\n\n" + canonicalProtocol,
      },
      {
        role: "user",
        content: discoveryPrompt(
          investigation,
          claims,
          plannedSearchStrategy,
        ),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "credify_evidence_discovery",
        strict: true,
        schema: DISCOVERY_SCHEMA,
      },
    },
  };

  const response = await createBackgroundResponse(requestPayload);
  const job = await persistBackgroundJobOrCancel({
    investigationId,
    jobType: "DISCOVERY",
    response,
    fallbackModel: model,
    status: mapExternalStatus(response.status),
    requestPayload: {
      model,
      protocolCommit: investigation.protocol_commit,
      purpose: "evidence_discovery",
      claimIds: claims.map((claim) => claim.id),
      artifactSources: linkedArtifacts,
      plannedSearchStrategy,
      coveragePlanStatus: plannedSearchStrategy
        ? "DECOMPOSITION_PLAN_AVAILABLE"
        : "NO_DECOMPOSITION_PLAN",
    },
  });

  await appendAuditEvent(investigationId, "AI_JOB_STARTED", {
    jobId: job.id,
    jobType: job.job_type,
    responseId: response.id,
    model: job.model,
  });

  return job;
}

async function processDecomposition(
  investigationId: string,
  output: DecompositionOutput,
  rawResponse: OpenAIResponse,
) {
  const intakeSources = extractWebSources(rawResponse);
  const queries = extractWebQueries(rawResponse);
  const existingClaims = await getClaims(investigationId);

  async function logIntakeSearches(claimIds: string[]) {
    for (const query of queries) {
      await createSearchLog({
        investigationId,
        claimIds,
        databaseOrPlatform: "OpenAI Responses web_search / Intake context",
        queryExact: query,
        resultCount: intakeSources.length,
        notes:
          "Context recovery used only to understand submitted material before claim decomposition. Results are not admitted evidence and must be rediscovered/audited downstream.",
      });
    }
  }

  if (existingClaims.length > 0) {
    await logIntakeSearches(existingClaims.map((claim) => claim.id));
    return {
      skipped: true,
      reason:
        "Claims were added while the decomposition job was running; AI output was preserved but not merged automatically.",
      decomposition: output,
      webQueries: queries,
      intakeContextSources: intakeSources,
    };
  }

  const created: Array<{ id: string; whyMaterial: string }> = [];
  for (const claim of output.claims) {
    const record = await createClaim(investigationId, {
      text: claim.text,
      claimType: claim.claim_type,
      requiresPrimaryEvidence: claim.requires_primary_evidence,
    });
    created.push({ id: record.id, whyMaterial: claim.why_material });
  }

  await logIntakeSearches(created.map((claim) => claim.id));

  await appendAuditEvent(investigationId, "AI_CLAIM_DECOMPOSITION_APPLIED", {
    createdClaims: created,
    domain: output.domain,
    researchQuestions: output.research_questions,
    searchStrategy: output.search_strategy,
    knownAmbiguities: output.known_ambiguities,
    webQueries: queries,
    intakeContextSources: intakeSources,
    intakeContextOnly: true,
  });

  return {
    skipped: false,
    createdClaims: created,
    decomposition: output,
    webQueries: queries,
    intakeContextSources: intakeSources,
    intakeContextOnly: true,
  };
}

async function sourceForSelection(
  investigationId: string,
  selection: DiscoveryOutput["selected_sources"][number],
  canonicalUrl: string,
) {
  const existing = await findSourceByUrl(investigationId, canonicalUrl);
  if (existing) return existing;

  return createSource(investigationId, {
    title: selection.title,
    sourceType: selection.source_type,
    urlOrIdentifier: canonicalUrl,
    primaryOrSecondary: selection.primary_or_secondary,
  });
}

async function processDiscovery(
  investigationId: string,
  claims: ClaimRecord[],
  output: DiscoveryOutput,
  rawResponse: Awaited<ReturnType<typeof retrieveResponse>>,
  job: AiJobRecord,
) {
  const plannedSearchStrategy =
    searchStrategyFromJobPayload(job.request_payload);
  const actualSources = extractWebSources(rawResponse);
  const actualByNormalizedUrl = new Map(
    actualSources.map((source) => [normalizedUrl(source.url), source]),
  );
  const claimIds = new Set(claims.map((claim) => claim.id));
  const accepted: Array<{ sourceId: string; url: string; claimIds: string[] }> = [];
  const rejected: string[] = [];

  for (const selection of output.selected_sources) {
    const actual = actualByNormalizedUrl.get(normalizedUrl(selection.url));
    if (!actual) {
      rejected.push(selection.url);
      continue;
    }

    const source = await sourceForSelection(
      investigationId,
      { ...selection, title: actual.title || selection.title },
      actual.url,
    );
    const validClaimIds = selection.claim_ids.filter((id) => claimIds.has(id));

    for (const claimId of validClaimIds) {
      await linkClaimSource({
        investigationId,
        claimId,
        sourceId: source.id,
        relationship: selection.evidence_role,
        notes: selection.selection_rationale,
      });
    }

    accepted.push({
      sourceId: source.id,
      url: actual.url,
      claimIds: validClaimIds,
    });
  }

  const queries = extractWebQueries(rawResponse);
  for (const query of queries) {
    await createSearchLog({
      investigationId,
      claimIds: claims.map((claim) => claim.id),
      databaseOrPlatform: "OpenAI Responses web_search",
      queryExact: query,
      resultCount: actualSources.length,
      notes:
        "Result count records unique URLs exposed across this Responses API research run; it is not asserted as a per-query search-engine result count.",
    });
  }

  await appendAuditEvent(investigationId, "AI_DISCOVERY_APPLIED", {
    acceptedSources: accepted,
    rejectedProposedUrls: rejected,
    actualToolSourceCount: actualSources.length,
    webQueries: queries,
    coverageGaps: output.coverage_gaps,
    contraryEvidenceSought: output.contrary_evidence_sought,
    plannedSearchStrategy,
    coveragePlanStatus: plannedSearchStrategy
      ? "DECOMPOSITION_PLAN_AVAILABLE"
      : "NO_DECOMPOSITION_PLAN",
  });

  return {
    researchSummary: output.research_summary,
    acceptedSources: accepted,
    rejectedProposedUrls: rejected,
    actualToolSources: actualSources,
    webQueries: queries,
    contraryEvidenceSought: output.contrary_evidence_sought,
    coverageGaps: output.coverage_gaps,
    plannedSearchStrategy,
    coveragePlanStatus: plannedSearchStrategy
      ? "DECOMPOSITION_PLAN_AVAILABLE"
      : "NO_DECOMPOSITION_PLAN",
  };
}

export async function refreshAiJob(
  investigationId: string,
  jobId: string,
) {
  const job = await getAiJob(investigationId, jobId);
  if (!job) throw new Error("AI job not found.");
  if (job.status === "COMPLETED" || job.status === "FAILED") return job;

  if (job.status === "PROCESSING") {
    if (!aiProcessingLeaseExpired(job)) return job;

    const message =
      "AI job processing lease expired after 10 minutes. Credify failed the job rather than silently replaying potentially partially applied output.";
    await failAiJob(job.id, message);
    if (job.job_type === "REDTEAM_REVIEW") {
      await markLinkedRedTeamJobFailed(job, message);
    }
    await appendAuditEvent(investigationId, "AI_JOB_PROCESSING_LEASE_EXPIRED", {
      jobId: job.id,
      jobType: job.job_type,
      priorUpdatedAt: job.updated_at,
      error: message,
    });
    return (await getAiJob(investigationId, job.id)) ?? {
      ...job,
      status: "FAILED" as const,
      error: message,
    };
  }

  const response = await retrieveResponse(job.external_response_id);

  if (response.status === "queued") {
    await updateAiJobStatus(job.id, "QUEUED");
    return { ...job, status: "QUEUED" as const };
  }

  if (response.status === "in_progress") {
    await updateAiJobStatus(job.id, "IN_PROGRESS");
    return { ...job, status: "IN_PROGRESS" as const };
  }

  if (response.status !== "completed") {
    const message =
      response.error?.message ||
      "Background model response ended with status: " + response.status;
    await failAiJob(job.id, message);
    if (job.job_type === "REDTEAM_REVIEW") {
      await markLinkedRedTeamJobFailed(job, message);
    }
    return { ...job, status: "FAILED" as const, error: message };
  }

  const claimed = await claimAiJobForProcessing(job.id);
  if (!claimed) {
    return (await getAiJob(investigationId, jobId)) ?? job;
  }

  try {
    const text = extractOutputText(response);
    let result: unknown;

    if (job.job_type === "DECOMPOSE") {
      result = await processDecomposition(
        investigationId,
        parseJson<DecompositionOutput>(text),
        response,
      );
    } else if (job.job_type === "DISCOVERY") {
      const claims = await getClaims(investigationId);
      result = await processDiscovery(
        investigationId,
        claims,
        parseJson<DiscoveryOutput>(text),
        response,
        claimed,
      );
    } else if (job.job_type === "SCREENING") {
      result = await processScreeningResponse(claimed, response);
    } else if (job.job_type === "SOURCE_AUDIT") {
      result = await processSourceAuditResponse(claimed, response);
    } else if (job.job_type === "SYNTHESIS") {
      result = await processSynthesisResponse(claimed, response);
    } else if (
      job.job_type === "PRE_REDTEAM_REPORT" ||
      job.job_type === "FINAL_REPORT"
    ) {
      result = await processReportResponse(claimed, response);
    } else if (job.job_type === "REDTEAM_REVIEW") {
      result = await processRedTeamReviewResponse(claimed, response);
    } else if (job.job_type === "RECONCILIATION") {
      result = await processReconciliationResponse(claimed, response);
    } else {
      throw new Error("Unsupported AI job type: " + job.job_type);
    }

    await completeAiJob(job.id, {
      responseId: response.id,
      model: response.model ?? job.model,
      output: result,
    });

    return await getAiJob(investigationId, job.id);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI job processing failed.";
    await failAiJob(job.id, message);
    if (job.job_type === "REDTEAM_REVIEW") {
      await markLinkedRedTeamJobFailed(job, message);
    }
    await appendAuditEvent(investigationId, "AI_JOB_FAILED", {
      jobId: job.id,
      jobType: job.job_type,
      error: message,
    });
    return await getAiJob(investigationId, job.id);
  }
}
