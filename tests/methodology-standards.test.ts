import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("source audit requires structured methodology standards selection", () => {
  const schema = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "schemas.ts"),
    "utf8",
  );

  assert.match(schema, /methodology_standards/);
  assert.match(schema, /source_domain/);
  assert.match(schema, /source_design/);
  assert.match(schema, /applicable_standards/);
  assert.match(schema, /intentionally_inapplicable_standards/);
  assert.match(schema, /standards_evidence_urls/);
});

test("standards evidence URLs are held to the same trusted web-source boundary", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
    "utf8",
  );

  assert.match(
    source,
    /\.\.\.output\.methodology_standards\.standards_evidence_urls/,
  );
  assert.match(source, /declaredEvidenceUrls/);
  assert.match(source, /trustedUrls/);
});

test("methodology prompt selects standards before scoring and rejects cross-discipline misuse", () => {
  const prompts = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "prompts.ts"),
    "utf8",
  );

  assert.match(prompts, /METHODOLOGICAL STANDARDS CONTRACT/);
  assert.match(prompts, /before judging methodological quality/i);
  assert.match(prompts, /Do NOT mechanically apply biomedical/i);
  assert.match(prompts, /intentionally_inapplicable_standards/);
});
