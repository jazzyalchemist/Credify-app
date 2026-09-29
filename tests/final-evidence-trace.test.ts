import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("final claim schema requires challenge and evidence lineage", () => {
  const schema = fs.readFileSync(
    path.join(process.cwd(), "lib", "redteam", "schemas.ts"),
    "utf8",
  );

  assert.match(schema, /driving_challenge_ids/);
  assert.match(schema, /surviving_evidence_refs/);
  assert.match(schema, /unresolved_challenge_ids/);
  assert.match(schema, /change_summary/);
});

test("reconciliation validates final trace against claim-owned challenges", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "redteam", "orchestrator.ts"),
    "utf8",
  );

  assert.match(source, /challenge\.claim_id !== finalClaim\.claim_id/);
  assert.match(source, /UNRESOLVED_CONFLICT adjudication/);
  assert.match(source, /modified final claim must identify a driving challenge or surviving evidence reference/i);
  assert.match(source, /finalClaim\.surviving_evidence_refs/);
});

test("final evidence trace is persisted on the claim", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "db", "redteam.ts"),
    "utf8",
  );

  assert.match(source, /final_evidence_trace/);
  assert.match(source, /drivingChallengeIds/);
  assert.match(source, /survivingEvidenceRefs/);
  assert.match(source, /unresolvedChallengeIds/);
});

test("workspace exposes post-RedTeam evidence lineage", () => {
  const page = fs.readFileSync(
    path.join(process.cwd(), "app", "investigations", "[id]", "page.tsx"),
    "utf8",
  );
  const component = fs.readFileSync(
    path.join(process.cwd(), "components", "FinalEvidenceTrace.tsx"),
    "utf8",
  );

  assert.match(page, /FinalEvidenceTrace/);
  assert.match(page, /claim\.final_evidence_trace/);
  assert.match(component, /Why this changed · evidence lineage/);
});
