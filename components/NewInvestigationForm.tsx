"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function NewInvestigationForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("AUTO");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !input.trim()) return;

    setBusy(true);
    setError("");

    const response = await fetch("/api/investigations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        inputMaterial: input,
        investigationMode: mode,
      }),
    });

    const data = (await response.json()) as {
      investigation?: { id: string };
      error?: string;
    };

    if (!response.ok || !data.investigation) {
      setError(data.error ?? "Unable to create investigation.");
      setBusy(false);
      return;
    }

    router.push("/investigations/" + encodeURIComponent(data.investigation.id));
    router.refresh();
  }

  return (
    <form className="intakeCard" onSubmit={submit}>
      <div className="intakeHeading">
        <span className="spark">✦</span>
        <div>
          <h2>Investigate this</h2>
          <p>
            Start with the exact material or question. Credify stores the original
            input alongside the protocol snapshot so the investigation can be
            reproduced later.
          </p>
        </div>
      </div>

      <label className="fieldLabel">
        Investigation title
        <input
          className="textInput"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Example: Credibility of the reported causal claim"
          maxLength={180}
          required
        />
      </label>

      <label className="fieldLabel">
        Material / research question
        <textarea
          aria-label="Investigation input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Paste a claim, URL, article excerpt, research question, or describe what should be investigated…"
          rows={8}
          required
        />
      </label>

      <div className="formRow">
        <label>
          Investigation mode
          <select value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value="AUTO">Auto-detect</option>
            <option value="ACADEMIC">Academic / scientific</option>
            <option value="NEWS">News / current events</option>
            <option value="HISTORICAL">Historical</option>
            <option value="MEDIA">Image / video</option>
            <option value="CORPORATE">Corporate / organization</option>
            <option value="OSINT">General OSINT</option>
          </select>
        </label>

        <button className="primaryButton" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Start protocol"}
          {!busy ? <span>→</span> : null}
        </button>
      </div>

      {error ? <p className="formError">{error}</p> : null}

      <div className="protocolNotice">
        <strong>Protocol-enforced.</strong> A final report cannot be issued until
        required evidence gates, independent RedTeam review, and reconciliation are
        satisfied.
      </div>
    </form>
  );
}
