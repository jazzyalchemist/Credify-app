"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AddClaimForm({ investigationId }: { investigationId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [claimType, setClaimType] = useState("FACTUAL");
  const [requiresPrimary, setRequiresPrimary] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");

    const response = await fetch(
      "/api/investigations/" +
        encodeURIComponent(investigationId) +
        "/claims",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          claimType,
          requiresPrimaryEvidence: requiresPrimary,
        }),
      },
    );

    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Unable to add claim.");
      setBusy(false);
      return;
    }

    setText("");
    setBusy(false);
    router.refresh();
  }

  return (
    <form className="compactForm" onSubmit={submit}>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Add a discrete, testable claim or research proposition…"
        rows={3}
        required
      />
      <div className="compactFormRow">
        <select value={claimType} onChange={(event) => setClaimType(event.target.value)}>
          <option value="FACTUAL">Factual</option>
          <option value="STATISTICAL">Statistical</option>
          <option value="CAUSAL">Causal</option>
          <option value="HISTORICAL">Historical</option>
          <option value="INTERPRETIVE">Interpretive</option>
          <option value="ALLEGATION">Allegation</option>
          <option value="OPINION">Opinion</option>
        </select>
        <label className="checkboxLabel">
          <input
            type="checkbox"
            checked={requiresPrimary}
            onChange={(event) => setRequiresPrimary(event.target.checked)}
          />
          Primary evidence required
        </label>
        <button className="smallButton" type="submit" disabled={busy}>
          {busy ? "Adding…" : "Add claim"}
        </button>
      </div>
      {error ? <p className="formError">{error}</p> : null}
    </form>
  );
}
