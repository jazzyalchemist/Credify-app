"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_INITIAL_FILES = 8;
const MAX_FILE_BYTES = 4 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

export function NewInvestigationForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("AUTO");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdInvestigationId, setCreatedInvestigationId] = useState<
    string | null
  >(null);

  function chooseFiles(nextFiles: File[]) {
    setError("");
    setCreatedInvestigationId(null);

    if (nextFiles.length > MAX_INITIAL_FILES) {
      setError(
        "Choose at most " + MAX_INITIAL_FILES + " initial artifacts.",
      );
      return;
    }

    const oversized = nextFiles.filter(
      (file) => file.size < 1 || file.size > MAX_FILE_BYTES,
    );
    if (oversized.length > 0) {
      setError(
        "Each initial artifact must be between 1 byte and 4 MB. Check: " +
          oversized.map((file) => file.name).join(", "),
      );
      return;
    }

    setFiles(nextFiles);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!title.trim()) return;
    if (!input.trim() && files.length === 0) {
      setError("Add a claim, URL, research question, or at least one file.");
      return;
    }

    setBusy(true);
    setError("");
    setCreatedInvestigationId(null);

    const inputMaterial =
      input.trim() ||
      "Investigate the submitted artifact(s). The uploaded files are the primary submitted material.";

    const response = await fetch("/api/investigations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        inputMaterial,
        investigationMode: mode,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      investigation?: { id: string };
      error?: string;
    };

    if (!response.ok || !data.investigation) {
      setError(data.error ?? "Unable to create investigation.");
      setBusy(false);
      return;
    }

    const investigationId = data.investigation.id;
    setCreatedInvestigationId(investigationId);

    const failures: Array<{ filename: string; error: string }> = [];

    for (const file of files) {
      const form = new FormData();
      form.append("file", file);

      const upload = await fetch(
        "/api/investigations/" +
          encodeURIComponent(investigationId) +
          "/artifacts",
        {
          method: "POST",
          body: form,
        },
      );

      if (!upload.ok) {
        const result = (await upload.json().catch(() => ({}))) as {
          error?: string;
        };
        failures.push({
          filename: file.name,
          error: result.error ?? "Upload failed.",
        });
      }
    }

    setBusy(false);

    if (failures.length > 0) {
      setError(
        "Investigation created, but " +
          failures.length +
          " initial artifact" +
          (failures.length === 1 ? "" : "s") +
          " failed to upload: " +
          failures
            .map((failure) => failure.filename + " — " + failure.error)
            .join("; ") +
          ". Open the investigation to retry those files.",
      );
      return;
    }

    router.push("/investigations/" + encodeURIComponent(investigationId));
    router.refresh();
  }

  return (
    <form className="intakeCard" onSubmit={submit}>
      <div className="intakeHeading">
        <span className="spark">✦</span>
        <div>
          <h2>Investigate this</h2>
          <p>
            Start with the exact material, file, URL, claim, or question. Credify
            stores the submitted material alongside the pinned protocol so the
            investigation can be audited and reproduced later.
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
          placeholder="Paste a claim, URL, article excerpt, research question, or describe what should be investigated. You can also start from files alone below."
          rows={8}
        />
      </label>

      <label className="artifactDrop intakeArtifactDrop">
        <input
          type="file"
          multiple
          disabled={busy}
          accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.txt,.md,.markdown,.html,.htm,.xml,.json,.csv,.tsv,.doc,.docx,.rtf,.xls,.xlsx,.ppt,.pptx"
          onChange={(event) =>
            chooseFiles(Array.from(event.target.files ?? []))
          }
        />
        <strong>
          {files.length
            ? files.length + " initial artifact" + (files.length === 1 ? "" : "s")
            : "Start from file evidence"}
        </strong>
        <span>
          PDF, image, text, data, Word, Excel, or PowerPoint · up to 8 files ·
          4 MB each
        </span>
      </label>

      {files.length > 0 ? (
        <div className="intakeFileList">
          {files.map((file, index) => (
            <div className="intakeFileRow" key={file.name + "-" + index}>
              <div>
                <strong>{file.name}</strong>
                <span>{formatBytes(file.size)}</span>
              </div>
              <button
                className="smallButton"
                type="button"
                disabled={busy}
                onClick={() =>
                  setFiles((current) =>
                    current.filter((_, currentIndex) => currentIndex !== index),
                  )
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}

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
          {busy
            ? files.length
              ? "Creating & storing files…"
              : "Creating…"
            : "Start protocol"}
          {!busy ? <span>→</span> : null}
        </button>
      </div>

      {error ? (
        <div className="intakeErrorBlock">
          <p className="formError">{error}</p>
          {createdInvestigationId ? (
            <a
              className="smallButton"
              href={
                "/investigations/" +
                encodeURIComponent(createdInvestigationId)
              }
            >
              Open created investigation
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="protocolNotice">
        <strong>Protocol-enforced.</strong> A final report cannot be issued until
        required evidence gates, independent RedTeam review, and reconciliation are
        satisfied.
      </div>
    </form>
  );
}
