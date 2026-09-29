import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("source audits require structured temporal verification", () => {
  const schema = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "schemas.ts"),
    "utf8",
  );

  assert.match(schema, /temporal_verification/);
  assert.match(schema, /source_publication_date_finding/);
  assert.match(schema, /source_last_update_finding/);
  assert.match(schema, /evidence_time_period_finding/);
  assert.match(schema, /HISTORICAL_ONLY/);
  assert.match(schema, /staleness_risk/);
});

test("claim synthesis requires temporal alignment", () => {
  const schema = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "schemas.ts"),
    "utf8",
  );

  assert.match(schema, /temporal_alignment/);
  assert.match(schema, /claim_time_scope_finding/);
  assert.match(schema, /evidence_time_scope_finding/);
  assert.match(schema, /MISALIGNED/);
});

test("temporally misaligned claims cannot be high-confidence conclusions", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
    "utf8",
  );

  assert.match(
    source,
    /temporal_alignment\.alignment === "MISALIGNED"/,
  );
  assert.match(
    source,
    /"VERIFIED", "HIGH_CONFIDENCE"/,
  );
  assert.match(
    source,
    /cannot mark a temporally misaligned claim/i,
  );
});

test("temporal audit distinguishes publication update evidence period and present applicability", () => {
  const prompts = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "prompts.ts"),
    "utf8",
  );

  assert.match(prompts, /TEMPORAL VERIFICATION CONTRACT/);
  assert.match(prompts, /publication date, last-update date, and the time period/i);
  assert.match(prompts, /historically valid but temporally insufficient/i);
});
