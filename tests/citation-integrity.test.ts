import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("source audit requires structured citation-level verification", () => {
  const schema = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "schemas.ts"),
    "utf8",
  );

  assert.match(schema, /citation_audit/);
  assert.match(schema, /citations_examined/);
  assert.match(schema, /proposition_at_issue/);
  assert.match(schema, /PARTIAL_SUPPORT/);
  assert.match(schema, /DOES_NOT_SUPPORT/);
  assert.match(schema, /citation_laundering_or_circularity/);
  assert.match(schema, /missing_primary_source_concerns/);
});

test("citation verification URLs must come from trusted web evidence", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
    "utf8",
  );

  assert.match(source, /citationEvidenceUrls/);
  assert.match(source, /citation\.evidence_urls/);
  assert.match(source, /declaredEvidenceUrls/);
  assert.match(source, /trustedUrls/);
});

test("citation prompt checks proposition support primary recovery quote drift and circularity", () => {
  const prompts = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "prompts.ts"),
    "utf8",
  );

  assert.match(prompts, /CITATION-INTEGRITY CONTRACT/);
  assert.match(prompts, /exact proposition being supported/i);
  assert.match(prompts, /recover the primary source/i);
  assert.match(prompts, /quote drift/i);
  assert.match(prompts, /citation laundering/i);
  assert.match(prompts, /CITATIONS_NOT_ACCESSIBLE/);
});
