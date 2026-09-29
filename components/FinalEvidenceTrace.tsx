type FinalEvidenceTraceValue = {
  drivingChallengeIds: string[];
  survivingEvidenceRefs: string[];
  unresolvedChallengeIds: string[];
  changeSummary: string;
};

function parseTrace(value: unknown): FinalEvidenceTraceValue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;

  const strings = (candidate: unknown) =>
    Array.isArray(candidate)
      ? candidate.filter((item): item is string => typeof item === "string")
      : [];

  const trace = {
    drivingChallengeIds: strings(record.drivingChallengeIds),
    survivingEvidenceRefs: strings(record.survivingEvidenceRefs),
    unresolvedChallengeIds: strings(record.unresolvedChallengeIds),
    changeSummary:
      typeof record.changeSummary === "string" ? record.changeSummary : "",
  };

  if (
    trace.drivingChallengeIds.length === 0 &&
    trace.survivingEvidenceRefs.length === 0 &&
    trace.unresolvedChallengeIds.length === 0 &&
    !trace.changeSummary
  ) {
    return null;
  }

  return trace;
}

export function FinalEvidenceTrace({ value }: { value: unknown }) {
  const trace = parseTrace(value);
  if (!trace) return null;

  return (
    <details className="finalEvidenceTrace">
      <summary>Why this changed · evidence lineage</summary>
      {trace.changeSummary ? <p>{trace.changeSummary}</p> : null}

      <div className="finalTraceGrid">
        <div>
          <strong>Driving challenges</strong>
          {trace.drivingChallengeIds.length ? (
            <ul>
              {trace.drivingChallengeIds.map((id) => (
                <li key={id}><code>{id}</code></li>
              ))}
            </ul>
          ) : (
            <span>None</span>
          )}
        </div>
        <div>
          <strong>Surviving evidence</strong>
          {trace.survivingEvidenceRefs.length ? (
            <ul>
              {trace.survivingEvidenceRefs.map((ref) => (
                <li key={ref}>
                  {/^https?:\/\//i.test(ref) ? (
                    <a href={ref} target="_blank" rel="noreferrer">{ref}</a>
                  ) : (
                    <code>{ref}</code>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <span>None recorded</span>
          )}
        </div>
        <div>
          <strong>Unresolved challenges</strong>
          {trace.unresolvedChallengeIds.length ? (
            <ul>
              {trace.unresolvedChallengeIds.map((id) => (
                <li key={id}><code>{id}</code></li>
              ))}
            </ul>
          ) : (
            <span>None</span>
          )}
        </div>
      </div>
    </details>
  );
}
