import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  MAX_ARTIFACT_BYTES,
  MAX_ARTIFACT_COUNT,
  MAX_TOTAL_ARTIFACT_BYTES,
  SUPPORTED_ARTIFACT_MIME_TYPES,
  assertArtifactUploadAllowed,
  createArtifact,
  findArtifactBySha,
  listArtifacts,
} from "@/lib/db/artifacts";
import {
  artifactSignatureCheck,
  inferArtifactMime,
  safeArtifactFilename,
} from "@/lib/artifacts/content";
import {
  deleteArtifactBytes,
  putArtifactBytes,
} from "@/lib/storage/artifacts";
import { appendAuditEvent } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return NextResponse.json({ artifacts: await listArtifacts(id) });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const stats = await assertArtifactUploadAllowed(id);
    const form = await request.formData();
    const value = form.get("file");

    if (!(value instanceof File)) {
      return NextResponse.json(
        { error: "A file field is required." },
        { status: 400 },
      );
    }

    const filename = safeArtifactFilename(value.name);
    const mimeType = inferArtifactMime(filename, value.type);

    if (!SUPPORTED_ARTIFACT_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        {
          error:
            "Unsupported artifact type. Credify currently accepts PDF, common images, text/JSON/XML, CSV/TSV, Word/RTF, Excel, and PowerPoint files.",
        },
        { status: 415 },
      );
    }

    if (value.size < 1 || value.size > MAX_ARTIFACT_BYTES) {
      return NextResponse.json(
        {
          error:
            "Artifact must be between 1 byte and " +
            Math.floor(MAX_ARTIFACT_BYTES / (1024 * 1024)) +
            " MB.",
        },
        { status: 413 },
      );
    }

    if (stats.count >= MAX_ARTIFACT_COUNT) {
      return NextResponse.json(
        { error: "This investigation has reached its artifact-count limit." },
        { status: 409 },
      );
    }

    if (stats.totalBytes + value.size > MAX_TOTAL_ARTIFACT_BYTES) {
      return NextResponse.json(
        { error: "This investigation has reached its total artifact-size limit." },
        { status: 413 },
      );
    }

    const bytes = new Uint8Array(await value.arrayBuffer());
    const signature = artifactSignatureCheck(mimeType, bytes);

    if (!signature.valid) {
      await appendAuditEvent(id, "ARTIFACT_SIGNATURE_REJECTED", {
        submittedFilename: filename,
        submittedMime: value.type || null,
        canonicalMime: mimeType,
        byteSize: bytes.byteLength,
        reason: signature.reason,
      });

      return NextResponse.json(
        {
          error:
            "Artifact bytes do not match the expected file signature for " +
            mimeType +
            ".",
        },
        { status: 415 },
      );
    }

    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const existing = await findArtifactBySha(id, sha256);

    if (existing) {
      await appendAuditEvent(id, "ARTIFACT_DUPLICATE_UPLOAD_DETECTED", {
        existingArtifactId: existing.id,
        submittedFilename: filename,
        sha256,
      });
      return NextResponse.json({ artifact: existing, duplicate: true });
    }

    const artifactId = "ART-" + randomUUID();
    const storageKey =
      "investigations/" + id + "/artifacts/" + artifactId + "/raw";

    await putArtifactBytes(storageKey, bytes, mimeType);

    try {
      const artifact = await createArtifact({
        id: artifactId,
        investigationId: id,
        originalFilename: filename,
        mimeType,
        byteSize: bytes.byteLength,
        sha256,
        storageKey,
      });

      await appendAuditEvent(id, "ARTIFACT_UPLOADED", {
        artifactId: artifact.id,
        filename,
        submittedMime: value.type || null,
        canonicalMime: mimeType,
        signatureChecked: signature.checked,
        signatureReason: signature.reason,
        byteSize: bytes.byteLength,
        sha256,
      });

      return NextResponse.json({ artifact, duplicate: false }, { status: 201 });
    } catch (error) {
      await deleteArtifactBytes(storageKey).catch(() => undefined);

      const raced = await findArtifactBySha(id, sha256);
      if (raced) {
        await appendAuditEvent(id, "ARTIFACT_DUPLICATE_UPLOAD_RACE_RESOLVED", {
          existingArtifactId: raced.id,
          submittedFilename: filename,
          sha256,
        });
        return NextResponse.json({ artifact: raced, duplicate: true });
      }

      throw error;
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to store artifact.",
      },
      { status: 409 },
    );
  }
}
