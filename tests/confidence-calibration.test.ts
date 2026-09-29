import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  confidenceBand,
  validateFinalConfidence,
  validateFirstPassConfidence,
} from "../lib/protocol/confidence";

const strongFirstPass = {
  status: "VERIFIED" as const,
  confidence: 97,
  requiresPrimaryEvidence: false,
  primaryEvidenceRecovered: false,
  unresolvedMaterialConflict: false,
  criticalFailure: false,
  temporalAlignment: "ALIGNED" as const,
  credibilityMatrixScore: 96,
};

test("confidence bands preserve extraordinary-certainty distinction", () => {
  assert.equal(confidenceBand(99.9991), "EXTRAORDINARY");
  assert.equal(confidenceBand(99.5), "EXTREMELY_HIGH");
  assert.equal(confidenceBand(95), "VERY_HIGH");
  assert.equal(confidenceBand(90), "HIGH");
  assert.equal(confidenceBand(50), "UNCERTAIN");
});

test("first-pass status and numeric confidence must agree", () => {
  assert.doesNotThrow(() => validateFirstPassConfidence(strongFirstPass));

  assert.throws(() =>
    validateFirstPassConfidence({
      ...strongFirstPass,
      status: "UNKNOWN",
      confidence: 97,
    }),
  );

  assert.throws(() =>
    validateFirstPassConfidence({
      ...strongFirstPass,
      status: "CONTRADICTED",
      confidence: 80,
    }),
  );
});

test("unresolved conflict critical failure and missing required primary evidence cap confidence", () => {
  assert.throws(() =>
    validateFirstPassConfidence({
      ...strongFirstPass,
      confidence: 90,
      status: "HIGH_CONFIDENCE",
      unresolvedMaterialConflict: true,
    }),
  );

  assert.throws(() =>
    validateFirstPassConfidence({
      ...strongFirstPass,
      confidence: 90,
      status: "HIGH_CONFIDENCE",
      criticalFailure: true,
    }),
  );

  assert.throws(() =>
    validateFirstPassConfidence({
      ...strongFirstPass,
      confidence: 97,
      requiresPrimaryEvidence: true,
      primaryEvidenceRecovered: false,
    }),
  );
});

test("extraordinary first-pass confidence requires extraordinary evidence conditions", () => {
  assert.doesNotThrow(() =>
    validateFirstPassConfidence({
      ...strongFirstPass,
      confidence: 99.9995,
      credibilityMatrixScore: 98,
    }),
  );

  assert.throws(() =>
    validateFirstPassConfidence({
      ...strongFirstPass,
      confidence: 99.9995,
      credibilityMatrixScore: 94,
    }),
  );
});

test("final confidence is confidence in reconciled wording and unresolved issues cap it", () => {
  assert.doesNotThrow(() =>
    validateFinalConfidence({
      status: "DISPROVEN",
      confidence: 98,
      unresolvedChallengeCount: 0,
      investigationCriticalFailureCount: 0,
      finalMatrixScore: 97,
    }),
  );

  assert.throws(() =>
    validateFinalConfidence({
      status: "UNCERTAIN",
      confidence: 80,
      unresolvedChallengeCount: 0,
      investigationCriticalFailureCount: 0,
      finalMatrixScore: 90,
    }),
  );

  assert.throws(() =>
    validateFinalConfidence({
      status: "MODIFIED",
      confidence: 90,
      unresolvedChallengeCount: 1,
      investigationCriticalFailureCount: 0,
      finalMatrixScore: 95,
    }),
  );
});

test("both synthesis and reconciliation call centralized confidence validators", () => {
  const synthesis = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
    "utf8",
  );
  const reconciliation = fs.readFileSync(
    path.join(process.cwd(), "lib", "redteam", "orchestrator.ts"),
    "utf8",
  );

  assert.match(synthesis, /validateFirstPassConfidence/);
  assert.match(reconciliation, /validateFinalConfidence/);
  assert.match(reconciliation, /CONFIDENCE_OVERSTATEMENT/);
});
