import type { AiJobRecord } from "@/lib/db/ai-jobs";
import { listAiJobs } from "@/lib/db/ai-jobs";
import {
  appendAuditEvent,
  getClaims,
  getInvestigation,
  getSources,
} from "@/lib/db/repository";
import {
  listClaimSourceEdges,
  listEvidenceChains,
} from "@/lib/db/evidence";
import { listCredibilityAssessments } from "@/lib/db/credibility";
import { listArtifacts } from "@/lib/db/artifacts";
import {
  listChallenges,
  listReconciliations,
  listRedTeamReviews,
} from "@/lib/db/redteam";
import { createReport } from "@/lib/db/reports";
import {
  createBackgroundResponse,
  extractOutputText,
  researchModel,
  type OpenAIResponse,
} from "./openai";
import { CREDIFY_RESEARCH_SYSTEM } from "./prompts";
import { REPORT_SCHEMA } from "./schemas";
import { persistBackgroundJobOrCancel } from "@/lib/ai/job-launch";
import {
  loadCanonicalInitialProtocol,
  loadCanonicalReconciliationProtocol,
} from "@/lib/protocol/canonical";

type ReportOutput = {
  executive_finding: string;
  exact_claims_evaluated: string;
  credibility_standards_applied: string;
  primary_evidence: string;
  author_institutional_analysis: string;
  citation_audit: string;
  research_methodology_assessment: string;
  data_statistical_verification: string;
  funding_conflict_analysis: string;
  independent_corroboration: string;
  media_url_digital_forensics: string;
  historical_cultural_context: string;
  strongest_supporting_evidence: string;
  strongest_contrary_evidence: string;
  counter_hypothesis_test: string;
  known_unknowns: string;
  credibility_matrix: string;
  claim_level_confidence: string;
  final_assessment: string;
  source_ledger_summary: string;
  adversarial_validation: string;
  limitations_and_future_evidence: string;
};

const SECTIONS: Array<[keyof ReportOutput, string]> = [
  ["executive_finding", "1. Executive Finding"],
  ["exact_claims_evaluated", "2. Exact Claims Being Evaluated"],
  ["credibility_standards_applied", "3. Credibility Standards Applied"],
  ["primary_evidence", "4. Primary Evidence"],
  ["author_institutional_analysis", "5. Author & Institutional Analysis"],
  ["citation_audit", "6. Citation Audit"],
  ["research_methodology_assessment", "7. Research / Methodology Assessment"],
  ["data_statistical_verification", "8. Data & Statistical Verification"],
  ["funding_conflict_analysis", "9. Funding & Conflict-of-Interest Analysis"],
  ["independent_corroboration", "10. Independent Corroboration"],
  ["media_url_digital_forensics", "11. Media / URL / Digital Forensics"],
  ["historical_cultural_context", "12. Historical & Cultural Context"],
  ["strongest_supporting_evidence", "13. Strongest Supporting Evidence"],
  ["strongest_contrary_evidence", "14. Strongest Contrary Evidence"],
  ["counter_hypothesis_test", "15. Counter-Hypothesis Test"],
  ["known_unknowns", "16. Known Unknowns"],
  ["credibility_matrix", "17. Credibility Matrix"],
  ["claim_level_confidence", "18. Claim-Level Confidence"],
  ["final_assessment", "19. Assessment"],
  ["source_ledger_summary", "20. Source Ledger Summary"],
  ["adversarial_validation", "21. Adversarial Validation"],
  ["limitations_and_future_evidence", "22. Limitations & Future Evidence"],
];

function mapExternalStatus(status: string) {
  if (status === "queued") return "QUEUED" as const;
  if (status === "in_progress") return "IN_PROGRESS" as const;
  if (status === "completed") return "IN_PROGRESS" as const;
  return "FAILED" as const;
}

function parseJson<T>(text: string): T {
  if (!text) throw new Error("AI response contained no structured report.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("AI report response could not be parsed as structured JSON.");
  }
}

function sourceCitationMap(
  sources: Awaited<ReturnType<typeof getSources>>,
) {
  return new Map(
    sources.map((source) => [
      source.id,
      {
        title: source.title,
        url: source.url_or_identifier,
      },
    ]),
  );
}

function citedRecordIds(report: ReportOutput) {
  const ids = new Set<string>();
  const pattern = /\[((?:SRC|CHL|REC)-[A-Za-z0-9-]+)\]/g;

  for (const value of Object.values(report)) {
    for (const match of value.matchAll(pattern)) {
      ids.add(match[1]);
    }
  }

  return ids;
}

function validateReportCitations(
  report: ReportOutput,
  stage: "PRE_REDTEAM" | "FINAL",
  sources: Awaited<ReturnType<typeof getSources>>,
  challenges: Awaited<ReturnType<typeof listChallenges>>,
  reconciliations: Awaited<ReturnType<typeof listReconciliations>>,
) {
  const sourceIds = new Set(sources.map((source) => source.id));
  const challengeIds = new Set(challenges.map((challenge) => challenge.id));
  const reconciliationIds = new Set(
    reconciliations.map((reconciliation) => reconciliation.id),
  );
  const cited = citedRecordIds(report);
  const unknown: string[] = [];
  const forbiddenPageTwo: string[] = [];

  let sourceCitationCount = 0;
  let pageTwoCitationCount = 0;

  for (const id of cited) {
    if (id.startsWith("SRC-")) {
      if (!sourceIds.has(id)) unknown.push(id);
      else sourceCitationCount += 1;
      continue;
    }

    if (id.startsWith("CHL-")) {
      if (!challengeIds.has(id)) unknown.push(id);
      else {
        pageTwoCitationCount += 1;
        if (stage === "PRE_REDTEAM") forbiddenPageTwo.push(id);
      }
      continue;
    }

    if (id.startsWith("REC-")) {
      if (!reconciliationIds.has(id)) unknown.push(id);
      else {
        pageTwoCitationCount += 1;
        if (stage === "PRE_REDTEAM") forbiddenPageTwo.push(id);
      }
    }
  }

  if (unknown.length > 0) {
    throw new Error(
      "Report cited unknown evidence/adversarial record IDs: " +
        unknown.join(", ") +
        ".",
    );
  }

  if (forbiddenPageTwo.length > 0) {
    throw new Error(
      "Pre-RedTeam report cited Page-2 records that did not exist at freeze time: " +
        forbiddenPageTwo.join(", ") +
        ".",
    );
  }

  if (sources.length > 0 && sourceCitationCount === 0) {
    throw new Error(
      "Report contains evaluated source evidence but no validated [SRC-...] citations.",
    );
  }

  if (
    stage === "FINAL" &&
    (challenges.length > 0 || reconciliations.length > 0) &&
    pageTwoCitationCount === 0
  ) {
    throw new Error(
      "Final report contains adversarial review history but no validated [CHL-...] or [REC-...] citations.",
    );
  }
}

function renderCitationMarkdown(
  value: string,
  sources: Awaited<ReturnType<typeof getSources>>,
) {
  const sourceById = sourceCitationMap(sources);

  return value.replace(
    /\[((?:SRC|CHL|REC)-[A-Za-z0-9-]+)\]/g,
    (token, id: string) => {
      if (id.startsWith("SRC-")) {
        const source = sourceById.get(id);
        if (!source?.url || !/^https?:\/\//i.test(source.url)) return token;
        return "[" + id + "](" + source.url + ")";
      }

      return "[" + id + "](#adversarial-ledger)";
    },
  );
}

function acceptedChallengeUrls(evidence: unknown) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    return [] as string[];
  }
  const raw = (evidence as Record<string, unknown>).acceptedEvidenceUrls;
  return Array.isArray(raw)
    ? raw.filter((value): value is string => typeof value === "string")
    : [];
}

function renderAdversarialAppendix(
  challenges: Awaited<ReturnType<typeof listChallenges>>,
  reconciliations: Awaited<ReturnType<typeof listReconciliations>>,
) {
  if (challenges.length === 0 && reconciliations.length === 0) return "";

  const reconciliationByChallengeId = new Map(
    reconciliations.map((item) => [item.challenge_id, item]),
  );

  const rows: string[] = [
    "## Adversarial Ledger",
    "",
    "This appendix is generated from Credify's validated Page-2 records, not model-authored narrative.",
    "",
  ];

  for (const challenge of challenges) {
    const reconciliation = reconciliationByChallengeId.get(challenge.id);
    rows.push("### " + challenge.id);
    rows.push("");
    rows.push("- Claim: " + challenge.claim_id);
    rows.push("- Attack method: " + challenge.attack_method);
    rows.push(
      "- Reviewer proposed classification: " +
        (challenge.proposed_classification ?? "not recorded"),
    );

    const urls = acceptedChallengeUrls(challenge.evidence);
    if (urls.length > 0) {
      rows.push("- Accepted challenge evidence:");
      for (const url of urls) rows.push("  - " + url);
    }

    if (reconciliation) {
      rows.push("- Reconciliation: " + reconciliation.id);
      rows.push("- Judge classification: " + reconciliation.classification);
      rows.push(
        "- Independently reproduced: " +
          (reconciliation.independently_reproduced ? "yes" : "no"),
      );
      rows.push("- Adjudication: " + reconciliation.adjudication);
      if (reconciliation.unresolved_issue) {
        rows.push("- Unresolved issue: " + reconciliation.unresolved_issue);
      }
    }

    rows.push("");
  }

  return rows.join("\n");
}

function renderMarkdown(
  investigationTitle: string,
  stage: "PRE_REDTEAM" | "FINAL",
  report: ReportOutput,
  sources: Awaited<ReturnType<typeof getSources>>,
  challenges: Awaited<ReturnType<typeof listChallenges>>,
  reconciliations: Awaited<ReturnType<typeof listReconciliations>>,
) {
  const heading =
    stage === "PRE_REDTEAM"
      ? "Pre-RedTeam Credibility Investigation"
      : "Adversarially Hardened Final Credibility Report";

  const body = SECTIONS.map(
    ([key, title]) =>
      "## " +
      title +
      "\n\n" +
      renderCitationMarkdown(report[key].trim(), sources),
  ).join("\n\n---\n\n");

  const appendix =
    stage === "FINAL"
      ? renderAdversarialAppendix(challenges, reconciliations)
      : "";

  return [
    "# " + heading,
    "",
    "**Investigation:** " + investigationTitle,
    "**Report stage:** " + stage,
    "",
    body,
    ...(appendix ? ["", "---", "", appendix] : []),
    "",
  ].join("\n");
}

async function reportDataset(investigationId: string, stage: "PRE_REDTEAM" | "FINAL") {
  const investigation = await getInvestigation(investigationId);
  if (!investigation) throw new Error("Investigation not found.");

  const [
    claims,
    sources,
    assessments,
    edges,
    chains,
    reviews,
    challenges,
    reconciliations,
    artifacts,
  ] = await Promise.all([
    getClaims(investigationId),
    getSources(investigationId),
    listCredibilityAssessments(investigationId),
    listClaimSourceEdges(investigationId),
    listEvidenceChains(investigationId),
    listRedTeamReviews(investigationId),
    listChallenges(investigationId),
    listReconciliations(investigationId),
    listArtifacts(investigationId),
  ]);

  return {
    investigation: {
      id: investigation.id,
      title: investigation.title,
      input_material: investigation.input_material,
      investigation_mode: investigation.investigation_mode,
      protocol_version: investigation.protocol_version,
      protocol_commit: investigation.protocol_commit,
      dossier_sha256: investigation.pre_redteam_snapshot_hash,
    },
    claims,
    sources,
    assessments,
    claimSourceEdges: edges,
    evidenceChains: chains,
    artifacts: artifacts.map((artifact) => ({
      id: artifact.id,
      source_id: artifact.source_id,
      filename: artifact.original_filename,
      mime_type: artifact.mime_type,
      byte_size: Number(artifact.byte_size),
      sha256: artifact.sha256,
      capture_method: artifact.capture_method,
      captured_at: artifact.captured_at,
    })),
    redTeam:
      stage === "FINAL"
        ? { reviews, challenges, reconciliations }
        : {
            status:
              "Not yet performed. This report is the frozen input to adversarial review.",
          },
  };
}

function reportPrompt(stage: "PRE_REDTEAM" | "FINAL", dataset: unknown) {
  return `
Produce the ${stage === "PRE_REDTEAM" ? "first-pass pre-RedTeam" : "post-reconciliation final"}
Credify report from the structured investigation record below.

Do not introduce new sources or facts. This reporting stage summarizes the audited
record; it does not reopen evidence discovery.

Preserve claim-level uncertainty. Distinguish source credibility score from claim
confidence. Do not allow an aggregate score to conceal critical failures. Make
source independence and information-origin issues explicit.

OVERALL CREDIBILITY MATRIX:
- credibility_matrix must report the persisted INVESTIGATION credibility assessment
  for the relevant stage, including its server-computed /100 total, dimension-level
  scores/rationales, and critical failures.
- For PRE_REDTEAM use the FIRST_PASS investigation assessment.
- For FINAL use the FINAL investigation assessment created after reconciliation.
- Never invent or recompute an overall score in report prose and never substitute an
  average of source scores, claim scores, confidence values, or reviewer votes.

CITATION CONTRACT:
- Every statement derived from the original audited evidence must cite the exact
  source ledger ID in square brackets, for example [SRC-123].
- Use only record IDs present in the INVESTIGATION RECORD.
- Never invent a record ID or substitute a free-form URL for a validated record
  citation.
- Place citations immediately after the statement they support.
- Unsupported or unresolved statements must be labeled as such rather than given a
  fabricated citation.
- PRE_REDTEAM may use [SRC-...] only. [CHL-...] and [REC-...] records did not yet
  exist and are forbidden.
- FINAL may additionally cite [CHL-...] for an exact rival challenge/evidence bundle
  and [REC-...] for the blind judge's disposition.
- A rejected challenge is not supporting evidence. It may be cited only to describe
  that the challenge was raised, and its [REC-...] adjudication must make the
  rejection/disposition clear.
- When a final conclusion relies on Page-2 evidence, cite the relevant [CHL-...] and
  [REC-...] records; retain [SRC-...] citations for underlying Page-1 evidence when
  applicable.

MEDIA / DIGITAL FORENSICS REPORTING:
- Build media_url_digital_forensics from the structured source-assessment
  mediaForensics and mediaVerification records, not from general impressions.
- Distinguish server-extracted metadata from model interpretation.
- Do not say reverse-image search was performed unless the investigation record
  explicitly says it was externally verified. Credify's native tooling does not
  perform reverse-image matching; TEXTUAL_CORROBORATION_ONLY is not a reverse-image
  search.
- Preserve unresolved origin, geolocation, chronolocation, metadata, and
  manipulation questions explicitly.
- A valid file hash establishes byte identity/integrity within Credify; it does not
  by itself establish authenticity, authorship, provenance, or truth.

For PRE_REDTEAM:
- adversarial_validation must clearly state that independent rival review has NOT
  yet occurred and this report will be frozen as the RedTeam input.
- do not anticipate or simulate RedTeam findings.

For FINAL:
- adversarial_validation must use exact [CHL-...] and [REC-...] citations when
  describing material reviewer challenges and adjudications.
- adversarial_validation must summarize what the independent reviewers challenged,
  what reconciliation upheld/rejected/left unresolved, and how claim wording or
  confidence changed.
- final_assessment must use the reconciled final claim fields, not silently revert
  to the Page-1 first-pass conclusion.

INVESTIGATION RECORD:
--- BEGIN RECORD ---
${JSON.stringify(dataset)}
--- END RECORD ---
`.trim();
}

export async function startReport(
  investigationId: string,
  stage: "PRE_REDTEAM" | "FINAL",
) {
  const investigation = await getInvestigation(investigationId);
  if (!investigation) throw new Error("Investigation not found.");

  if (stage === "PRE_REDTEAM") {
    if (investigation.current_phase !== "PRE_REDTEAM") {
      throw new Error(
        "The pre-RedTeam report can only be generated during PRE_REDTEAM.",
      );
    }
    if (investigation.pre_redteam_frozen_at) {
      throw new Error("The pre-RedTeam dossier is already frozen.");
    }
  } else if (investigation.current_phase !== "FINAL") {
    throw new Error("The final report can only be generated during FINAL.");
  }

  const active = (await listAiJobs(investigationId)).filter(
    (job) =>
      job.job_type ===
        (stage === "PRE_REDTEAM"
          ? "PRE_REDTEAM_REPORT"
          : "FINAL_REPORT") &&
      ["QUEUED", "IN_PROGRESS", "PROCESSING"].includes(job.status),
  );
  if (active.length > 0) {
    throw new Error("A report-generation job for this stage is already active.");
  }

  const [dataset, canonicalProtocol] = await Promise.all([
    reportDataset(investigationId, stage),
    stage === "PRE_REDTEAM"
      ? loadCanonicalInitialProtocol()
      : loadCanonicalReconciliationProtocol(),
  ]);

  const model = researchModel();
  const requestPayload = {
    model,
    reasoning: { effort: "high" },
    input: [
      {
        role: "system",
        content: CREDIFY_RESEARCH_SYSTEM + "\n\n" + canonicalProtocol,
      },
      { role: "user", content: reportPrompt(stage, dataset) },
    ],
    text: {
      format: {
        type: "json_schema",
        name:
          stage === "PRE_REDTEAM"
            ? "credify_pre_redteam_report"
            : "credify_final_report",
        strict: true,
        schema: REPORT_SCHEMA,
      },
    },
  };

  const response = await createBackgroundResponse(requestPayload);
  const job = await persistBackgroundJobOrCancel({
    investigationId,
    jobType:
      stage === "PRE_REDTEAM" ? "PRE_REDTEAM_REPORT" : "FINAL_REPORT",
    response,
    fallbackModel: model,
    status: mapExternalStatus(response.status),
    requestPayload: {
      purpose:
        stage === "PRE_REDTEAM"
          ? "pre_redteam_report"
          : "final_adversarial_report",
      protocolCommit: investigation.protocol_commit,
      stage,
    },
  });

  await appendAuditEvent(investigationId, "REPORT_JOB_STARTED", {
    jobId: job.id,
    stage,
  });

  return job;
}

export async function processReportResponse(
  job: AiJobRecord,
  response: OpenAIResponse,
) {
  const investigation = await getInvestigation(job.investigation_id);
  if (!investigation) throw new Error("Investigation not found.");

  const stage =
    job.job_type === "PRE_REDTEAM_REPORT"
      ? "PRE_REDTEAM"
      : job.job_type === "FINAL_REPORT"
        ? "FINAL"
        : null;

  if (!stage) throw new Error("Unsupported report job type.");

  if (stage === "PRE_REDTEAM" && investigation.pre_redteam_frozen_at) {
    throw new Error(
      "The pre-RedTeam dossier was frozen before this report job completed; late Page-1 report output cannot alter the frozen adversarial input.",
    );
  }

  const structured = parseJson<ReportOutput>(extractOutputText(response));
  const [sources, challenges, reconciliations] = await Promise.all([
    getSources(job.investigation_id),
    listChallenges(job.investigation_id),
    listReconciliations(job.investigation_id),
  ]);
  validateReportCitations(
    structured,
    stage,
    sources,
    challenges,
    reconciliations,
  );
  const markdown = renderMarkdown(
    investigation.title,
    stage,
    structured,
    sources,
    challenges,
    reconciliations,
  );
  const report = await createReport({
    investigationId: job.investigation_id,
    stage,
    structuredContent: structured,
    markdownContent: markdown,
    model: response.model ?? job.model,
    aiJobId: job.id,
  });

  await appendAuditEvent(job.investigation_id, "REPORT_ARTIFACT_CREATED", {
    jobId: job.id,
    reportId: report.id,
    stage,
    sha256: report.sha256,
  });

  return {
    reportId: report.id,
    stage,
    sha256: report.sha256,
  };
}
