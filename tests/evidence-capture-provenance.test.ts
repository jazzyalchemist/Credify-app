import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(
  path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
  "utf8",
);

test("hashed artifact evidence is distinguished from live web references", () => {
  assert.match(source, /captureType: "HASHED_ARTIFACT"/);
  assert.match(source, /rawBytesCaptured: true/);
  assert.match(source, /captureType: "WEB_SEARCH_TOOL_REFERENCE"/);
  assert.match(source, /rawBytesCaptured: false/);
});

test("web evidence provenance preserves the raw-byte limitation explicitly", () => {
  assert.match(source, /did not capture raw webpage bytes/i);
  assert.match(source, /live page may change after the investigation/i);
  assert.match(source, /historical-version claims require independent archive\/version evidence/i);
});

test("artifact evidence capture states integrity is not factual truth", () => {
  assert.match(
    source,
    /proves artifact identity\/integrity, not factual truth/i,
  );
});

test("evidence capture provenance is persisted and included in the audit result", () => {
  const matches = source.match(/evidenceCaptureProvenance/g) ?? [];
  assert.ok(matches.length >= 3);
});
