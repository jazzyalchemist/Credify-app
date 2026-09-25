"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AddSourceForm({ investigationId }: { investigationId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [sourceType, setSourceType] = useState("WEB");
  const [primary, setPrimary] = useState("UNKNOWN");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError("");

    const response = await fetch(
      "/api/investigations/" +
        encodeURIComponent(investigationId) +
        "/sources",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          urlOrIdentifier: url || undefined,
          sourceType,
          primaryOrSecondary: primary,
        }),
      },
    );

    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Unable to add source.");
      setBusy(false);
      return;
    }

    setTitle("");
    setUrl("");
    setBusy(false);
    router.refresh();
  }

  return (
    <form className="compactForm" onSubmit={submit}>
      <input
        className="textInput"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Source title"
        required
      />
      <input
        className="textInput"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="URL, DOI, archive ID, case number…"
      />
      <div className="compactFormRow">
        <select value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
          <option value="WEB">Web</option>
          <option value="ACADEMIC">Academic</option>
          <option value="DATASET">Dataset</option>
          <option value="NEWS">News</option>
          <option value="ARCHIVE">Archive</option>
          <option value="OFFICIAL">Official record</option>
          <option value="MEDIA">Image / media</option>
        </select>
        <select value={primary} onChange={(event) => setPrimary(event.target.value)}>
          <option value="UNKNOWN">Primary status unknown</option>
          <option value="PRIMARY">Primary</option>
          <option value="SECONDARY">Secondary</option>
        </select>
        <button className="smallButton" type="submit" disabled={busy}>
          {busy ? "Adding…" : "Add source"}
        </button>
      </div>
      {error ? <p className="formError">{error}</p> : null}
    </form>
  );
}
