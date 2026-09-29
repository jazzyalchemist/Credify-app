import type { ArtifactRecord } from "@/lib/db/artifacts";

const EXTENSION_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".html": "text/html",
  ".htm": "text/html",
  ".xml": "text/xml",
  ".json": "application/json",
  ".csv": "text/csv",
  ".tsv": "text/tab-separated-values",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".rtf": "application/rtf",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export function safeArtifactFilename(value: string) {
  const leaf = value.split(/[\\/]/).pop() || "artifact";
  const cleaned = leaf
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "artifact").slice(0, 180);
}

export function inferArtifactMime(
  filename: string,
  suppliedMime: string | null | undefined,
) {
  const supplied = (suppliedMime ?? "").trim().toLowerCase();
  if (supplied && supplied !== "application/octet-stream") return supplied;

  const lower = filename.toLowerCase();
  const extension = Object.keys(EXTENSION_MIME)
    .sort((a, b) => b.length - a.length)
    .find((key) => lower.endsWith(key));

  return extension ? EXTENSION_MIME[extension] : supplied || "application/octet-stream";
}

export function artifactIsImage(mimeType: string) {
  return [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ].includes(mimeType);
}

export function buildArtifactInputPart(
  artifact: ArtifactRecord,
  bytes: Uint8Array,
) {
  const encoded = Buffer.from(bytes).toString("base64");
  const dataUrl =
    "data:" + artifact.mime_type + ";base64," + encoded;

  if (artifactIsImage(artifact.mime_type)) {
    return {
      type: "input_image",
      image_url: dataUrl,
      detail: "high",
    };
  }

  return {
    type: "input_file",
    filename: artifact.original_filename,
    file_data: dataUrl,
    ...(artifact.mime_type === "application/pdf"
      ? { detail: "high" }
      : {}),
  };
}
