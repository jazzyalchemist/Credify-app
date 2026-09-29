export function canonicalizeJson(value: unknown): unknown {
  if (value === null) return null;

  if (value instanceof Date) {
    return value.toISOString();
  }

  const type = typeof value;

  if (type === "string" || type === "boolean") {
    return value;
  }

  if (type === "number") {
    if (!Number.isFinite(value as number)) {
      throw new Error("Canonical JSON cannot encode non-finite numbers.");
    }
    return value;
  }

  if (type === "undefined" || type === "function" || type === "symbol" || type === "bigint") {
    throw new Error("Canonical JSON encountered an unsupported value type: " + type + ".");
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJson(item));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const key of Object.keys(record).sort()) {
      output[key] = canonicalizeJson(record[key]);
    }

    return output;
  }

  throw new Error("Canonical JSON encountered an unsupported value.");
}

export function canonicalJsonString(value: unknown): string {
  return JSON.stringify(canonicalizeJson(value));
}
