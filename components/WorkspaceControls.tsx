"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { InvestigationPhase } from "@/lib/protocol/types";

const PHASES: InvestigationPhase[] = [
  "INTAKE",
  "IDENTIFICATION",
  "SCREENING",
  "ELIGIBILITY",
  "ANALYSIS",
  "SYNTHESIS",
  "PRE_REDTEAM",
  "REDTEAM",
  "RECONCILIATION",
  "FINAL",
];

function nextPhase(current: InvestigationPhase) {
  const index = PHASES.indexOf(current);
  return PHASES[index + 1] ?? null;
}

export function WorkspaceControls({
  investigationId,
  currentPhase,
  phaseCheckpoints,
  preRedTeamFrozen,
}: {
  investigationId: string;
  currentPhase: InvestigationPhase;
  phaseCheckpoints: Record<string, boolean>;
  preRedTeamFrozen: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const next = nextPhase(currentPhase);

  async function call(path: string, body?: unknown) {
    setBusy(true);
    setMessage("");

    const response = await fetch(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      gate?: { blockers?: string[]; warnings?: string[] };
    };

    if (!response.ok) {
      const blockers = data.gate?.blockers?.join(" ") ?? data.error;
      setMessage(blockers || "The protocol blocked this action.");
      setBusy(false);
      return;
    }

    setMessage(data.gate?.warnings?.join(" ") ?? "");
    setBusy(false);
    router.refresh();
  }

  const checkpointPhase =
    currentPhase === "SCREENING" ||
    currentPhase === "SYNTHESIS" ||
    currentPhase === "RECONCILIATION"
      ? currentPhase
      : null;

  const needsCheckpoint =
    checkpointPhase && !phaseCheckpoints[checkpointPhase];

  const needsFreeze = currentPhase === "PRE_REDTEAM" && !preRedTeamFrozen;

  return (
    <section className="protocolControl">
      <div>
        <p className="kicker">Protocol gate</p>
        <h3>{currentPhase.replaceAll("_", " ")}</h3>
        <p>
          {next
            ? "Next permitted phase: " + next.replaceAll("_", " ")
            : "Investigation finalized."}
        </p>
      </div>

      <div className="controlAction">
        {needsCheckpoint ? (
          <button
            className="primaryButton"
            disabled={busy}
            onClick={() =>
              call(
                "/api/investigations/" +
                  encodeURIComponent(investigationId) +
                  "/checkpoint",
                { phase: checkpointPhase },
              )
            }
          >
            {busy ? "Checking…" : "Complete phase checkpoint"}
          </button>
        ) : needsFreeze ? (
          <button
            className="primaryButton"
            disabled={busy}
            onClick={() =>
              call(
                "/api/investigations/" +
                  encodeURIComponent(investigationId) +
                  "/freeze",
              )
            }
          >
            {busy ? "Freezing…" : "Freeze pre-RedTeam dossier"}
          </button>
        ) : next ? (
          <button
            className="primaryButton"
            disabled={busy}
            onClick={() =>
              call(
                "/api/investigations/" +
                  encodeURIComponent(investigationId) +
                  "/transition",
                { target: next },
              )
            }
          >
            {busy ? "Evaluating gate…" : "Advance to " + next.replaceAll("_", " ")}
          </button>
        ) : (
          <span className="activeBadge">Protocol complete</span>
        )}
      </div>

      {message ? <p className="gateMessage">{message}</p> : null}
    </section>
  );
}
