import { getDeployStore, getStore } from "@netlify/blobs";

const STORE_NAME = "credify-artifacts";

function store() {
  if (process.env.CONTEXT === "production") {
    return getStore(STORE_NAME, { consistency: "strong" });
  }

  return getDeployStore(STORE_NAME);
}

export async function putArtifactBytes(
  key: string,
  bytes: Uint8Array,
  mimeType: string,
) {
  const blob = new Blob([bytes], { type: mimeType });
  await store().set(key, blob);
}

export async function getArtifactBytes(key: string): Promise<Uint8Array | null> {
  const data = await store().get(key, { type: "arrayBuffer" });
  if (!data) return null;
  return new Uint8Array(data as ArrayBuffer);
}

export async function deleteArtifactBytes(key: string) {
  await store().delete(key);
}
