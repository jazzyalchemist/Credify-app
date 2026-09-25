import type { InvestigationPhase } from "@/lib/protocol/types";

const phases: { key: InvestigationPhase; label: string; group: string }[] = [
  { key: "INTAKE", label: "Mission & protocol", group: "Page 1" },
  { key: "IDENTIFICATION", label: "Identification", group: "Page 1" },
  { key: "SCREENING", label: "Screening", group: "Page 1" },
  { key: "ELIGIBILITY", label: "Eligibility", group: "Page 1" },
  { key: "ANALYSIS", label: "Analysis", group: "Page 1" },
  { key: "SYNTHESIS", label: "Credibility synthesis", group: "Page 1" },
  { key: "PRE_REDTEAM", label: "Freeze dossier", group: "Handoff" },
  { key: "REDTEAM", label: "Rival AI swarm", group: "Page 2" },
  { key: "RECONCILIATION", label: "Reconciliation", group: "Page 2" },
  { key: "FINAL", label: "Final report", group: "Page 2" },
];

export function PhaseRail({
  current,
  completed,
}: {
  current: InvestigationPhase;
  completed: InvestigationPhase[];
}) {
  return (
    <ol className="phaseRail">
      {phases.map((phase, index) => {
        const done = completed.includes(phase.key);
        const active = phase.key === current;
        return (
          <li
            key={phase.key}
            className={[
              "phaseItem",
              done ? "done" : "",
              active ? "active" : "",
            ].join(" ")}
          >
            <span className="phaseIndex">{done ? "✓" : index + 1}</span>
            <span>
              <small>{phase.group}</small>
              <strong>{phase.label}</strong>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
