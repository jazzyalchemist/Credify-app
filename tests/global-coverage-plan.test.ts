import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const orchestrator = fs.readFileSync(
  path.join(process.cwd(), "lib", "ai", "orchestrator.ts"),
  "utf8",
);

test("discovery loads the completed decomposition coverage plan", () => {
  const start = orchestrator.indexOf("export async function startDiscovery");
  const end = orchestrator.indexOf("async function processDecomposition");
  const block = orchestrator.slice(start, end);

  assert.match(block, /const priorJobs = await listAiJobs\(investigationId, 100\)/);
  assert.match(block, /searchStrategyFromDecompositionJobs\(priorJobs\)/);
  assert.match(block, /plannedSearchStrategy/);
  assert.match(block, /DECOMPOSITION_PLAN_AVAILABLE/);
});

test("discovery prompt consumes languages jurisdictions evidence streams and opposing queries", () => {
  const prompts = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "prompts.ts"),
    "utf8",
  );

  assert.match(prompts, /plannedSearchStrategy/);
  assert.match(prompts, /languages/);
  assert.match(prompts, /jurisdictions/);
  assert.match(prompts, /evidence streams/);
  assert.match(prompts, /opposing queries/);
  assert.match(prompts, /preserve that limitation in coverage_gaps/i);
});

test("applied discovery audit preserves planned coverage next to exact executed queries", () => {
  const start = orchestrator.indexOf("async function processDiscovery");
  const end = orchestrator.indexOf("export async function refreshAiJob");
  const block = orchestrator.slice(start, end);

  assert.match(block, /webQueries: queries/);
  assert.match(block, /plannedSearchStrategy/);
  assert.match(block, /coveragePlanStatus/);
  assert.match(block, /coverageGaps: output\.coverage_gaps/);
});
