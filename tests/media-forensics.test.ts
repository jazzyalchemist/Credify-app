import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("source-audit schema requires structured media forensics", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "schemas.ts"),
    "utf8",
  );

  assert.match(source, /media_forensics/);
  assert.match(source, /visible_manipulation_indicators/);
  assert.match(source, /earliest_publication_finding/);
  assert.match(source, /geolocation_chronolocation_finding/);
  assert.match(source, /reverse_image_search_status/);
  assert.match(source, /NOT_AVAILABLE_IN_CURRENT_TOOLING/);
});

test("source-audit prompt forbids fake metadata and reverse-image claims", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "prompts.ts"),
    "utf8",
  );

  assert.match(source, /Do not claim EXIF/);
  assert.match(source, /does NOT perform native reverse-image matching/);
  assert.match(source, /earliest publication you can verify/);
  assert.match(source, /true original, which may remain unknown/);
});

test("structured media forensics survives into persisted assessment rationale", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
    "utf8",
  );

  assert.match(source, /mediaForensics:\s*output\.media_forensics/);
});
