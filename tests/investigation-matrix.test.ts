import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("Page-1 synthesis requires and persists an investigation-level matrix", () => {
  const schema = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "schemas.ts"),
    "utf8",
  );
  const orchestrator = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
    "utf8",
  );

  assert.match(schema, /investigation_dimension_scores/);
  assert.match(schema, /investigation_critical_failures/);
  assert.match(orchestrator, /subjectType:\s*"INVESTIGATION"/);
  assert.match(orchestrator, /stage:\s*"FIRST_PASS"/);
  assert.match(orchestrator, /investigationMatrix/);
});

test("blind reconciliation produces a distinct final investigation matrix", () => {
  const schema = fs.readFileSync(
    path.join(process.cwd(), "lib", "redteam", "schemas.ts"),
    "utf8",
  );
  const orchestrator = fs.readFileSync(
    path.join(process.cwd(), "lib", "redteam", "orchestrator.ts"),
    "utf8",
  );

  assert.match(schema, /investigation_dimension_scores/);
  assert.match(orchestrator, /subjectType:\s*"INVESTIGATION"/);
  assert.match(orchestrator, /stage:\s*"FINAL"/);
  assert.match(orchestrator, /finalInvestigationScore/);
});

test("overall matrix prompts prohibit arithmetic averaging and reviewer voting", () => {
  const synthesis = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "prompts.ts"),
    "utf8",
  );
  const reconciliation = fs.readFileSync(
    path.join(process.cwd(), "lib", "redteam", "prompts.ts"),
    "utf8",
  );
  const reports = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "reports.ts"),
    "utf8",
  );

  assert.match(synthesis, /NOT an average of source or claim scores/);
  assert.match(reconciliation, /not an average of reviewers, sources, claim/);
  assert.match(reports, /Never invent or recompute an overall score/);
  assert.match(reports, /FIRST_PASS investigation assessment/);
  assert.match(reports, /FINAL investigation assessment/);
});
