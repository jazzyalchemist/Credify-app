import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const synthesis = fs.readFileSync(
  path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
  "utf8",
);

test("synthesis requires structured research saturation", () => {
  const schema = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "schemas.ts"),
    "utf8",
  );

  assert.match(schema, /research_saturation/);
  assert.match(schema, /CONVERGED/);
  assert.match(schema, /PROVISIONAL_STOP/);
  assert.match(schema, /CONTINUE_REQUIRED/);
  assert.match(schema, /MISSING_REQUIRED_PRIMARY_EVIDENCE/);
  assert.match(schema, /GLOBAL_OR_LINGUISTIC_COVERAGE_GAP/);
});

test("known material gaps cannot be silently labeled converged", () => {
  assert.match(synthesis, /unresolvedOriginExists/);
  assert.match(synthesis, /outputConflictExists/);
  assert.match(synthesis, /synthesizedPrimaryGaps/);
  assert.match(synthesis, /Research cannot be marked CONVERGED/);
  assert.match(synthesis, /Research saturation omitted a known reason to continue/);
});

test("synthesis prevalidates matrices confidence and saturation before first claim write", () => {
  const processStart = synthesis.indexOf(
    "export async function processSynthesisResponse",
  );
  const block = synthesis.slice(processStart);
  const prevalidate = block.indexOf("const preparedClaims =");
  const firstWrite = block.indexOf("await upsertCredibilityAssessment({");

  assert.ok(prevalidate >= 0);
  assert.ok(firstWrite > prevalidate);
  assert.match(block.slice(0, firstWrite), /validateFirstPassConfidence/);
  assert.match(block.slice(0, firstWrite), /validateAndTotalDimensionScores/);
});

test("research saturation is synthesis-only and frozen into the dossier", () => {
  const repository = fs.readFileSync(
    path.join(process.cwd(), "lib", "db", "repository.ts"),
    "utf8",
  );

  assert.match(repository, /setResearchSaturation/);
  assert.match(repository, /current_phase !== "SYNTHESIS"/);
  assert.match(repository, /researchSaturationStatus/);
  assert.match(repository, /researchSaturation:/);
});

test("reports preserve provisional-stop limitations instead of relabeling convergence", () => {
  const reports = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "reports.ts"),
    "utf8",
  );

  assert.match(reports, /research_saturation_status/);
  assert.match(reports, /research_saturation/);
  assert.match(reports, /Do not relabel PROVISIONAL_STOP as convergence/);
});
