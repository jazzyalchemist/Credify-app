import type { ArtifactRecord } from "@/lib/db/artifacts";
import type { SourceRecord } from "@/lib/db/types";

export function CitedReportText({
  text,
  sources,
  artifacts,
  investigationId,
}: {
  text: string;
  sources: SourceRecord[];
  artifacts: ArtifactRecord[];
  investigationId: string;
}) {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const artifactBySourceId = new Map(
    artifacts
      .filter((artifact) => artifact.source_id)
      .map((artifact) => [artifact.source_id as string, artifact]),
  );
  const parts = text.split(/(\[SRC-[A-Za-z0-9-]+\])/g);

  return (
    <p>
      {parts.map((part, index) => {
        const match = /^\[(SRC-[A-Za-z0-9-]+)\]$/.exec(part);
        if (!match) return part;

        const source = sourceById.get(match[1]);
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
              className="citationChip"
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
              className="citationChip"
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
            className="citationChip"
            title={source.title}
            key={index}
          >
            {part}
          </span>
        );
      })}
    </p>
  );
}
