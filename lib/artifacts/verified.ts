import { createHash } from "crypto";
import type { ArtifactRecord } from "@/lib/db/artifacts";
import { getArtifactBytes } from "@/lib/storage/artifacts";
import { buildArtifactInputPart } from "@/lib/artifacts/content";

export async function loadVerifiedArtifactBytes(
  artifact: ArtifactRecord,
): Promise<Uint8Array> {
  const bytes = await getArtifactBytes(artifact.storage_key);

  if (!bytes) {
    throw new Error(
      "Artifact bytes are unavailable for " + artifact.id + ".",
    );
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== artifact.sha256) {
    throw new Error(
      "Artifact integrity verification failed for " +
        artifact.id +
        "; model analysis was blocked.",
    );
  }

  if (bytes.byteLength !== Number(artifact.byte_size)) {
    throw new Error(
      "Artifact byte-size verification failed for " +
        artifact.id +
        "; model analysis was blocked.",
    );
  }

  return bytes;
}

export async function loadVerifiedArtifactInputPart(
  artifact: ArtifactRecord,
) {
  const bytes = await loadVerifiedArtifactBytes(artifact);
  return buildArtifactInputPart(artifact, bytes);
}
