import exifr from "exifr";

export type ArtifactMetadataExtraction =
  | {
      status: "NOT_APPLICABLE";
      parser: null;
      metadata: Record<string, never>;
      error: null;
    }
  | {
      status: "NOT_SUPPORTED";
      parser: "exifr@7.1.3";
      metadata: Record<string, never>;
      error: null;
    }
  | {
      status: "NONE_FOUND";
      parser: "exifr@7.1.3";
      metadata: Record<string, never>;
      error: null;
    }
  | {
      status: "AVAILABLE";
      parser: "exifr@7.1.3";
      metadata: Record<string, unknown>;
      error: null;
    }
  | {
      status: "FAILED";
      parser: "exifr@7.1.3";
      metadata: Record<string, never>;
      error: string;
    };

const EXIFR_SUPPORTED_MIME = new Set([
  "image/jpeg",
  "image/png",
]);

function sanitizeValue(
  value: unknown,
  depth = 0,
): unknown {
  if (value === null) return null;
  if (depth > 4) return "[depth-limit]";

  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    if (typeof value === "string") return value.slice(0, 1000);
    if (typeof value === "number" && !Number.isFinite(value)) {
      return String(value);
    }
    return value;
  }

  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();

  if (
    value instanceof Uint8Array ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value)
  ) {
    return "[binary-data-omitted]";
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const key of Object.keys(record).sort().slice(0, 100)) {
      const item = record[key];
      if (item === undefined || typeof item === "function") continue;
      output[key.slice(0, 200)] = sanitizeValue(item, depth + 1);
    }

    return output;
  }

  return String(value).slice(0, 1000);
}

export async function extractArtifactMetadata(
  mimeType: string,
  bytes: Uint8Array,
): Promise<ArtifactMetadataExtraction> {
  if (!mimeType.startsWith("image/")) {
    return {
      status: "NOT_APPLICABLE",
      parser: null,
      metadata: {},
      error: null,
    };
  }

  if (!EXIFR_SUPPORTED_MIME.has(mimeType)) {
    return {
      status: "NOT_SUPPORTED",
      parser: "exifr@7.1.3",
      metadata: {},
      error: null,
    };
  }

  try {
    const parsed = await exifr.parse(bytes);

    if (!parsed || typeof parsed !== "object") {
      return {
        status: "NONE_FOUND",
        parser: "exifr@7.1.3",
        metadata: {},
        error: null,
      };
    }

    const sanitized = sanitizeValue(parsed);
    const metadata =
      sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
        ? (sanitized as Record<string, unknown>)
        : {};

    if (Object.keys(metadata).length === 0) {
      return {
        status: "NONE_FOUND",
        parser: "exifr@7.1.3",
        metadata: {},
        error: null,
      };
    }

    return {
      status: "AVAILABLE",
      parser: "exifr@7.1.3",
      metadata,
      error: null,
    };
  } catch (error) {
    return {
      status: "FAILED",
      parser: "exifr@7.1.3",
      metadata: {},
      error:
        error instanceof Error
          ? error.message.slice(0, 1000)
          : "Metadata parser failed.",
    };
  }
}
