import { createHash } from "crypto";
import { BUNDLED_PROTOCOL_FILES } from "./bundled-v0.1";
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

function gitBlobSha(content: string) {
  const body = Buffer.from(content, "utf8");
  const header = Buffer.from("blob " + body.length + "\0", "utf8");
  return createHash("sha1").update(header).update(body).digest("hex");
}

function verifyBundledFile(
  path: string,
  expectedSha: string,
): string {
  const content = BUNDLED_PROTOCOL_FILES[path];

  if (typeof content !== "string") {
    throw new Error(
      "Bundled canonical protocol file is missing: " + path + ".",
    );
  }

  const actualSha = gitBlobSha(content);
  if (actualSha !== expectedSha) {
    throw new Error(
      "Bundled canonical protocol integrity failure for " +
        path +
        ": computed Git blob SHA " +
        actualSha +
        " did not match pinned SHA " +
        expectedSha +
        ".",
    );
  }

  return content;
}

async function tryLoadLive(
  path: string,
  expectedSha: string,
): Promise<string | null> {
  const token = process.env.PROTOCOL_GITHUB_TOKEN;
  if (!token) return null;

  const url =
    "https://api.github.com/repos/" +
    PROTOCOL.repository +
    "/git/blobs/" +
    expectedSha;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Credify/" + PROTOCOL.version,
      },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const body = (await response.json()) as GitHubBlobResponse;
    if (body.sha !== expectedSha || body.encoding !== "base64") {
      return null;
    }

    const decoded = Buffer.from(
      body.content.replace(/\n/g, ""),
      "base64",
    ).toString("utf8");

    if (gitBlobSha(decoded) !== expectedSha) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

async function loadFile(key: CanonicalFileKey): Promise<string> {
  const cached = cache.get(key);
  if (cached) return cached;

  const file = FILES[key];
  const live = await tryLoadLive(file.path, file.blobSha);
  const content = live ?? verifyBundledFile(file.path, file.blobSha);

  cache.set(key, content);
  return content;
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
    liveRefreshOptional: true,
    bundledFallbackIntegrity: "git-blob-sha1",
    files: FILES,
  };
}
