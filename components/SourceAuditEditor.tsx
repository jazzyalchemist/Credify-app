"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { InvestigationPhase } from "@/lib/protocol/types";

export function SourceAuditEditor({
  investigationId,
  sourceId,
  phase,
  retrievalStatus,
  provenanceStatus,
  primaryOrSecondary,
  screeningDecision,
  originId,
  credibilityScore,
}: {
  investigationId: string;
  sourceId: string;
  phase: InvestigationPhase;
  retrievalStatus: string;
  provenanceStatus: string;
  primaryOrSecondary: string;
  screeningDecision: string;
  originId: string | null;
  credibilityScore: number | null;
}) {
  const router = useRouter();
  const [retrieval, setRetrieval] = useState(retrievalStatus);
  const [provenance, setProvenance] = useState(provenanceStatus);
  const [primary, setPrimary] = useState(primaryOrSecondary);
  const [screening, setScreening] = useState(screeningDecision);
  const [origin, setOrigin] = useState(originId ?? "");
  const [score, setScore] = useState(
    credibilityScore === null ? "" : String(credibilityScore),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const screeningMode = phase === "SCREENING";
  const auditMode = phase === "ELIGIBILITY" || phase === "ANALYSIS";

  async function save() {
    if (!screeningMode && !auditMode) return;
    setBusy(true);
    setError("");

    const payload = screeningMode
      ? {
          screeningDecision: screening,
          includedInSynthesis: screening === "INCLUDED",
        }
      : {
          retrievalStatus: retrieval,
          provenanceStatus: provenance,
          primaryOrSecondary: primary,
          informationOriginId: origin.trim() || null,
          credibilityScore: score.trim() === "" ? null : Number(score),
        };

    const response = await fetch(
      "/api/investigations/" +
        encodeURIComponent(investigationId) +
        "/sources/" +
        encodeURIComponent(sourceId),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setBusy(false);

    if (!response.ok) {
      setError(data.error ?? "Unable to save source state.");
      return;
    }

    router.refresh();
  }

  if (!screeningMode && !auditMode) return null;

  return (
    <div className="sourceAuditEditor">
      {screeningMode ? (
        <>
          <select
            value={screening}
            onChange={(event) => setScreening(event.target.value)}
          >
            <option value="PENDING">Screening pending</option>
            <option value="INCLUDED">Include</option>
            <option value="EXCLUDED">Exclude</option>
          </select>
          <button className="smallButton" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save screening"}
          </button>
        </>
      ) : (
        <>
          <select
            value={retrieval}
            onChange={(event) => setRetrieval(event.target.value)}
          >
            <option value="DISCOVERED">Discovered</option>
            <option value="PENDING">Retrieval pending</option>
            <option value="RETRIEVED">Retrieved</option>
            <option value="PARTIAL">Partially retrieved</option>
            <option value="NOT_RETRIEVED">Not retrieved</option>
            <option value="EXCLUDED">Excluded</option>
          </select>
          <select
            value={provenance}
            onChange={(event) => setProvenance(event.target.value)}
          >
            <option value="UNASSESSED">Provenance unassessed</option>
            <option value="VERIFIED">Provenance verified</option>
            <option value="PARTIAL">Provenance partial</option>
            <option value="FAILED">Provenance failed</option>
          </select>
          <select
            value={primary}
            onChange={(event) => setPrimary(event.target.value)}
          >
            <option value="UNKNOWN">Primary status unknown</option>
            <option value="PRIMARY">Primary</option>
            <option value="SECONDARY">Secondary</option>
          </select>
          <input
            className="textInput compactInput"
            value={origin}
            onChange={(event) => setOrigin(event.target.value)}
            placeholder="Verified information-origin URL"
          />
          <input
            className="scoreInput"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={score}
            onChange={(event) => setScore(event.target.value)}
            placeholder="Score"
          />
          <button className="smallButton" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save source audit"}
          </button>
        </>
      )}
      {error ? <p className="formError">{error}</p> : null}
    </div>
  );
}
