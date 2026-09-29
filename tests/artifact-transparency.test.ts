import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const intake = fs.readFileSync(
  path.join(process.cwd(), "components", "NewInvestigationForm.tsx"),
  "utf8",
);
const artifactPanel = fs.readFileSync(
  path.join(process.cwd(), "components", "ArtifactPanel.tsx"),
  "utf8",
);

test("file intake discloses AI artifact and metadata processing", () => {
  assert.match(intake, /send integrity-verified artifact bytes/i);
  assert.match(intake, /device, time, or location information/i);
});

test("artifact workspace repeats the external AI processing boundary", () => {
  assert.match(artifactPanel, /configured OpenAI API/);
  assert.match(
    artifactPanel,
    /device,[\s\S]*timestamp,[\s\S]*location fields/i,
  );
});

test("UI does not advertise unsupported video ingestion", () => {
  assert.doesNotMatch(intake, /Image \/ video/);
  assert.match(intake, /Image \/ visual media/);
});
