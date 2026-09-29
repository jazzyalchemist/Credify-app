import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("source audits require structured framing and manipulation indicators", () => {
  const schema = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "schemas.ts"),
    "utf8",
  );

  assert.match(schema, /framing_manipulation_audit/);
  assert.match(schema, /LOADED_LANGUAGE/);
  assert.match(schema, /SELECTIVE_STATISTICS/);
  assert.match(schema, /MANUFACTURED_CONSENSUS/);
  assert.match(schema, /ASTROTURFING_SIGNAL/);
  assert.match(schema, /MISLEADING_HEADLINE/);
  assert.match(schema, /intent_evidence_status/);
  assert.match(schema, /truth_status_implication/);
});

test("framing indicator URLs use the trusted evidence boundary", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
    "utf8",
  );

  assert.match(source, /framingEvidenceUrls/);
  assert.match(source, /indicator\.evidence_urls/);
  assert.match(source, /declaredEvidenceUrls/);
});

test("server rejects unsupported intent and material-impact claims", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
    "utf8",
  );

  assert.match(source, /INTENT_EVIDENCE_PRESENT/);
  assert.match(source, /without any supporting evidence URL/);
  assert.match(source, /MATERIAL_EVIDENCE_IMPACT_IDENTIFIED/);
  assert.match(source, /without any MATERIAL or CRITICAL indicator/);
});

test("framing prompt treats indicators as scrutiny triggers rather than falsity or intent proof", () => {
  const prompts = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "prompts.ts"),
    "utf8",
  );

  assert.match(prompts, /FRAMING \/ MANIPULATION INDICATOR CONTRACT/);
  assert.match(prompts, /scrutiny triggers, not proof/i);
  assert.match(prompts, /Do not infer deceptive intent/i);
  assert.match(prompts, /political\/ideological orientation alone/i);
  assert.match(prompts, /False balance is also a framing error/i);
});
