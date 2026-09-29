import { createHash } from "crypto";
import { getArtifact } from "@/lib/db/artifacts";
import { getArtifactBytes } from "@/lib/storage/artifacts";
import { safeArtifactFilename } from "@/lib/artifacts/content";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; artifactId: string }> },
) {
  const { id, artifactId } = await context.params;
  const artifact = await getArtifact(id, artifactId);

  if (!artifact) {
    return new Response("Artifact not found.", { status: 404 });
  }

  const bytes = await getArtifactBytes(artifact.storage_key);
  if (!bytes) {
    return new Response("Artifact bytes are unavailable.", { status: 410 });
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== artifact.sha256) {
    return new Response("Artifact integrity verification failed.", {
      status: 500,
    });
  }

  return new Response(bytes, {
    headers: {
      "Content-Type": artifact.mime_type,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition":
        'attachment; filename="' +
        safeArtifactFilename(artifact.original_filename).replace(/"/g, "") +
        '"',
      "Cache-Control": "private, no-store",
      "X-Credify-SHA256": sha256,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
