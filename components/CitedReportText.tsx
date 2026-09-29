import type { ArtifactRecord } from "@/lib/db/artifacts";
import type {
  ChallengeRecord,
  ReconciliationRecord,
} from "@/lib/db/redteam";
import type { SourceRecord } from "@/lib/db/types";

export function CitedReportText({
  text,
  sources,
  artifacts,
  challenges,
  reconciliations,
  investigationId,
}: {
  text: string;
  sources: SourceRecord[];
  artifacts: ArtifactRecord[];
  challenges: ChallengeRecord[];
  reconciliations: ReconciliationRecord[];
  investigationId: string;
}) {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const artifactBySourceId = new Map(
    artifacts
      .filter((artifact) => artifact.source_id)
      .map((artifact) => [artifact.source_id as string, artifact]),
  );
  const challengeById = new Map(
    challenges.map((challenge) => [challenge.id, challenge]),
  );
  const reconciliationById = new Map(
    reconciliations.map((reconciliation) => [
      reconciliation.id,
      reconciliation,
    ]),
  );

  const parts = text.split(/(\[(?:SRC|CHL|REC)-[A-Za-z0-9-]+\])/g);

  return (
    <p>
      {parts.map((part, index) => {
        const match = /^\[((?:SRC|CHL|REC)-[A-Za-z0-9-]+)\]$/.exec(part);
        if (!match) return part;

        const id = match[1];

        if (id.startsWith("SRC-")) {
          const source = sourceById.get(id);
          if (!source) {
            return (
              <span className="citationChip invalidCitation" key={index}>
                {part}
              </span>
            );
          }

          const artifact = artifactBySourceId.get(source.id);
          if (artifact) {
            return (
              <a
                className="citationChip sourceCitation"
                href={
                  "/api/investigations/" +
                  encodeURIComponent(investigationId) +
                  "/artifacts/" +
                  encodeURIComponent(artifact.id) +
                  "/download"
                }
                title={
                  source.title +
                  " · artifact SHA-256 " +
                  artifact.sha256
                }
                key={index}
              >
                {part}
              </a>
            );
          }

          if (
            source.url_or_identifier &&
            /^https?:\/\//i.test(source.url_or_identifier)
          ) {
            return (
              <a
                className="citationChip sourceCitation"
                href={source.url_or_identifier}
                target="_blank"
                rel="noreferrer"
                title={source.title}
                key={index}
              >
                {part}
              </a>
            );
          }

          return (
            <span
              className="citationChip sourceCitation"
              title={source.title}
              key={index}
            >
              {part}
            </span>
          );
        }

        if (id.startsWith("CHL-")) {
          const challenge = challengeById.get(id);
          if (!challenge) {
            return (
              <span className="citationChip invalidCitation" key={index}>
                {part}
              </span>
            );
          }

          return (
            <a
              className="citationChip challengeCitation"
              href={
                "/investigations/" +
                encodeURIComponent(investigationId) +
                "/audit#challenges"
              }
              title={
                "Rival challenge · " +
                challenge.attack_method +
                " · claim " +
                challenge.claim_id
              }
              key={index}
            >
              {part}
            </a>
          );
        }

        const reconciliation = reconciliationById.get(id);
        if (!reconciliation) {
          return (
            <span className="citationChip invalidCitation" key={index}>
              {part}
            </span>
          );
        }

        return (
          <a
            className="citationChip reconciliationCitation"
            href={
              "/investigations/" +
              encodeURIComponent(investigationId) +
              "/audit#reconciliation"
            }
            title={
              "Blind adjudication · " +
              reconciliation.classification +
              " · challenge " +
              reconciliation.challenge_id
            }
            key={index}
          >
            {part}
          </a>
        );
      })}
    </p>
  );
}
