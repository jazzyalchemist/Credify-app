import type { SourceRecord } from "@/lib/db/types";

export function CitedReportText({
  text,
  sources,
}: {
  text: string;
  sources: SourceRecord[];
}) {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
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
