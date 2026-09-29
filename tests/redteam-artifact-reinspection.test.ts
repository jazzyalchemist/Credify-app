import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const orchestrator = fs.readFileSync(
  path.join(process.cwd(), "lib", "redteam", "orchestrator.ts"),
  "utf8",
);
const prompts = fs.readFileSync(
  path.join(process.cwd(), "lib", "redteam", "prompts.ts"),
  "utf8",
);

test("RedTeam verifies frozen artifact ledger before model handoff", () => {
  assert.match(orchestrator, /loadFrozenArtifactContext/);
  assert.match(orchestrator, /does not match the SHA-256 recorded in the frozen dossier/);
  assert.match(orchestrator, /frozenArtifactHashes/);
});

test("every rival receives original frozen artifact content", () => {
  const start = orchestrator.indexOf("export async function startRedTeam");
  const end = orchestrator.indexOf("export async function processRedTeamReviewResponse");
  const block = orchestrator.slice(start, end);

  assert.match(block, /artifactContext\.contentParts/);
  assert.match(block, /FROZEN ARTIFACT MAPPING/);
});

test("data-forensics rival must independently execute completed Python for tabular evidence", () => {
  assert.match(orchestrator, /DATA_FIGURE_FORENSICS/);
  assert.match(orchestrator, /type:\s*"code_interpreter"/);
  assert.match(orchestrator, /did not complete verifiable Python recomputation/);
  assert.match(orchestrator, /codeInterpreterUsage\.completedCallCount/);
  assert.match(orchestrator, /codeInterpreterUsage\.codePresentCallCount/);
});

test("blind reconciliation receives frozen artifacts and verifies reproduced data challenges", () => {
  const start = orchestrator.indexOf("export async function startReconciliation");
  const block = orchestrator.slice(start);

  assert.match(block, /artifactContext\.contentParts/);
  assert.match(block, /reproducedDataChallenges/);
  assert.match(block, /independent reproduction of a data-forensics challenge/);
  assert.match(block, /codeInterpreterUsage/);
});

test("adversarial prompts distinguish byte identity from authenticity and require reinspection", () => {
  assert.match(prompts, /byte identity with the frozen dossier/);
  assert.match(prompts, /independently inspect/);
  assert.match(prompts, /perform the reproduction with Python/);
});
