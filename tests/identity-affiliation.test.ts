import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("source audits require structured author and affiliation verification", () => {
  const schema = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "schemas.ts"),
    "utf8",
  );

  assert.match(schema, /identity_affiliation_audit/);
  assert.match(schema, /verified_credentials/);
  assert.match(schema, /unverified_credentials/);
  assert.match(schema, /verified_affiliations/);
  assert.match(schema, /registry_identifiers/);
  assert.match(schema, /ownership_governance_finding/);
  assert.match(schema, /funding_relationships_finding/);
});

test("identity and affiliation evidence URLs use the trusted web boundary", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
    "utf8",
  );

  assert.match(source, /identityEvidenceUrls/);
  assert.match(source, /author\.evidence_urls/);
  assert.match(source, /institution\.evidence_urls/);
  assert.match(source, /declaredEvidenceUrls/);
});

test("identity prompt separates verified from claimed credentials and avoids prestige shortcuts", () => {
  const prompts = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "prompts.ts"),
    "utf8",
  );

  assert.match(prompts, /IDENTITY \/ AFFILIATION VERIFICATION CONTRACT/);
  assert.match(prompts, /claimed credentials from credentials you can independently verify/i);
  assert.match(prompts, /do not invent identifiers/i);
  assert.match(prompts, /Prestige is not a substitute for expertise/i);
  assert.match(prompts, /affiliation or funding is not automatic evidence/i);
});
