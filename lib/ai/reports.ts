import type { AiJobRecord } from "@/lib/db/ai-jobs";
import {
  createAiJob,
  listAiJobs,
} from "@/lib/db/ai-jobs";
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

function renderMarkdown(
  investigationTitle: string,
  stage: "PRE_REDTEAM" | "FINAL",
  report: ReportOutput,
) {
  const heading =
    stage === "PRE_REDTEAM"
      ? "Pre-RedTeam Credibility Investigation"
      : "Adversarially Hardened Final Credibility Report";

  const body = SECTIONS.map(
    ([key, title]) => "## " + title + "\n\n" + report[key].trim(),
  ).join("\n\n---\n\n");

  return [
    "# " + heading,
    "",
    "**Investigation:** " + investigationTitle,
    "**Report stage:** " + stage,
    "",
    body,
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
  ] = await Promise.all([
    getClaims(investigationId),
    getSources(investigationId),
    listCredibilityAssessments(investigationId),
    listClaimSourceEdges(investigationId),
    listEvidenceChains(investigationId),
    listRedTeamReviews(investigationId),
    listChallenges(investigationId),
    listReconciliations(investigationId),
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

For PRE_REDTEAM:
- adversarial_validation must clearly state that independent rival review has NOT
  yet occurred and this report will be frozen as the RedTeam input.
- do not anticipate or simulate RedTeam findings.

For FINAL:
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
  const job = await createAiJob({
    investigationId,
    jobType:
      stage === "PRE_REDTEAM" ? "PRE_REDTEAM_REPORT" : "FINAL_REPORT",
    externalResponseId: response.id,
    model: response.model || model,
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

  const structured = parseJson<ReportOutput>(extractOutputText(response));
  const markdown = renderMarkdown(investigation.title, stage, structured);
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
