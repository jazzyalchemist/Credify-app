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
  const lower = filename.toLowerCase();
  const extension = Object.keys(EXTENSION_MIME)
    .sort((a, b) => b.length - a.length)
    .find((key) => lower.endsWith(key));

  // Known file extensions are the canonical type identity. Browser-provided MIME
  // remains advisory and must not silently redefine the stored artifact type.
  if (extension) return EXTENSION_MIME[extension];

  return supplied && supplied !== "application/octet-stream"
    ? supplied
    : "application/octet-stream";
}

function startsWithBytes(bytes: Uint8Array, signature: number[]) {
  if (bytes.byteLength < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

function startsWithAscii(bytes: Uint8Array, value: string, offset = 0) {
  if (bytes.byteLength < offset + value.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (bytes[offset + index] !== value.charCodeAt(index)) return false;
  }
  return true;
}

export function artifactSignatureCheck(
  mimeType: string,
  bytes: Uint8Array,
): { valid: boolean; checked: boolean; reason: string } {
  let valid: boolean | null = null;
  let expectation = "";

  if (mimeType === "application/pdf") {
    valid = startsWithAscii(bytes, "%PDF-");
    expectation = "PDF header";
  } else if (mimeType === "image/jpeg") {
    valid = startsWithBytes(bytes, [0xff, 0xd8, 0xff]);
    expectation = "JPEG signature";
  } else if (mimeType === "image/png") {
    valid = startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expectation = "PNG signature";
  } else if (mimeType === "image/gif") {
    valid =
      startsWithAscii(bytes, "GIF87a") ||
      startsWithAscii(bytes, "GIF89a");
    expectation = "GIF signature";
  } else if (mimeType === "image/webp") {
    valid =
      startsWithAscii(bytes, "RIFF") &&
      startsWithAscii(bytes, "WEBP", 8);
    expectation = "RIFF/WEBP signature";
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    valid = startsWithBytes(bytes, [0x50, 0x4b]);
    expectation = "ZIP container signature";
  } else if (
    mimeType === "application/msword" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.ms-powerpoint"
  ) {
    valid = startsWithBytes(bytes, [
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
    ]);
    expectation = "OLE compound-document signature";
  } else if (
    mimeType === "application/rtf" ||
    mimeType === "text/rtf"
  ) {
    valid = startsWithAscii(bytes, "{\\rtf");
    expectation = "RTF header";
  }

  if (valid === null) {
    return {
      valid: true,
      checked: false,
      reason: "No reliable binary signature rule is defined for this type.",
    };
  }

  return {
    valid,
    checked: true,
    reason: valid
      ? "Matched expected " + expectation + "."
      : "Bytes did not match expected " + expectation + ".",
  };
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
      type: "input_image" as const,
      image_url: dataUrl,
      detail: "high",
    };
  }

  return {
    type: "input_file" as const,
    filename: artifact.original_filename,
    file_data: dataUrl,
    ...(artifact.mime_type === "application/pdf"
      ? { detail: "high" }
      : {}),
  };
}


export function artifactNeedsQuantitativeForensics(mimeType: string) {
  return [
    "text/csv",
    "application/csv",
    "text/tab-separated-values",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ].includes(mimeType);
}
