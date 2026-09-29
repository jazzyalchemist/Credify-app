export type CrossrefUpdate = {
  doi: string | null;
  type: string;
  label: string | null;
  source: string | null;
  updatedAt: string | null;
};

export type CrossrefVerification =
  | {
      applicable: false;
      doi: null;
      status: "NO_DOI";
      retracted: false;
      updates: [];
      title: null;
      publisher: null;
      containerTitle: null;
      workType: null;
      checkedAt: string;
      limitation: string;
      error: null;
    }
  | {
      applicable: true;
      doi: string;
      status: "VERIFIED" | "NOT_FOUND" | "UNAVAILABLE";
      retracted: boolean;
      updates: CrossrefUpdate[];
      title: string | null;
      publisher: string | null;
      containerTitle: string | null;
      workType: string | null;
      checkedAt: string;
      limitation: string;
      error: string | null;
    };

const DOI_PATTERN = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;

export function extractDoi(value: string | null | undefined): string | null {
  if (!value) return null;

  let candidate = value.trim();

  try {
    const url = new URL(candidate);
    if (url.hostname.toLowerCase() === "doi.org") {
      candidate = decodeURIComponent(url.pathname.replace(/^\//, ""));
    }
  } catch {
    // Raw DOI strings are expected and do not need to parse as URLs.
  }

  const match = candidate.match(DOI_PATTERN);
  if (!match) return null;

  return match[0]
    .replace(/[\s>"']+$/g, "")
    .replace(/[.,;]+$/g, "")
    .toLowerCase();
}

function firstString(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const item = value.find((entry) => typeof entry === "string");
  return typeof item === "string" ? item : null;
}

function updateDate(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  if (typeof record["date-time"] === "string") {
    return record["date-time"];
  }

  const parts = record["date-parts"];
  if (
    Array.isArray(parts) &&
    Array.isArray(parts[0]) &&
    parts[0].every((part) => typeof part === "number")
  ) {
    const [year, month = 1, day = 1] = parts[0] as number[];
    return new Date(Date.UTC(year, month - 1, day)).toISOString();
  }

  return null;
}

function normalizeUpdate(value: unknown): CrossrefUpdate | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  const type =
    typeof record.type === "string"
      ? record.type.trim().toLowerCase()
      : "";
  if (!type) return null;

  return {
    doi:
      typeof record.DOI === "string"
        ? record.DOI.toLowerCase()
        : null,
    type,
    label:
      typeof record.label === "string"
        ? record.label
        : null,
    source:
      typeof record.source === "string"
        ? record.source
        : null,
    updatedAt: updateDate(record.updated),
  };
}

export async function verifyCrossrefStatus(
  value: string | null | undefined,
): Promise<CrossrefVerification> {
  const checkedAt = new Date().toISOString();
  const doi = extractDoi(value);
  const limitation =
    "Crossref/Retraction Watch is a strong registry signal for registered retractions, but absence of an update is not proof that no correction, expression of concern, or other publication change exists.";

  if (!doi) {
    return {
      applicable: false,
      doi: null,
      status: "NO_DOI",
      retracted: false,
      updates: [],
      title: null,
      publisher: null,
      containerTitle: null,
      workType: null,
      checkedAt,
      limitation,
      error: null,
    };
  }

  try {
    const endpoint =
      "https://api.crossref.org/works/" + encodeURIComponent(doi);
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Credify/0.1 (scholarly-integrity-check)",
      },
      cache: "no-store",
    });

    if (response.status === 404) {
      return {
        applicable: true,
        doi,
        status: "NOT_FOUND",
        retracted: false,
        updates: [],
        title: null,
        publisher: null,
        containerTitle: null,
        workType: null,
        checkedAt,
        limitation,
        error: null,
      };
    }

    if (!response.ok) {
      return {
        applicable: true,
        doi,
        status: "UNAVAILABLE",
        retracted: false,
        updates: [],
        title: null,
        publisher: null,
        containerTitle: null,
        workType: null,
        checkedAt,
        limitation,
        error:
          "Crossref returned HTTP " +
          response.status +
          " " +
          response.statusText,
      };
    }

    const body = (await response.json()) as {
      message?: Record<string, unknown>;
    };
    const message = body.message ?? {};

    const rawUpdates = [
      ...(Array.isArray(message["update-to"])
        ? (message["update-to"] as unknown[])
        : []),
      ...(Array.isArray(message["updated-by"])
        ? (message["updated-by"] as unknown[])
        : []),
    ];

    const updates = rawUpdates
      .map(normalizeUpdate)
      .filter((item): item is CrossrefUpdate => Boolean(item));

    return {
      applicable: true,
      doi,
      status: "VERIFIED",
      retracted: updates.some((update) => update.type === "retraction"),
      updates,
      title: firstString(message.title),
      publisher:
        typeof message.publisher === "string"
          ? message.publisher
          : null,
      containerTitle: firstString(message["container-title"]),
      workType:
        typeof message.type === "string"
          ? message.type
          : null,
      checkedAt,
      limitation,
      error: null,
    };
  } catch (error) {
    return {
      applicable: true,
      doi,
      status: "UNAVAILABLE",
      retracted: false,
      updates: [],
      title: null,
      publisher: null,
      containerTitle: null,
      workType: null,
      checkedAt,
      limitation,
      error:
        error instanceof Error
          ? error.message.slice(0, 1000)
          : "Crossref verification failed.",
    };
  }
}
