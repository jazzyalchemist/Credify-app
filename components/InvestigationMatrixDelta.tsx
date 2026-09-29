import {
  DIMENSION_MAXIMA,
  type CredibilityAssessmentRecord,
  type CredibilityDimensionKey,
} from "@/lib/db/credibility";

const LABELS: Record<CredibilityDimensionKey, string> = {
  provenance_traceability: "Provenance",
  author_expertise: "Author expertise",
  methodological_quality: "Methodology",
  citation_integrity: "Citation integrity",
  data_integrity: "Data integrity",
  independent_corroboration: "Independent corroboration",
  funding_conflicts: "Funding / conflicts",
  transparency_reproducibility: "Transparency / reproducibility",
  historical_cultural_temporal_context: "Historical / cultural / temporal context",
  media_digital_authenticity: "Media / digital authenticity",
  corrections_research_integrity: "Corrections / research integrity",
  adversarial_resilience: "Adversarial resilience",
};

function failures(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

export function InvestigationMatrixDelta({
  firstPass,
  final,
}: {
  firstPass: CredibilityAssessmentRecord | null;
  final: CredibilityAssessmentRecord | null;
}) {
  if (!firstPass && !final) return null;

  return (
    <section className="overallMatrixPanel">
      <div className="overallMatrixHeader">
        <div>
          <p className="kicker">Overall credibility matrix</p>
          <h2>Evidence-system integrity</h2>
          <p>
            Server-computed from the 12 protocol dimensions. This is separate from
            claim confidence and is never an average of source scores.
          </p>
        </div>
        <div className="overallScores">
          {firstPass ? (
            <div>
              <span>Page 1</span>
              <strong>{Number(firstPass.total_score).toFixed(1)} / 100</strong>
            </div>
          ) : null}
          {final ? (
            <div>
              <span>Post-RedTeam</span>
              <strong>{Number(final.total_score).toFixed(1)} / 100</strong>
            </div>
          ) : null}
        </div>
      </div>

      {firstPass && final ? (
        <div className="matrixDeltaRows">
          {(Object.keys(DIMENSION_MAXIMA) as CredibilityDimensionKey[]).map(
            (key) => {
              const before = firstPass.dimension_scores[key]?.score ?? 0;
              const after = final.dimension_scores[key]?.score ?? 0;
              const delta = after - before;
              return (
                <div className="matrixDeltaRow" key={key}>
                  <span>{LABELS[key]}</span>
                  <span>
                    {before} → {after} / {DIMENSION_MAXIMA[key]}
                  </span>
                  <strong>
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(1)}
                  </strong>
                </div>
              );
            },
          )}
        </div>
      ) : null}

      <div className="overallFailureGrid">
        {firstPass && failures(firstPass.critical_failures).length ? (
          <div>
            <strong>Page-1 critical failures</strong>
            <ul>
              {failures(firstPass.critical_failures).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {final && failures(final.critical_failures).length ? (
          <div>
            <strong>Final critical failures</strong>
            <ul>
              {failures(final.critical_failures).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
