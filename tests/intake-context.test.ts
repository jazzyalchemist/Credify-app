import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const orchestratorPath = path.join(
  process.cwd(),
  "lib",
  "ai",
  "orchestrator.ts",
);

test("URL-bearing claim decomposition requires context recovery with web search", () => {
  const source = fs.readFileSync(orchestratorPath, "utf8");
  const start = source.indexOf("export async function startDecomposition");
  const end = source.indexOf("export async function startDiscovery");
  assert.ok(start >= 0 && end > start);

  const block = source.slice(start, end);
  assert.match(block, /type:\s*"web_search"/);
  assert.match(block, /search_context_size:\s*"high"/);
  assert.match(block, /inputContainsUrl\(investigation\.input_material\)/);
  assert.match(block, /\? "required"/);
  assert.match(block, /: "auto"/);
  assert.match(block, /web_search_call\.action\.sources/);
});

test("intake web context is logged but never admitted as evidence", () => {
  const source = fs.readFileSync(orchestratorPath, "utf8");
  const start = source.indexOf("async function processDecomposition");
  const end = source.indexOf("async function sourceForSelection");
  assert.ok(start >= 0 && end > start);

  const block = source.slice(start, end);
  assert.match(block, /OpenAI Responses web_search \/ Intake context/);
  assert.match(block, /not admitted evidence/i);
  assert.match(block, /intakeContextOnly:\s*true/);
  assert.doesNotMatch(block, /createSource\(/);
  assert.doesNotMatch(block, /linkClaimSource\(/);
});

test("intake prompt labels retrieved material as context rather than verified evidence", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "prompts.ts"),
    "utf8",
  );

  assert.match(source, /INTAKE CONTEXT only/);
  assert.match(source, /not admitted evidence/);
  assert.match(source, /independently rediscovered/);
});
