export type CrossrefUpdate = {
  doi: string | null;
  type: string;
  label: string | null;
  source: string | null;
  updatedAt: string | null;
};

export type CrossrefAuthor = {
  given: string | null;
  family: string | null;
  name: string;
  orcid: string | null;
  affiliations: string[];
};

export type CrossrefFunder = {
  name: string;
  doi: string | null;
  awards: string[];
};

export type CrossrefVerification = {
  applicable: boolean;
  doi: string | null;
  status: "NO_DOI" | "VERIFIED" | "NOT_FOUND" | "UNAVAILABLE";
  retracted: boolean;
  updates: CrossrefUpdate[];
  title: string | null;
  publisher: string | null;
  containerTitle: string | null;
  workType: string | null;
  authors: CrossrefAuthor[];
  funders: CrossrefFunder[];
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

function normalizeAuthor(value: unknown): CrossrefAuthor | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  const given =
    typeof record.given === "string" && record.given.trim()
      ? record.given.trim()
      : null;
  const family =
    typeof record.family === "string" && record.family.trim()
      ? record.family.trim()
      : null;

  const name = [given, family].filter(Boolean).join(" ").trim();
  if (!name) return null;

  const rawOrcid =
    typeof record.ORCID === "string" && record.ORCID.trim()
      ? record.ORCID.trim()
      : null;
  const orcid = rawOrcid
    ? rawOrcid.replace(/^https?:\/\/orcid\.org\//i, "")
    : null;

  const affiliations = Array.isArray(record.affiliation)
    ? record.affiliation
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const affiliation = entry as Record<string, unknown>;
          return typeof affiliation.name === "string" &&
            affiliation.name.trim()
            ? affiliation.name.trim()
            : null;
        })
        .filter((item): item is string => Boolean(item))
    : [];

  return {
    given,
    family,
    name,
    orcid,
    affiliations: [...new Set(affiliations)],
  };
}

function normalizeFunder(value: unknown): CrossrefFunder | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  const name =
    typeof record.name === "string" && record.name.trim()
      ? record.name.trim()
      : null;
  if (!name) return null;

  const awards = Array.isArray(record.award)
    ? record.award
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  return {
    name,
    doi:
      typeof record.DOI === "string" && record.DOI.trim()
        ? record.DOI.trim().toLowerCase()
        : null,
    awards: [...new Set(awards)],
  };
}

function emptyVerification(
  checkedAt: string,
  limitation: string,
  overrides: Partial<CrossrefVerification>,
): CrossrefVerification {
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
    authors: [],
    funders: [],
    checkedAt,
    limitation,
    error: null,
    ...overrides,
  };
}

export async function verifyCrossrefStatus(
  value: string | null | undefined,
): Promise<CrossrefVerification> {
  const checkedAt = new Date().toISOString();
  const doi = extractDoi(value);
  const limitation =
    "Crossref/Retraction Watch is a strong registry signal for registered retractions and deposited publication metadata. Absence of an update, author identifier, affiliation, or funder is not proof that no correction, concern, identity detail, funding source, or conflict exists.";

  if (!doi) {
    return emptyVerification(checkedAt, limitation, {});
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
      return emptyVerification(checkedAt, limitation, {
        applicable: true,
        doi,
        status: "NOT_FOUND",
      });
    }

    if (!response.ok) {
      return emptyVerification(checkedAt, limitation, {
        applicable: true,
        doi,
        status: "UNAVAILABLE",
        error:
          "Crossref returned HTTP " +
          response.status +
          " " +
          response.statusText,
      });
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

    const authors = Array.isArray(message.author)
      ? message.author
          .map(normalizeAuthor)
          .filter((item): item is CrossrefAuthor => Boolean(item))
      : [];

    const funders = Array.isArray(message.funder)
      ? message.funder
          .map(normalizeFunder)
          .filter((item): item is CrossrefFunder => Boolean(item))
      : [];

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
      authors,
      funders,
      checkedAt,
      limitation,
      error: null,
    };
  } catch (error) {
    return emptyVerification(checkedAt, limitation, {
      applicable: true,
      doi,
      status: "UNAVAILABLE",
      error:
        error instanceof Error
          ? error.message.slice(0, 1000)
          : "Crossref verification failed.",
    });
  }
}
