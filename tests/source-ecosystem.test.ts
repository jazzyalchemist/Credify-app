import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("source audits classify news fact-check and media-bias ecosystems explicitly", () => {
  const schema = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "schemas.ts"),
    "utf8",
  );

  assert.match(schema, /source_ecosystem_audit/);
  assert.match(schema, /"FACT_CHECK"/);
  assert.match(schema, /"MEDIA_BIAS_PLATFORM"/);
  assert.match(schema, /fact_check_audit/);
  assert.match(schema, /media_bias_platform_audit/);
});

test("fact-check and media-bias specialized audits are category-consistent", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
    "utf8",
  );

  assert.match(source, /FACT_CHECK_SOURCE/);
  assert.match(source, /MEDIA_BIAS_PLATFORM/);
  assert.match(source, /Non-fact-check source incorrectly claimed/);
  assert.match(source, /Non-media-bias source incorrectly claimed/);
});

test("source-ecosystem prompt treats external ratings as claims rather than authorities", () => {
  const prompts = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "prompts.ts"),
    "utf8",
  );

  assert.match(prompts, /SOURCE-ECOSYSTEM CONTRACT/);
  assert.match(prompts, /do not import the outlet's verdict/i);
  assert.match(prompts, /treat the rating as a claim about another outlet/i);
  assert.match(prompts, /wire copy, press-release rewrite/i);
});
