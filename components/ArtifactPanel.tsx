"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { InvestigationPhase } from "@/lib/protocol/types";

type Artifact = {
  id: string;
  source_id: string | null;
  role: string;
  original_filename: string;
  mime_type: string;
  byte_size: number | string;
  sha256: string;
  capture_method: string;
  metadata: unknown;
  captured_at: string | Date;
};

function metadataExtractionStatus(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "UNKNOWN";
  }

  const extraction = (value as Record<string, unknown>).extraction;
  if (!extraction || typeof extraction !== "object" || Array.isArray(extraction)) {
    return "UNKNOWN";
  }

  const status = (extraction as Record<string, unknown>).status;
  return typeof status === "string" ? status : "UNKNOWN";
}

function formatBytes(value: number | string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return String(value);
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

export function ArtifactPanel({
  investigationId,
  currentPhase,
  frozen,
  artifacts,
}: {
  investigationId: string;
  currentPhase: InvestigationPhase;
  frozen: boolean;
  artifacts: Artifact[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const canUpload =
    !frozen &&
    (currentPhase === "INTAKE" || currentPhase === "IDENTIFICATION");

  async function upload(file: File | null) {
    if (!file || !canUpload) return;
    setBusy(true);
    setMessage("");

    const form = new FormData();
    form.append("file", file);

    const response = await fetch(
      "/api/investigations/" +
        encodeURIComponent(investigationId) +
        "/artifacts",
      {
        method: "POST",
        body: form,
      },
    );

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      duplicate?: boolean;
    };

    setBusy(false);

    if (!response.ok) {
      setMessage(data.error ?? "Unable to upload artifact.");
      return;
    }

    setMessage(
      data.duplicate
        ? "Identical bytes were already present; Credify reused the existing artifact record."
        : "Artifact stored and SHA-256 recorded.",
    );
    router.refresh();
  }

  return (
    <section className="panel artifactPanel">
      <div className="panelHeading">
        <div>
          <p className="kicker">Evidence artifacts</p>
          <h2>Original files and media</h2>
        </div>
        <span className="statusChip">{artifacts.length} artifacts</span>
      </div>

      <p className="panelIntro">
        Credify stores the original bytes separately from the narrative report.
        Each artifact receives a SHA-256 and is re-verified on download. Identical
        bytes do not create duplicate evidence records. During AI analysis,
        integrity-verified artifact bytes and supported extracted metadata may be
        sent to the configured OpenAI API. Image metadata can include device, timestamp, or location fields when present. A matching SHA-256 proves byte
        identity inside Credify; it does not by itself prove authenticity,
        authorship, provenance, or truth.
      </p>

      {canUpload ? (
        <label className="artifactDrop">
          <input
            type="file"
            disabled={busy}
            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.txt,.md,.markdown,.html,.htm,.xml,.json,.csv,.tsv,.doc,.docx,.rtf,.xls,.xlsx,.ppt,.pptx"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              void upload(file);
              event.currentTarget.value = "";
            }}
          />
          <strong>{busy ? "Storing artifact…" : "Add evidence artifact"}</strong>
          <span>
            PDF, image, text, JSON/XML, CSV/TSV, Word/RTF, Excel, or PowerPoint ·
            max 4 MB each
          </span>
        </label>
      ) : null}

      {message ? <p className="gateMessage">{message}</p> : null}

      {artifacts.length ? (
        <div className="artifactList">
          {artifacts.map((artifact) => (
            <article className="artifactCard" key={artifact.id}>
              <div className="artifactIdentity">
                <span className="claimId">{artifact.id}</span>
                <h3>{artifact.original_filename}</h3>
                <p>
                  {artifact.mime_type} · {formatBytes(artifact.byte_size)}
                </p>
              </div>
              <div className="artifactMeta">
                <span>
                  Source ledger: {artifact.source_id ?? "not yet admitted"}
                </span>
                <span>Capture: {artifact.capture_method}</span>
                <span>
                  Metadata: {metadataExtractionStatus(artifact.metadata)}
                </span>
                <code title={artifact.sha256}>
                  SHA-256 {artifact.sha256.slice(0, 20)}…
                </code>
              </div>
              <a
                className="smallButton"
                href={
                  "/api/investigations/" +
                  encodeURIComponent(investigationId) +
                  "/artifacts/" +
                  encodeURIComponent(artifact.id) +
                  "/download"
                }
              >
                Verify & download
              </a>
            </article>
          ))}
        </div>
      ) : (
        <p className="emptyInline">
          No original files are attached to this investigation.
        </p>
      )}
    </section>
  );
}
