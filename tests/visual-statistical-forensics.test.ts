import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("media audits require structured visual statistical forensics", () => {
  const schema = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "schemas.ts"),
    "utf8",
  );

  assert.match(schema, /visual_statistical_forensics/);
  assert.match(schema, /axis_scale_findings/);
  assert.match(schema, /denominator_baseline_findings/);
  assert.match(schema, /time_window_category_selection_findings/);
  assert.match(schema, /visual_distortion_findings/);
  assert.match(schema, /underlying_data_recovered/);
});

test("visual-forensics prompt checks chart framing and unreadable figures", () => {
  const prompts = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "prompts.ts"),
    "utf8",
  );

  assert.match(prompts, /axis scales and truncation/i);
  assert.match(prompts, /percent versus percentage-point/i);
  assert.match(prompts, /time-window\/category selection/i);
  assert.match(prompts, /underlying data can be independently recovered/i);
  assert.match(prompts, /VISUAL_DATA_PRESENT_UNREADABLE/);
});

test("visual statistical forensics are part of the persisted media audit object", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
    "utf8",
  );

  assert.match(source, /visual_statistical_forensics/);
  assert.match(source, /mediaForensics:\s*output\.media_forensics/);
});
