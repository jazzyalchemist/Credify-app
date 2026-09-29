"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClaimAuditEditor({
  investigationId,
  claimId,
  initialStatus,
  initialConfidence,
  requiresPrimary,
  primaryRecovered,
  criticalFailure,
  unresolvedConflict,
}: {
  investigationId: string;
  claimId: string;
  initialStatus: string;
  initialConfidence: number | null;
  requiresPrimary: boolean;
  primaryRecovered: boolean;
  criticalFailure: boolean;
  unresolvedConflict: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [confidence, setConfidence] = useState(
    initialConfidence === null ? "" : String(initialConfidence),
  );
  const [recovered, setRecovered] = useState(primaryRecovered);
  const [critical, setCritical] = useState(criticalFailure);
  const [conflict, setConflict] = useState(unresolvedConflict);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const parsedConfidence =
      confidence.trim() === "" ? null : Number(confidence);

    const response = await fetch(
      "/api/investigations/" +
        encodeURIComponent(investigationId) +
        "/claims/" +
        encodeURIComponent(claimId),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstPassStatus: status,
          firstPassConfidence: parsedConfidence,
          primaryEvidenceRecovered: recovered,
          criticalFailure: critical,
          unresolvedMaterialConflict: conflict,
        }),
      },
    );

    setBusy(false);
    if (response.ok) router.refresh();
  }

  return (
    <div className="auditEditor">
      <select value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="UNASSESSED">Unassessed</option>
        <option value="VERIFIED">Verified fact</option>
        <option value="HIGH_CONFIDENCE">High-confidence inference</option>
        <option value="TENTATIVE">Tentative</option>
        <option value="UNKNOWN">Unknown</option>
        <option value="CONTRADICTED">Contradicted</option>
      </select>
      <input
        className="scoreInput"
        type="number"
        min="0"
        max="100"
        step="0.1"
        value={confidence}
        onChange={(event) => setConfidence(event.target.value)}
        placeholder="%"
      />
      {requiresPrimary ? (
        <label className="miniCheck">
          <input
            type="checkbox"
            checked={recovered}
            onChange={(event) => setRecovered(event.target.checked)}
          />
          Primary recovered
        </label>
      ) : null}
      <label className="miniCheck dangerCheck">
        <input
          type="checkbox"
          checked={critical}
          onChange={(event) => setCritical(event.target.checked)}
        />
        Critical failure
      </label>
      <label className="miniCheck warnCheck">
        <input
          type="checkbox"
          checked={conflict}
          onChange={(event) => setConflict(event.target.checked)}
        />
        Unresolved conflict
      </label>
      <button className="smallButton" onClick={save} disabled={busy}>
        {busy ? "Saving…" : "Save audit"}
      </button>
    </div>
  );
}
