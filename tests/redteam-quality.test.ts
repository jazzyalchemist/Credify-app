import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("rival schema requires exact claim attack ledger and self-falsification", () => {
  const schema = fs.readFileSync(
    path.join(process.cwd(), "lib", "redteam", "schemas.ts"),
    "utf8",
  );

  assert.match(schema, /claim_reviews/);
  assert.match(schema, /SURVIVED_SCRUTINY/);
  assert.match(schema, /NOT_APPLICABLE_TO_ROLE/);
  assert.match(schema, /self_falsification_condition/);
  assert.match(schema, /evidence_strength/);
  assert.match(schema, /materiality/);
});

test("rival processor rejects incomplete or contradictory claim coverage", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "redteam", "orchestrator.ts"),
    "utf8",
  );

  assert.match(source, /Rival reviewer claim-coverage ledger failed/);
  assert.match(source, /missingClaimReviewIds/);
  assert.match(source, /duplicateClaimReviewIds/);
  assert.match(source, /without a structured challenge/);
  assert.match(source, /challenge ledger contradicts the claim-review outcome/);
});

test("rival prompt rewards calibrated valid defects rather than challenge volume", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "redteam", "prompts.ts"),
    "utf8",
  );

  assert.match(source, /calibrated error discovery, not challenge volume/i);
  assert.match(source, /Unsupported, duplicated, immaterial, or speculative challenges/);
  assert.match(source, /what evidence would falsify YOUR challenge/i);
  assert.match(source, /zero material challenges is valid only when/i);
});

test("review output preserves claim survival coverage for reconciliation audit", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "redteam", "orchestrator.ts"),
    "utf8",
  );

  assert.match(source, /claimReviews:\s*output\.claim_reviews/);
  assert.match(source, /survivedScrutinyCount/);
  assert.match(source, /evidenceStrength/);
  assert.match(source, /selfFalsificationCondition/);
});
