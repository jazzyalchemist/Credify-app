import { PROTOCOL } from "./manifest";

type CanonicalFileKey =
  | "MASTER_FULL"
  | "MASTER_EXECUTION"
  | "SWARM"
  | "RECONCILIATION"
  | "AI_SAFEGUARDS"
  | "ENGINE_SPEC"
  | "MATRIX";

const FILES: Record<
  CanonicalFileKey,
  { path: string; blobSha: string }
> = {
  MASTER_FULL: {
    path: "prompts/MASTER_PROMPT_FULL.md",
    blobSha: "853279d6e859d105c1711df0e09870096b6effd0",
  },
  MASTER_EXECUTION: {
    path: "prompts/MASTER_PROMPT.md",
    blobSha: "95a433ae6ca5ccfab2b7de7ba2c0a7ca57cd6943",
  },
  SWARM: {
    path: "prompts/RIVAL_AI_SWARM_ORCHESTRATOR.md",
    blobSha: "cb2985f1a9b3b95faf86409ad2cbc442552441de",
  },
  RECONCILIATION: {
    path: "prompts/RECONCILIATION_JUDGE_PROMPT.md",
    blobSha: "9a9146f7c9f996829d5c5522d450589d6e6e19c9",
  },
  AI_SAFEGUARDS: {
    path: "docs/10-AI-RESEARCH-SAFEGUARDS.md",
    blobSha: "ceda17e615a095ac45b9ecb80c2f84b3ecaf561f",
  },
  ENGINE_SPEC: {
    path: "spec/credibility-engine-v0.1.yaml",
    blobSha: "ce5a3349c939d5aedddb25ba4db437c05f00f101",
  },
  MATRIX: {
    path: "spec/credibility-matrix.json",
    blobSha: "4487aab07087d5829f2e4744464e3b2119d6f1b9",
  },
};

const cache = new Map<CanonicalFileKey, string>();

interface GitHubBlobResponse {
  sha: string;
  content: string;
  encoding: string;
}

function githubToken() {
  const token = process.env.PROTOCOL_GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "PROTOCOL_GITHUB_TOKEN is not configured. Credify refuses to run AI research without loading the exact pinned methodology.",
    );
  }
  return token;
}

async function loadFile(key: CanonicalFileKey): Promise<string> {
  const cached = cache.get(key);
  if (cached) return cached;

  const file = FILES[key];
  const url =
    "https://api.github.com/repos/" +
    PROTOCOL.repository +
    "/git/blobs/" +
    file.blobSha;

  const response = await fetch(url, {
    headers: {
      Authorization: "Bearer " + githubToken(),
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Credify/" + PROTOCOL.version,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      "Unable to load canonical protocol file " +
        file.path +
        " from the pinned methodology repository.",
    );
  }

  const body = (await response.json()) as GitHubBlobResponse;
  if (body.sha !== file.blobSha) {
    throw new Error(
      "Canonical protocol integrity failure for " +
        file.path +
        ": Git blob SHA did not match the pinned manifest.",
    );
  }
  if (body.encoding !== "base64") {
    throw new Error(
      "Unexpected GitHub encoding while loading canonical protocol file " +
        file.path +
        ".",
    );
  }

  const decoded = Buffer.from(
    body.content.replace(/\n/g, ""),
    "base64",
  ).toString("utf8");

  cache.set(key, decoded);
  return decoded;
}

function wrap(path: string, sha: string, content: string) {
  return [
    "----- BEGIN CANONICAL PROTOCOL FILE -----",
    "Repository: " + PROTOCOL.repository,
    "Protocol commit: " + PROTOCOL.commit,
    "Path: " + path,
    "Git blob SHA: " + sha,
    "",
    content,
    "",
    "----- END CANONICAL PROTOCOL FILE -----",
  ].join("\n");
}

async function loadWrapped(key: CanonicalFileKey) {
  const file = FILES[key];
  return wrap(file.path, file.blobSha, await loadFile(key));
}

export async function loadCanonicalInitialProtocol() {
  const parts = await Promise.all([
    loadWrapped("MASTER_FULL"),
    loadWrapped("MASTER_EXECUTION"),
    loadWrapped("AI_SAFEGUARDS"),
    loadWrapped("ENGINE_SPEC"),
    loadWrapped("MATRIX"),
  ]);
  return parts.join("\n\n");
}

export async function loadCanonicalRedTeamProtocol() {
  const parts = await Promise.all([
    loadWrapped("MASTER_FULL"),
    loadWrapped("AI_SAFEGUARDS"),
    loadWrapped("SWARM"),
    loadWrapped("ENGINE_SPEC"),
    loadWrapped("MATRIX"),
  ]);
  return parts.join("\n\n");
}

export async function loadCanonicalReconciliationProtocol() {
  const parts = await Promise.all([
    loadWrapped("MASTER_FULL"),
    loadWrapped("AI_SAFEGUARDS"),
    loadWrapped("RECONCILIATION"),
    loadWrapped("ENGINE_SPEC"),
    loadWrapped("MATRIX"),
  ]);
  return parts.join("\n\n");
}

export function canonicalProtocolManifest() {
  return {
    repository: PROTOCOL.repository,
    commit: PROTOCOL.commit,
    releaseRef: PROTOCOL.releaseRef,
    files: FILES,
  };
}
