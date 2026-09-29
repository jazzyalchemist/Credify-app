import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("source audit requires evidence-backed independence fingerprints", () => {
  const schema = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "schemas.ts"),
    "utf8",
  );
  const prompt = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "prompts.ts"),
    "utf8",
  );

  assert.match(schema, /independence_fingerprint/);
  assert.match(schema, /wire_or_release/);
  assert.match(schema, /datasets/);
  assert.match(schema, /authors/);
  assert.match(schema, /institutions/);
  assert.match(schema, /funders/);
  assert.match(prompt, /Every non-empty dependency key must carry at least one evidence_urls entry/);
});

test("dependency evidence URLs are validated against trusted search/source URLs", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
    "utf8",
  );

  assert.match(source, /normalizeDependencyFingerprint/);
  assert.match(source, /dependency referenced URLs not returned by web search or the audited source/);
  assert.match(source, /independenceFingerprint:\s*validatedIndependenceFingerprint/);
});

test("evidence chains include overlapping shared dependency factors", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "db", "evidence.ts"),
    "utf8",
  );

  assert.match(source, /DEPENDENCY_SHARED_/);
  assert.match(source, /sharedWireOrRelease/);
  assert.match(source, /sharedDataset/);
  assert.match(source, /sharedAuthor/);
  assert.match(source, /sharedInstitution/);
  assert.match(source, /sharedFunder/);
  assert.match(source, /members\.length < 2/);
});

test("synthesis receives dependency chains and forbids URL-count independence", () => {
  const orchestrator = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
    "utf8",
  );
  const prompt = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "prompts.ts"),
    "utf8",
  );

  assert.match(orchestrator, /listEvidenceChains\(investigationId\)/);
  assert.match(prompt, /Evidence dependency \/ independence chains/);
  assert.match(prompt, /Do not count multiple downstream sources as independent corroboration/);
});
