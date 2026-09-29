import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const pageOne = fs.readFileSync(
  path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
  "utf8",
);

test("screening defensively links uploaded artifacts into the source ledger", () => {
  const start = pageOne.indexOf("export async function startScreening");
  const end = pageOne.indexOf("export async function startSourceAudits");
  assert.ok(start >= 0 && end > start);

  const block = pageOne.slice(start, end);
  assert.match(block, /ensureArtifactSources\(investigationId\)/);
  assert.match(block, /ARTIFACT_SOURCES_ENSURED/);
});

test("screening receives only hash-verified uploaded artifact bytes", () => {
  const start = pageOne.indexOf("export async function startScreening");
  const end = pageOne.indexOf("export async function startSourceAudits");
  const block = pageOne.slice(start, end);

  assert.match(block, /loadVerifiedArtifactInputPart\(artifact\)/);
  assert.match(block, /UPLOADED ARTIFACT MAPPING/);
  assert.match(block, /artifact\.sha256/);
  assert.match(block, /artifactInputCount/);
});

test("screening prompt warns that hash validity is not credibility", () => {
  const prompts = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "prompts.ts"),
    "utf8",
  );

  const start = prompts.indexOf("export function screeningPrompt");
  const end = prompts.indexOf("export function sourceAuditPrompt");
  const block = prompts.slice(start, end);

  assert.match(block, /storage-integrity verification only/i);
  assert.match(block, /do not treat user submission or a valid hash/i);
});
