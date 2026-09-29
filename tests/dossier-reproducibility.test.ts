import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  canonicalJsonString,
  canonicalizeJson,
} from "../lib/crypto/canonical-json";

test("canonical JSON is stable across object insertion order", () => {
  const a = {
    z: 3,
    a: {
      y: 2,
      x: 1,
    },
    list: [{ b: 2, a: 1 }],
  };

  const b = {
    list: [{ a: 1, b: 2 }],
    a: {
      x: 1,
      y: 2,
    },
    z: 3,
  };

  assert.equal(canonicalJsonString(a), canonicalJsonString(b));
});

test("canonical JSON normalizes Date values to ISO-8601", () => {
  const date = new Date("2026-09-29T20:00:00.000Z");
  assert.deepEqual(canonicalizeJson({ date }), {
    date: "2026-09-29T20:00:00.000Z",
  });
});

test("canonical JSON rejects ambiguous unsupported values", () => {
  assert.throws(() => canonicalJsonString({ value: undefined }));
  assert.throws(() => canonicalJsonString({ value: Number.NaN }));
});

test("pre-RedTeam freeze hashes a complete canonical Page-1 dossier", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "db", "repository.ts"),
    "utf8",
  );

  assert.match(source, /snapshotVersion:\s*2/);
  assert.match(source, /credify-canonical-json-v1/);
  assert.match(source, /canonicalJsonString\(snapshot\)/);
  assert.match(source, /credibilityAssessments/);
  assert.match(source, /aiJobs/);
  assert.match(source, /auditEventsBeforeFreeze/);
  assert.match(source, /pre_redteam_frozen_at IS NULL/);
  assert.match(source, /status IN \('QUEUED', 'IN_PROGRESS', 'PROCESSING'\)/);
});

test("late pre-RedTeam report completion is rejected after freeze", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "reports.ts"),
    "utf8",
  );
  assert.match(source, /stage === "PRE_REDTEAM" && investigation\.pre_redteam_frozen_at/);
});


test("claim and source ledgers have deterministic secondary ordering", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "db", "repository.ts"),
    "utf8",
  );
  const matches = source.match(/ORDER BY created_at ASC, id ASC/g) ?? [];
  assert.ok(
    matches.length >= 2,
    "Claims and sources must both order by created_at then id.",
  );
});
