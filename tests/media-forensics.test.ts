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


test("media applicability and metadata availability are derived from artifact facts", () => {
  const content = fs.readFileSync(
    path.join(process.cwd(), "lib", "artifacts", "content.ts"),
    "utf8",
  );
  const orchestrator = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
    "utf8",
  );

  assert.match(content, /artifactMediaApplicability/);
  assert.match(content, /artifactMetadataStatus/);
  assert.match(orchestrator, /Media-forensics applicability did not match/);
  assert.match(orchestrator, /claimed metadata availability/);
  assert.match(orchestrator, /metadataStatusFromArtifact/);
});

test("reports must preserve native reverse-image tooling limitation", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "reports.ts"),
    "utf8",
  );

  assert.match(source, /Credify's native tooling does not/);
  assert.match(source, /TEXTUAL_CORROBORATION_ONLY/);
  assert.match(source, /valid file hash establishes byte identity\/integrity/);
});
