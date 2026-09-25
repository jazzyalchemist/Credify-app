export function ClaimCard({
  id,
  claim,
  status,
  confidence,
  before,
  note,
}: {
  id: string;
  claim: string;
  status: string;
  confidence: number | null;
  before?: number;
  note?: string;
}) {
  return (
    <article className="claimCard">
      <div className="claimTop">
        <span className="claimId">{id}</span>
        <span className={"statusChip " + status.toLowerCase().replaceAll(" ", "-")}>
          {status}
        </span>
      </div>
      <h3>{claim}</h3>
      <div className="confidenceRow">
        <div>
          <small>Current confidence</small>
          <strong>{confidence === null ? "—" : confidence + "%"}</strong>
        </div>
        {before !== undefined ? (
          <div>
            <small>Pre-RedTeam</small>
            <span>{before}%</span>
          </div>
        ) : null}
      </div>
      {note ? <p className="claimNote">{note}</p> : null}
    </article>
  );
}
