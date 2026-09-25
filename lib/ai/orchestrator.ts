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
  createAiJob,
  failAiJob,
  getAiJob,
  listAiJobs,
  updateAiJobStatus,
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
} from "./openai";
import { CREDIFY_RESEARCH_SYSTEM, decompositionPrompt, discoveryPrompt } from "./prompts";
import { DECOMPOSITION_SCHEMA, DISCOVERY_SCHEMA } from "./schemas";
import { loadCanonicalInitialProtocol } from "@/lib/protocol/canonical";
import {
  markLinkedRedTeamJobFailed,
  processReconciliationResponse,
  processRedTeamReviewResponse,
} from "@/lib/redteam/orchestrator";

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

  const activeJobs = (await listAiJobs(investigationId)).filter((job) =>
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
  const canonicalProtocol = await loadCanonicalInitialProtocol();
  const requestPayload = {
    model,
    reasoning: { effort: "medium" },
    input: [
      {
        role: "system",
        content: CREDIFY_RESEARCH_SYSTEM + "\n\n" + canonicalProtocol,
      },
      { role: "user", content: decompositionPrompt(investigation) },
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
  const job = await createAiJob({
    investigationId,
    jobType: "DECOMPOSE",
    externalResponseId: response.id,
    model: response.model || model,
    status: mapExternalStatus(response.status),
    requestPayload: {
      model,
      protocolCommit: investigation.protocol_commit,
      purpose: "claim_decomposition",
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

  const activeJobs = (await listAiJobs(investigationId)).filter((job) =>
    ["QUEUED", "IN_PROGRESS", "PROCESSING"].includes(job.status),
  );
  if (activeJobs.length > 0) {
    throw new Error("Another AI research job is already active for this investigation.");
  }

  const claims = await getClaims(investigationId);
  if (claims.length < 1) {
    throw new Error("Evidence discovery requires at least one decomposed claim.");
  }

  const model = researchModel();
  const canonicalProtocol = await loadCanonicalInitialProtocol();
  const requestPayload = {
    model,
    reasoning: { effort: "high" },
    tools: [
      {
        type: "web_search",
        search_context_size: "high",
        external_web_access: true,
      },
    ],
    tool_choice: "required",
    include: ["web_search_call.action.sources"],
    input: [
      {
        role: "system",
        content: CREDIFY_RESEARCH_SYSTEM + "\n\n" + canonicalProtocol,
      },
      { role: "user", content: discoveryPrompt(investigation, claims) },
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
  const job = await createAiJob({
    investigationId,
    jobType: "DISCOVERY",
    externalResponseId: response.id,
    model: response.model || model,
    status: mapExternalStatus(response.status),
    requestPayload: {
      model,
      protocolCommit: investigation.protocol_commit,
      purpose: "evidence_discovery",
      claimIds: claims.map((claim) => claim.id),
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
) {
  const existingClaims = await getClaims(investigationId);
  if (existingClaims.length > 0) {
    return {
      skipped: true,
      reason:
        "Claims were added while the decomposition job was running; AI output was preserved but not merged automatically.",
      decomposition: output,
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

  await appendAuditEvent(investigationId, "AI_CLAIM_DECOMPOSITION_APPLIED", {
    createdClaims: created,
    domain: output.domain,
    researchQuestions: output.research_questions,
    searchStrategy: output.search_strategy,
    knownAmbiguities: output.known_ambiguities,
  });

  return {
    skipped: false,
    createdClaims: created,
    decomposition: output,
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
) {
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
  });

  return {
    researchSummary: output.research_summary,
    acceptedSources: accepted,
    rejectedProposedUrls: rejected,
    actualToolSources: actualSources,
    webQueries: queries,
    contraryEvidenceSought: output.contrary_evidence_sought,
    coverageGaps: output.coverage_gaps,
  };
}

export async function refreshAiJob(
  investigationId: string,
  jobId: string,
) {
  const job = await getAiJob(investigationId, jobId);
  if (!job) throw new Error("AI job not found.");
  if (job.status === "COMPLETED" || job.status === "FAILED") return job;
  if (job.status === "PROCESSING") return job;

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
      );
    } else if (job.job_type === "DISCOVERY") {
      const claims = await getClaims(investigationId);
      result = await processDiscovery(
        investigationId,
        claims,
        parseJson<DiscoveryOutput>(text),
        response,
      );
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
