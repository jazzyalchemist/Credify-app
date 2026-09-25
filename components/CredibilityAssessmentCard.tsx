import {
  DIMENSION_MAXIMA,
  type CredibilityAssessmentRecord,
  type CredibilityDimensionKey,
} from "@/lib/db/credibility";

const LABELS: Record<CredibilityDimensionKey, string> = {
  provenance_traceability: "Provenance & Traceability",
  author_expertise: "Author Expertise",
  methodological_quality: "Methodological Quality",
  citation_integrity: "Citation Integrity",
  data_integrity: "Data Integrity",
  independent_corroboration: "Independent Corroboration",
  funding_conflicts: "Funding & Conflicts",
  transparency_reproducibility: "Transparency & Reproducibility",
  historical_cultural_temporal_context: "Historical / Cultural / Temporal Context",
  media_digital_authenticity: "Media / Digital Authenticity",
  corrections_research_integrity: "Corrections / Research Integrity",
  adversarial_resilience: "Adversarial Resilience",
};

export function CredibilityAssessmentCard({
  assessment,
}: {
  assessment: CredibilityAssessmentRecord;
}) {
  return (
    <article className="matrixCard">
      <div className="matrixHeader">
        <div>
          <span className="claimId">
            {assessment.subject_type} · {assessment.subject_id}
          </span>
          <h3>{assessment.stage.replaceAll("_", " ")} credibility matrix</h3>
        </div>
        <strong>{Number(assessment.total_score).toFixed(1)} / 100</strong>
      </div>

      <div className="matrixRows">
        {(Object.keys(DIMENSION_MAXIMA) as CredibilityDimensionKey[]).map(
          (key) => {
            const detail = assessment.dimension_scores[key];
            const max = DIMENSION_MAXIMA[key];
            return (
              <div className="matrixRow" key={key}>
                <div className="matrixRowTop">
                  <span>{LABELS[key]}</span>
                  <strong>
                    {detail.score} / {max}
                  </strong>
                </div>
                <div className="matrixTrack">
                  <span
                    style={{
                      width: Math.max(0, Math.min(100, (detail.score / max) * 100)) + "%",
                    }}
                  />
                </div>
                <p>{detail.rationale}</p>
              </div>
            );
          },
        )}
      </div>

      {Array.isArray(assessment.critical_failures) &&
      assessment.critical_failures.length > 0 ? (
        <div className="criticalFailureBox">
          <strong>Critical-failure override(s)</strong>
          <ul>
            {assessment.critical_failures.map((failure, index) => (
              <li key={index}>{String(failure)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
