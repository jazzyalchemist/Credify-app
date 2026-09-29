import {
  appendAuditEvent,
  getClaims,
  getInvestigation,
  getSources,
  updateClaim,
  updateSource,
} from "@/lib/db/repository";
import {
  listAiJobs,
  type AiJobRecord,
} from "@/lib/db/ai-jobs";
import {
  listClaimSourceEdges,
  linkClaimSource,
  createSearchLog,
} from "@/lib/db/evidence";
import {
  listCredibilityAssessments,
  upsertCredibilityAssessment,
  type DimensionScores,
} from "@/lib/db/credibility";
import {
  createBackgroundResponse,
  extractCodeInterpreterUsage,
  extractOutputText,
  extractWebQueries,
  extractWebSources,
  hasWebSearchCall,
  researchModel,
  type OpenAIResponse,
} from "./openai";
import {
  CREDIFY_RESEARCH_SYSTEM,
  screeningPrompt,
  sourceAuditPrompt,
  synthesisPrompt,
} from "./prompts";
import {
  SCREENING_SCHEMA,
  SOURCE_AUDIT_SCHEMA,
  SYNTHESIS_SCHEMA,
} from "./schemas";
import { loadCanonicalInitialProtocol } from "@/lib/protocol/canonical";
import { persistBackgroundJobOrCancel } from "@/lib/ai/job-launch";
import {
  ensureArtifactSources,
  getArtifactBySourceId,
  listArtifacts,
} from "@/lib/db/artifacts";
import { loadVerifiedArtifactInputPart } from "@/lib/artifacts/verified";
import {
  artifactMediaApplicability,
  artifactMetadataStatus,
  artifactNeedsQuantitativeForensics,
} from "@/lib/artifacts/content";

type ScreeningOutput = {
  decisions: Array<{
    source_id: string;
    decision: "INCLUDED" | "EXCLUDED";
    reason: string;
    potential_duplicate_of_source_id: string;
  }>;
  screening_summary: string;
  unresolved_retrieval_questions: string[];
};

type DependencyEvidence = {
  key: string;
  evidence_urls: string[];
};

type SourceAuditOutput = {
  source_id: string;
  retrieval_status: "RETRIEVED" | "PARTIAL" | "NOT_RETRIEVED";
  primary_or_secondary: "PRIMARY" | "SECONDARY" | "UNKNOWN";
  provenance_status: "VERIFIED" | "PARTIAL" | "FAILED";
  information_origin_url: string;
  information_origin_status: "VERIFIED" | "UNRESOLVED";
  independence_fingerprint: {
    wire_or_release: DependencyEvidence;
    datasets: DependencyEvidence[];
    authors: DependencyEvidence[];
    institutions: DependencyEvidence[];
    funders: DependencyEvidence[];
    notes: string[];
  };
  author: string;
  institution: string;
  author_expertise_summary: string;
  institutional_analysis: string;
  peer_review_status: string;
  correction_retraction_status: string;
  funding_conflicts: string;
  methodology_summary: string;
  citation_integrity_summary: string;
  data_integrity_summary: string;
  quantitative_forensics: {
    applicability: "NOT_APPLICABLE" | "TABULAR_DATA";
    calculations_performed: string[];
    reported_figures_reproduced: string[];
    reported_figures_not_reproduced: string[];
    denominator_unit_population_checks: string[];
    statistical_warnings: string[];
    unresolved_questions: string[];
  };
  historical_cultural_temporal_context: string;
  url_forensics: {
    applicability: "NOT_APPLICABLE" | "URL_SOURCE";
    canonical_page_finding: string;
    domain_ownership_affiliation_finding: string;
    archive_historical_version_finding: string;
    redirect_lookalike_risk_finding: string;
    update_correction_policy_finding: string;
    earliest_publication_finding: string;
    unavailable_technical_checks: string[];
    unresolved_url_questions: string[];
  };
  media_digital_authenticity_summary: string;
  media_forensics: {
    applicability: "NOT_APPLICABLE" | "IMAGE" | "PDF" | "OTHER_MEDIA";
    metadata_status:
      | "NOT_APPLICABLE"
      | "NOT_PROVIDED"
      | "PARTIAL"
      | "AVAILABLE";
    metadata_findings: string[];
    visible_manipulation_indicators: string[];
    context_mismatch_indicators: string[];
    earliest_publication_finding: string;
    geolocation_chronolocation_finding: string;
    reverse_image_search_status:
      | "NOT_APPLICABLE"
      | "NOT_AVAILABLE_IN_CURRENT_TOOLING"
      | "TEXTUAL_CORROBORATION_ONLY";
    reverse_image_search_finding: string;
    unresolved_media_questions: string[];
  };
  critical_failures: string[];
  evidence_urls: string[];
  dimension_scores: DimensionScores;
  overall_rationale: string;
};

type SynthesisOutput = {
  claims: Array<{
    claim_id: string;
    first_pass_status:
      | "VERIFIED"
      | "HIGH_CONFIDENCE"
      | "TENTATIVE"
      | "UNKNOWN"
      | "CONTRADICTED";
    confidence: number;
    evidence_source_ids: string[];
    counterevidence_source_ids: string[];
    reasoning: string;
    known_unknowns: string;
    additional_evidence_needed: string;
    unresolved_material_conflict: boolean;
    critical_failure: boolean;
    dimension_scores: DimensionScores;
  }>;
  investigation_dimension_scores: DimensionScores;
  investigation_critical_failures: string[];
  investigation_rationale: string;
  executive_finding: string;
  strongest_supporting_evidence: string[];
  strongest_contrary_evidence: string[];
  counter_hypotheses_tested: string[];
  known_unknowns: string[];
};

function parseJson<T>(text: string): T {
  if (!text) throw new Error("AI response contained no structured output.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("AI response could not be parsed as structured JSON.");
  }
}

function mapExternalStatus(status: string) {
  if (status === "queued") return "QUEUED" as const;
  if (status === "in_progress") return "IN_PROGRESS" as const;
  if (status === "completed") return "IN_PROGRESS" as const;
  return "FAILED" as const;
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

function sourceUrlIdentity(value: string | null) {
  if (!value || !/^https?:\/\//i.test(value)) return null;

  try {
    const parsed = new URL(value);
    parsed.hash = "";
    if (parsed.pathname !== "/") {
      parsed.pathname = parsed.pathname.replace(/\/$/, "");
    }

    return {
      submittedUrl: value,
      normalizedUrl: parsed.toString(),
      hostname: parsed.hostname.toLowerCase(),
      protocol: parsed.protocol.toLowerCase(),
      parseError: null as string | null,
    };
  } catch {
    return {
      submittedUrl: value,
      normalizedUrl: null,
      hostname: null,
      protocol: null,
      parseError: "Submitted HTTP(S) identifier could not be parsed as a URL.",
    };
  }
}

function canonicalDependencyKey(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return normalizeUrl(trimmed).toLowerCase();
  return trimmed.replace(/\s+/g, " ").toLowerCase();
}

function normalizeDependencyFingerprint(
  fingerprint: SourceAuditOutput["independence_fingerprint"],
  trustedUrls: Set<string>,
) {
  function normalizeEntry(
    entry: DependencyEvidence,
    label: string,
    allowEmpty = false,
  ) {
    const key = canonicalDependencyKey(entry.key);

    if (!key) {
      if (!allowEmpty || entry.evidence_urls.length > 0) {
        if (!allowEmpty) {
          throw new Error(label + " dependency key was empty.");
        }
        if (entry.evidence_urls.length > 0) {
          throw new Error(
            label + " dependency supplied evidence URLs without a dependency key.",
          );
        }
      }
      return { key: "", evidence_urls: [] as string[] };
    }

    if (entry.evidence_urls.length < 1) {
      throw new Error(
        label + " dependency requires at least one supporting evidence URL.",
      );
    }

    const normalizedUrls = [...new Set(entry.evidence_urls.map(normalizeUrl))];
    const invalid = normalizedUrls.filter((url) => !trustedUrls.has(url));
    if (invalid.length > 0) {
      throw new Error(
        label +
          " dependency referenced URLs not returned by web search or the audited source: " +
          invalid.join(", "),
      );
    }

    return { key, evidence_urls: normalizedUrls };
  }

  function normalizeList(entries: DependencyEvidence[], label: string) {
    const byKey = new Map<string, { key: string; evidence_urls: string[] }>();
    for (const entry of entries) {
      const normalized = normalizeEntry(entry, label);
      const existing = byKey.get(normalized.key);
      if (existing) {
        existing.evidence_urls = [
          ...new Set([...existing.evidence_urls, ...normalized.evidence_urls]),
        ];
      } else {
        byKey.set(normalized.key, normalized);
      }
    }
    return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
  }

  return {
    wire_or_release: normalizeEntry(
      fingerprint.wire_or_release,
      "wire/release",
      true,
    ),
    datasets: normalizeList(fingerprint.datasets, "dataset"),
    authors: normalizeList(fingerprint.authors, "author"),
    institutions: normalizeList(fingerprint.institutions, "institution"),
    funders: normalizeList(fingerprint.funders, "funder"),
    notes: fingerprint.notes.map((note) => note.trim()).filter(Boolean),
  };
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

async function ensureNoActiveNonAuditJob(investigationId: string) {
  const active = (await listAiJobs(investigationId)).filter(
    (job) =>
      ["QUEUED", "IN_PROGRESS", "PROCESSING"].includes(job.status) &&
      job.job_type !== "SOURCE_AUDIT",
  );

  if (active.length > 0) {
    throw new Error(
      "Another protocol automation job is active for this investigation.",
    );
  }
}

export async function startScreening(investigationId: string) {
  const investigation = await getInvestigation(investigationId);
  if (!investigation) throw new Error("Investigation not found.");
  if (investigation.pre_redteam_frozen_at) {
    throw new Error("The Page-1 dossier is frozen.");
  }
  if (investigation.current_phase !== "SCREENING") {
    throw new Error("AI screening is only available during SCREENING.");
  }

  await ensureNoActiveNonAuditJob(investigationId);

  const linkedArtifacts = await ensureArtifactSources(investigationId);
  if (linkedArtifacts.length > 0) {
    await appendAuditEvent(investigationId, "ARTIFACT_SOURCES_ENSURED", {
      artifactSources: linkedArtifacts,
      stage: "SCREENING",
      note:
        "Artifact/source linkage was verified before screening so submitted material cannot fall outside the source ledger.",
    });
  }

  const [claims, sources, artifacts] = await Promise.all([
    getClaims(investigationId),
    getSources(investigationId),
    listArtifacts(investigationId),
  ]);
  if (sources.length < 1) {
    throw new Error("Screening requires at least one identified source.");
  }

  const screeningArtifactEntries = [];
  for (const artifact of artifacts) {
    if (!artifact.source_id) continue;
    const part = await loadVerifiedArtifactInputPart(artifact);
    screeningArtifactEntries.push(
      {
        type: "input_text",
        text:
          "UPLOADED ARTIFACT MAPPING: " +
          artifact.id +
          " -> " +
          artifact.source_id +
          " | filename=" +
          artifact.original_filename +
          " | sha256=" +
          artifact.sha256,
      },
      part,
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
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: screeningPrompt(investigation, claims, sources, artifacts),
          },
          ...screeningArtifactEntries,
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "credify_source_screening",
        strict: true,
        schema: SCREENING_SCHEMA,
      },
    },
  };

  const response = await createBackgroundResponse(requestPayload);
  const job = await persistBackgroundJobOrCancel({
    investigationId,
    jobType: "SCREENING",
    response,
    fallbackModel: model,
    status: mapExternalStatus(response.status),
    requestPayload: {
      purpose: "source_screening",
      protocolCommit: investigation.protocol_commit,
      sourceIds: sources.map((source) => source.id),
      artifactInputs: artifacts
        .filter((artifact) => artifact.source_id)
        .map((artifact) => ({
          artifactId: artifact.id,
          sourceId: artifact.source_id,
          sha256: artifact.sha256,
        })),
    },
  });

  await appendAuditEvent(investigationId, "AI_SCREENING_STARTED", {
    jobId: job.id,
    sourceCount: sources.length,
    artifactInputCount: artifacts.filter((artifact) => artifact.source_id).length,
  });

  return job;
}

export async function startSourceAudits(
  investigationId: string,
  batchSize = 8,
) {
  const investigation = await getInvestigation(investigationId);
  if (!investigation) throw new Error("Investigation not found.");
  if (investigation.pre_redteam_frozen_at) {
    throw new Error("The Page-1 dossier is frozen.");
  }
  if (investigation.current_phase !== "ELIGIBILITY") {
    throw new Error(
      "Detailed source audits are only available during ELIGIBILITY.",
    );
  }

  await ensureNoActiveNonAuditJob(investigationId);

  const [claims, sources, assessments, jobs, artifacts] = await Promise.all([
    getClaims(investigationId),
    getSources(investigationId),
    listCredibilityAssessments(investigationId),
    listAiJobs(investigationId),
    listArtifacts(investigationId),
  ]);

  const artifactBySourceId = new Map(
    artifacts
      .filter((artifact) => artifact.source_id)
      .map((artifact) => [artifact.source_id as string, artifact]),
  );

  const included = sources.filter(
    (source) =>
      source.screening_decision === "INCLUDED" &&
      source.included_in_synthesis,
  );
  if (included.length < 1) {
    throw new Error("No included sources are available for eligibility audit.");
  }

  const assessedSourceIds = new Set(
    assessments
      .filter(
        (assessment) =>
          assessment.subject_type === "SOURCE" &&
          assessment.stage === "FIRST_PASS",
      )
      .map((assessment) => assessment.subject_id),
  );

  const activeSourceIds = new Set(
    jobs
      .filter(
        (job) =>
          job.job_type === "SOURCE_AUDIT" &&
          ["QUEUED", "IN_PROGRESS", "PROCESSING"].includes(job.status),
      )
      .map((job) => job.subject_id)
      .filter((id): id is string => Boolean(id)),
  );

  const pending = included
    .filter(
      (source) =>
        !assessedSourceIds.has(source.id) && !activeSourceIds.has(source.id),
    )
    .slice(0, Math.max(1, Math.min(batchSize, 8)));

  if (pending.length === 0) {
    return {
      started: [],
      remaining: 0,
      message: "All included sources are already audited or currently running.",
    };
  }

  const model = researchModel();
  const canonicalProtocol = await loadCanonicalInitialProtocol();
  const started: Array<{ sourceId: string; jobId: string }> = [];
  const errors: Array<{ sourceId: string; error: string }> = [];

  for (const source of pending) {
    try {
      const artifact = artifactBySourceId.get(source.id) ?? null;
      const artifactPart = artifact
        ? await loadVerifiedArtifactInputPart(artifact)
        : null;
      const userContent = [
        {
          type: "input_text",
          text: sourceAuditPrompt(investigation, source, claims, artifact),
        },
        ...(artifactPart ? [artifactPart] : []),
      ];

      const quantitativeForensicsRequired = Boolean(
        artifact && artifactNeedsQuantitativeForensics(artifact.mime_type),
      );

      const requestPayload = {
        model,
        reasoning: { effort: "high" },
        tools: [
          {
            type: "web_search",
            search_context_size: "high",
          },
          ...(quantitativeForensicsRequired
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
            content: CREDIFY_RESEARCH_SYSTEM + "\n\n" + canonicalProtocol,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "credify_source_credibility_audit",
            strict: true,
            schema: SOURCE_AUDIT_SCHEMA,
          },
        },
      };

      const response = await createBackgroundResponse(requestPayload);
      const job = await persistBackgroundJobOrCancel({
        investigationId,
        jobType: "SOURCE_AUDIT",
        response,
        fallbackModel: model,
        status: mapExternalStatus(response.status),
        requestPayload: {
          purpose: "source_credibility_audit",
          protocolCommit: investigation.protocol_commit,
          sourceId: source.id,
          artifactId: artifact?.id ?? null,
          artifactSha256: artifact?.sha256 ?? null,
          quantitativeForensicsRequired,
        },
        subjectId: source.id,
      });
      started.push({ sourceId: source.id, jobId: job.id });
    } catch (error) {
      errors.push({
        sourceId: source.id,
        error:
          error instanceof Error ? error.message : "Unable to start source audit.",
      });
    }
  }

  const newlyActive = new Set([
    ...activeSourceIds,
    ...started.map((item) => item.sourceId),
  ]);
  const remaining = included.filter(
    (source) =>
      !assessedSourceIds.has(source.id) && !newlyActive.has(source.id),
  ).length;

  await appendAuditEvent(investigationId, "SOURCE_AUDIT_BATCH_STARTED", {
    started,
    errors,
    remaining,
    batchLimit: 8,
  });

  return { started, errors, remaining };
}

export async function startSynthesis(investigationId: string) {
  const investigation = await getInvestigation(investigationId);
  if (!investigation) throw new Error("Investigation not found.");
  if (investigation.pre_redteam_frozen_at) {
    throw new Error("The Page-1 dossier is frozen.");
  }
  if (investigation.current_phase !== "SYNTHESIS") {
    throw new Error("AI synthesis is only available during SYNTHESIS.");
  }

  await ensureNoActiveNonAuditJob(investigationId);

  const [claims, sources, assessments, claimSourceEdges] = await Promise.all([
    getClaims(investigationId),
    getSources(investigationId),
    listCredibilityAssessments(investigationId),
    listClaimSourceEdges(investigationId),
  ]);

  const included = sources.filter(
    (source) =>
      source.screening_decision === "INCLUDED" &&
      source.included_in_synthesis,
  );
  const sourceAssessments = assessments.filter(
    (assessment) =>
      assessment.subject_type === "SOURCE" &&
      assessment.stage === "FIRST_PASS" &&
      included.some((source) => source.id === assessment.subject_id),
  );

  if (claims.length < 1 || included.length < 1) {
    throw new Error("Synthesis requires claims and included evidence.");
  }
  if (sourceAssessments.length !== included.length) {
    throw new Error(
      "Every included source must complete its credibility audit before synthesis.",
    );
  }

  const model = researchModel();
  const canonicalProtocol = await loadCanonicalInitialProtocol();
  const requestPayload = {
    model,
    reasoning: { effort: "high" },
    input: [
      {
        role: "system",
        content: CREDIFY_RESEARCH_SYSTEM + "\n\n" + canonicalProtocol,
      },
      {
        role: "user",
        content: synthesisPrompt({
          investigation,
          claims,
          sources: included,
          sourceAssessments,
          claimSourceEdges,
        }),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "credify_first_pass_synthesis",
        strict: true,
        schema: SYNTHESIS_SCHEMA,
      },
    },
  };

  const response = await createBackgroundResponse(requestPayload);
  const job = await persistBackgroundJobOrCancel({
    investigationId,
    jobType: "SYNTHESIS",
    response,
    fallbackModel: model,
    status: mapExternalStatus(response.status),
    requestPayload: {
      purpose: "first_pass_claim_synthesis",
      protocolCommit: investigation.protocol_commit,
      claimIds: claims.map((claim) => claim.id),
      sourceIds: included.map((source) => source.id),
    },
  });

  await appendAuditEvent(investigationId, "AI_SYNTHESIS_STARTED", {
    jobId: job.id,
    claimCount: claims.length,
    sourceCount: included.length,
  });

  return job;
}

export async function processScreeningResponse(
  job: AiJobRecord,
  response: OpenAIResponse,
) {
  const sources = await getSources(job.investigation_id);
  const output = parseJson<ScreeningOutput>(extractOutputText(response));

  assertExactCoverage(
    sources.map((source) => source.id),
    output.decisions.map((decision) => decision.source_id),
    "Screening",
  );

  const sourceIds = new Set(sources.map((source) => source.id));
  for (const decision of output.decisions) {
    if (
      decision.potential_duplicate_of_source_id &&
      (!sourceIds.has(decision.potential_duplicate_of_source_id) ||
        decision.potential_duplicate_of_source_id === decision.source_id)
    ) {
      throw new Error(
        "Screening returned an invalid duplicate source reference for " +
          decision.source_id +
          ".",
      );
    }
  }

  for (const decision of output.decisions) {
    await updateSource(job.investigation_id, decision.source_id, {
      screeningDecision: decision.decision,
      includedInSynthesis: decision.decision === "INCLUDED",
    });
  }

  const result = {
    screeningSummary: output.screening_summary,
    unresolvedRetrievalQuestions: output.unresolved_retrieval_questions,
    decisions: output.decisions,
  };

  await appendAuditEvent(job.investigation_id, "AI_SCREENING_APPLIED", {
    jobId: job.id,
    ...result,
  });

  return result;
}

export async function processSourceAuditResponse(
  job: AiJobRecord,
  response: OpenAIResponse,
) {
  if (!job.subject_id) {
    throw new Error("Source-audit job is missing its source subject ID.");
  }

  const sources = await getSources(job.investigation_id);
  const source = sources.find((item) => item.id === job.subject_id);
  if (!source) throw new Error("Source-audit subject no longer exists.");

  const output = parseJson<SourceAuditOutput>(extractOutputText(response));
  const artifact = await getArtifactBySourceId(
    job.investigation_id,
    source.id,
  );
  const quantitativeForensicsRequired = Boolean(
    artifact && artifactNeedsQuantitativeForensics(artifact.mime_type),
  );
  const codeInterpreterUsage = extractCodeInterpreterUsage(response);
  const urlIdentity = sourceUrlIdentity(source.url_or_identifier);

  if (urlIdentity && output.url_forensics.applicability !== "URL_SOURCE") {
    throw new Error(
      "HTTP(S) source audit did not return URL_SOURCE URL forensics.",
    );
  }

  if (!urlIdentity && output.url_forensics.applicability !== "NOT_APPLICABLE") {
    throw new Error(
      "Non-URL source audit incorrectly claimed URL-source applicability.",
    );
  }

  if (!hasWebSearchCall(response)) {
    throw new Error(
      "Source audit did not execute the required independent web-search step.",
    );
  }

  if (
    quantitativeForensicsRequired &&
    (
      !codeInterpreterUsage.used ||
      codeInterpreterUsage.completedCallCount < 1 ||
      codeInterpreterUsage.codePresentCallCount < 1
    )
  ) {
    throw new Error(
      "Tabular-data source audit did not complete a verifiable Python recomputation step with executable code.",
    );
  }

  if (
    quantitativeForensicsRequired &&
    output.quantitative_forensics.applicability !== "TABULAR_DATA"
  ) {
    throw new Error(
      "Tabular-data source audit did not return TABULAR_DATA quantitative forensics.",
    );
  }

  if (
    !quantitativeForensicsRequired &&
    output.quantitative_forensics.applicability !== "NOT_APPLICABLE"
  ) {
    throw new Error(
      "Non-tabular source audit incorrectly claimed quantitative-data applicability.",
    );
  }

  const mediaApplicability = artifact
    ? artifactMediaApplicability(artifact.mime_type)
    : "NOT_APPLICABLE";
  const expectedMetadataStatus = artifactMetadataStatus(artifact);

  if (output.media_forensics.applicability !== mediaApplicability) {
    throw new Error(
      "Media-forensics applicability did not match the verified artifact type.",
    );
  }

  if (
    expectedMetadataStatus === "AVAILABLE" &&
    !["AVAILABLE", "PARTIAL"].includes(output.media_forensics.metadata_status)
  ) {
    throw new Error(
      "Media-forensics output ignored metadata that Credify actually extracted.",
    );
  }

  if (
    expectedMetadataStatus !== "AVAILABLE" &&
    output.media_forensics.metadata_status === "AVAILABLE"
  ) {
    throw new Error(
      "Media-forensics output claimed metadata availability that the artifact record does not support.",
    );
  }

  if (
    output.media_forensics.reverse_image_search_status !== "NOT_APPLICABLE" &&
    output.media_forensics.reverse_image_search_status !==
      "NOT_AVAILABLE_IN_CURRENT_TOOLING" &&
    output.media_forensics.reverse_image_search_status !==
      "TEXTUAL_CORROBORATION_ONLY"
  ) {
    throw new Error(
      "Media-forensics output claimed an unsupported reverse-image-search state.",
    );
  }

  if (output.source_id !== source.id) {
    throw new Error(
      "Source audit returned the wrong source ID: " + output.source_id + ".",
    );
  }

  const toolSources = extractWebSources(response);
  const trustedUrls = new Set(
    toolSources.map((item) => normalizeUrl(item.url)),
  );
  if (
    source.url_or_identifier &&
    /^https?:\/\//i.test(source.url_or_identifier)
  ) {
    trustedUrls.add(normalizeUrl(source.url_or_identifier));
  }

  const validatedIndependenceFingerprint =
    normalizeDependencyFingerprint(
      output.independence_fingerprint,
      trustedUrls,
    );

  const rejectedEvidenceUrls = output.evidence_urls.filter(
    (url) => !trustedUrls.has(normalizeUrl(url)),
  );
  if (rejectedEvidenceUrls.length > 0) {
    throw new Error(
      "Source audit referenced URLs not returned by web search: " +
        rejectedEvidenceUrls.join(", "),
    );
  }

  const origin = output.information_origin_url.trim();
  if (origin && !trustedUrls.has(normalizeUrl(origin))) {
    throw new Error(
      "Source audit proposed an information origin that was not verified by web search.",
    );
  }

  const assessment = await upsertCredibilityAssessment({
    investigationId: job.investigation_id,
    subjectType: "SOURCE",
    subjectId: source.id,
    stage: "FIRST_PASS",
    dimensionScores: output.dimension_scores,
    criticalFailures: output.critical_failures,
    rationale: {
      overall: output.overall_rationale,
      authorExpertise: output.author_expertise_summary,
      institutionalAnalysis: output.institutional_analysis,
      independenceFingerprint: validatedIndependenceFingerprint,
      methodology: output.methodology_summary,
      citationIntegrity: output.citation_integrity_summary,
      dataIntegrity: output.data_integrity_summary,
      quantitativeForensics: output.quantitative_forensics,
      quantitativeToolVerification: {
        required: quantitativeForensicsRequired,
        used: codeInterpreterUsage.used,
        callCount: codeInterpreterUsage.callCount,
        completedCallCount: codeInterpreterUsage.completedCallCount,
        codePresentCallCount: codeInterpreterUsage.codePresentCallCount,
        containerIds: codeInterpreterUsage.containerIds,
        calls: codeInterpreterUsage.calls,
      },
      context: output.historical_cultural_temporal_context,
      urlForensics: output.url_forensics,
      urlIdentityVerification: urlIdentity,
      mediaAuthenticity: output.media_digital_authenticity_summary,
      mediaForensics: output.media_forensics,
      mediaVerification: {
        applicability: mediaApplicability,
        metadataStatusFromArtifact: expectedMetadataStatus,
        reverseImageCapability: "NOT_AVAILABLE_IN_CURRENT_TOOLING",
      },
    },
    evidenceRefs: output.evidence_urls,
  });

  await updateSource(job.investigation_id, source.id, {
    author: output.author.trim() || null,
    institution: output.institution.trim() || null,
    primaryOrSecondary: output.primary_or_secondary,
    provenanceStatus: output.provenance_status,
    retrievalStatus: output.retrieval_status,
    peerReviewStatus: output.peer_review_status,
    correctionRetractionStatus: output.correction_retraction_status,
    fundingConflicts: output.funding_conflicts,
    informationOriginId: origin ? normalizeUrl(origin) : null,
    informationOriginStatus: output.information_origin_status,
    independenceFingerprint: validatedIndependenceFingerprint,
    credibilityScore: Number(assessment.total_score),
  });

  const queries = extractWebQueries(response);
  for (const query of queries) {
    await createSearchLog({
      investigationId: job.investigation_id,
      claimIds: [],
      databaseOrPlatform: "OpenAI Responses web_search / Source audit",
      queryExact: query,
      resultCount: toolSources.length,
      notes: "Search activity for source " + source.id + ".",
    });
  }

  const result = {
    sourceId: source.id,
    totalScore: Number(assessment.total_score),
    criticalFailures: output.critical_failures,
    provenanceStatus: output.provenance_status,
    informationOriginId: origin ? normalizeUrl(origin) : null,
    informationOriginStatus: output.information_origin_status,
    independenceFingerprint: validatedIndependenceFingerprint,
    evidenceUrls: output.evidence_urls,
    webQueries: queries,
    quantitativeForensics: output.quantitative_forensics,
    mediaForensics: output.media_forensics,
    mediaVerification: {
      applicability: mediaApplicability,
      metadataStatusFromArtifact: expectedMetadataStatus,
      reverseImageCapability: "NOT_AVAILABLE_IN_CURRENT_TOOLING",
    },
    quantitativeToolVerification: {
      required: quantitativeForensicsRequired,
      used: codeInterpreterUsage.used,
      callCount: codeInterpreterUsage.callCount,
      completedCallCount: codeInterpreterUsage.completedCallCount,
      codePresentCallCount: codeInterpreterUsage.codePresentCallCount,
      containerIds: codeInterpreterUsage.containerIds,
      calls: codeInterpreterUsage.calls,
    },
  };

  await appendAuditEvent(job.investigation_id, "SOURCE_CREDIBILITY_AUDIT_APPLIED", {
    jobId: job.id,
    ...result,
  });

  return result;
}

export async function processSynthesisResponse(
  job: AiJobRecord,
  response: OpenAIResponse,
) {
  const [claims, sources] = await Promise.all([
    getClaims(job.investigation_id),
    getSources(job.investigation_id),
  ]);
  const included = sources.filter(
    (source) =>
      source.screening_decision === "INCLUDED" &&
      source.included_in_synthesis,
  );
  const sourceById = new Map(included.map((source) => [source.id, source]));
  const output = parseJson<SynthesisOutput>(extractOutputText(response));

  assertExactCoverage(
    claims.map((claim) => claim.id),
    output.claims.map((claim) => claim.claim_id),
    "Synthesis",
  );

  for (const claimOutput of output.claims) {
    const allRefs = [
      ...claimOutput.evidence_source_ids,
      ...claimOutput.counterevidence_source_ids,
    ];
    const invalid = allRefs.filter((id) => !sourceById.has(id));
    if (invalid.length > 0) {
      throw new Error(
        "Synthesis referenced unknown or excluded source IDs: " +
          [...new Set(invalid)].join(", "),
      );
    }
  }

  const claimById = new Map(claims.map((claim) => [claim.id, claim]));
  const applied: Array<{
    claimId: string;
    confidence: number;
    totalScore: number;
  }> = [];

  for (const claimOutput of output.claims) {
    const claim = claimById.get(claimOutput.claim_id);
    if (!claim) throw new Error("Synthesis claim disappeared during processing.");

    const supportingSources = claimOutput.evidence_source_ids
      .map((id) => sourceById.get(id))
      .filter((source) => Boolean(source));
    const primaryRecovered = supportingSources.some(
      (source) => source?.primary_or_secondary === "PRIMARY",
    );

    const assessment = await upsertCredibilityAssessment({
      investigationId: job.investigation_id,
      subjectType: "CLAIM",
      subjectId: claim.id,
      stage: "FIRST_PASS",
      dimensionScores: claimOutput.dimension_scores,
      criticalFailures: claimOutput.critical_failure
        ? ["Claim-level critical failure identified during synthesis."]
        : [],
      rationale: { reasoning: claimOutput.reasoning },
      evidenceRefs: [
        ...claimOutput.evidence_source_ids,
        ...claimOutput.counterevidence_source_ids,
      ],
    });

    await updateClaim(job.investigation_id, claim.id, {
      firstPassStatus: claimOutput.first_pass_status,
      firstPassConfidence: claimOutput.confidence,
      primaryEvidenceRecovered:
        claim.requires_primary_evidence ? primaryRecovered : false,
      criticalFailure: claimOutput.critical_failure,
      unresolvedMaterialConflict: claimOutput.unresolved_material_conflict,
      knownUnknowns: claimOutput.known_unknowns,
      additionalEvidenceNeeded: claimOutput.additional_evidence_needed,
    });

    for (const sourceId of claimOutput.evidence_source_ids) {
      await linkClaimSource({
        investigationId: job.investigation_id,
        claimId: claim.id,
        sourceId,
        relationship: "SUPPORTS",
        notes: "Confirmed during Page-1 synthesis.",
      });
    }
    for (const sourceId of claimOutput.counterevidence_source_ids) {
      await linkClaimSource({
        investigationId: job.investigation_id,
        claimId: claim.id,
        sourceId,
        relationship: "CONTRADICTS",
        notes: "Confirmed during Page-1 synthesis.",
      });
    }

    applied.push({
      claimId: claim.id,
      confidence: claimOutput.confidence,
      totalScore: Number(assessment.total_score),
    });
  }

  const investigationAssessment = await upsertCredibilityAssessment({
    investigationId: job.investigation_id,
    subjectType: "INVESTIGATION",
    subjectId: job.investigation_id,
    stage: "FIRST_PASS",
    dimensionScores: output.investigation_dimension_scores,
    criticalFailures: output.investigation_critical_failures,
    rationale: {
      overall: output.investigation_rationale,
      basis:
        "Investigation-level matrix evaluates the integrity and resilience of the full evidentiary system; it is not an arithmetic average of source or claim scores.",
    },
    evidenceRefs: included.map((source) => source.id),
  });

  const result = {
    executiveFinding: output.executive_finding,
    strongestSupportingEvidence: output.strongest_supporting_evidence,
    strongestContraryEvidence: output.strongest_contrary_evidence,
    counterHypothesesTested: output.counter_hypotheses_tested,
    knownUnknowns: output.known_unknowns,
    investigationMatrix: {
      totalScore: Number(investigationAssessment.total_score),
      dimensionScores: output.investigation_dimension_scores,
      criticalFailures: output.investigation_critical_failures,
      rationale: output.investigation_rationale,
    },
    appliedClaims: applied,
  };

  await appendAuditEvent(job.investigation_id, "AI_SYNTHESIS_APPLIED", {
    jobId: job.id,
    ...result,
  });

  return result;
}
