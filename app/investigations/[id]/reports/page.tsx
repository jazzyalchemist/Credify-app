import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getInvestigation } from "@/lib/db/repository";
import { listReports } from "@/lib/db/reports";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  executive_finding: "Executive Finding",
  exact_claims_evaluated: "Exact Claims Evaluated",
  credibility_standards_applied: "Credibility Standards Applied",
  primary_evidence: "Primary Evidence",
  author_institutional_analysis: "Author & Institutional Analysis",
  citation_audit: "Citation Audit",
  research_methodology_assessment: "Research / Methodology Assessment",
  data_statistical_verification: "Data & Statistical Verification",
  funding_conflict_analysis: "Funding & Conflict-of-Interest Analysis",
  independent_corroboration: "Independent Corroboration",
  media_url_digital_forensics: "Media / URL / Digital Forensics",
  historical_cultural_context: "Historical & Cultural Context",
  strongest_supporting_evidence: "Strongest Supporting Evidence",
  strongest_contrary_evidence: "Strongest Contrary Evidence",
  counter_hypothesis_test: "Counter-Hypothesis Test",
  known_unknowns: "Known Unknowns",
  credibility_matrix: "Credibility Matrix",
  claim_level_confidence: "Claim-Level Confidence",
  final_assessment: "Assessment",
  source_ledger_summary: "Source Ledger Summary",
  adversarial_validation: "Adversarial Validation",
  limitations_and_future_evidence: "Limitations & Future Evidence",
};

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const investigation = await getInvestigation(id);
  if (!investigation) notFound();

  const reports = await listReports(id);

  return (
    <AppShell
      eyebrow={investigation.id + " · reports"}
      title="Credibility reports"
      subtitle="Versioned narrative outputs. The pre-RedTeam report is frozen into the adversarial dossier; final reports are generated only from the reconciled state."
    >
      <div className="reportNav">
        <Link
          className="ghostButton"
          href={"/investigations/" + encodeURIComponent(id)}
        >
          ← Workspace
        </Link>
        <Link
          className="ghostButton"
          href={"/investigations/" + encodeURIComponent(id) + "/audit"}
        >
          Investigator / audit view
        </Link>
      </div>

      {reports.length === 0 ? (
        <section className="emptyState">
          <p className="kicker">No report artifacts yet</p>
          <h2>Generate the pre-RedTeam report from the workspace.</h2>
          <p>
            Credify preserves report versions instead of silently replacing them.
          </p>
        </section>
      ) : (
        <div className="reportStack">
          {reports
            .slice()
            .reverse()
            .map((report) => {
              const content =
                report.structured_content &&
                typeof report.structured_content === "object"
                  ? (report.structured_content as Record<string, unknown>)
                  : {};

              return (
                <article className="reportArtifact" key={report.id}>
                  <header className="reportArtifactHeader">
                    <div>
                      <p className="kicker">{report.stage.replaceAll("_", " ")}</p>
                      <h2>
                        {report.stage === "FINAL"
                          ? "Adversarially Hardened Final Report"
                          : "Pre-RedTeam Credibility Investigation"}
                      </h2>
                      <p>
                        {report.id} · SHA-256 {report.sha256}
                      </p>
                    </div>
                    <a
                      className="smallButton"
                      href={
                        "/api/investigations/" +
                        encodeURIComponent(id) +
                        "/reports/" +
                        encodeURIComponent(report.id) +
                        "/download"
                      }
                    >
                      Download Markdown
                    </a>
                  </header>

                  <div className="reportSections">
                    {Object.entries(content).map(([key, value], index) => (
                      <section className="reportSection" key={key}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <div>
                          <h3>{LABELS[key] ?? key.replaceAll("_", " ")}</h3>
                          <p>{String(value)}</p>
                        </div>
                      </section>
                    ))}
                  </div>
                </article>
              );
            })}
        </div>
      )}
    </AppShell>
  );
}
