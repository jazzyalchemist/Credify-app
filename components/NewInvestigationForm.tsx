"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function NewInvestigationForm() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("AUTO");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    router.push("/investigations/demo");
  }

  return (
    <form className="intakeCard" onSubmit={submit}>
      <div className="intakeHeading">
        <span className="spark">✦</span>
        <div>
          <h2>Investigate this</h2>
          <p>
            Paste a claim, URL, research question, article excerpt, organization,
            or other material. Files and media ingestion come next.
          </p>
        </div>
      </div>

      <textarea
        aria-label="Investigation input"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="Example: Evaluate the credibility of this article and determine which claims survive independent primary-source verification…"
        rows={8}
      />

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

        <button className="primaryButton" type="submit">
          Start protocol
          <span>→</span>
        </button>
      </div>

      <div className="protocolNotice">
        <strong>Protocol-enforced.</strong> Credify will not issue a final
        investigation report until required evidence gates, RedTeam review, and
        reconciliation are satisfied.
      </div>
    </form>
  );
}
