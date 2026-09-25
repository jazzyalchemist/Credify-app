import assert from "node:assert/strict";
import test from "node:test";

import { canEnterPhase } from "../lib/protocol/gates";
import { PROTOCOL } from "../lib/protocol/manifest";
import {
  CREDIBILITY_DIMENSIONS,
  CREDIBILITY_TOTAL,
} from "../lib/protocol/scoring";
import type { InvestigationState } from "../lib/protocol/types";

function state(
  overrides: Partial<InvestigationState> = {},
): InvestigationState {
  return {
    phase: "INTAKE",
    claimCount: 1,
    sourceCount: 1,
    primaryEvidenceRequired: 0,
    primaryEvidenceRecovered: 0,
    screeningComplete: true,
    retrievalOutcomesComplete: true,
    provenanceComplete: true,
    sourceIndependenceAssessed: true,
    claimSynthesisComplete: true,
    preRedTeamFrozen: true,
    redTeamCompleted: true,
    reconciliationCompleted: true,
    unresolvedMaterialConflict: false,
    criticalFailure: false,
    ...overrides,
  };
}

test("canonical protocol identity stays pinned", () => {
  assert.equal(PROTOCOL.version, "0.1.0");
  assert.equal(
    PROTOCOL.repository,
    "jazzyalchemist/credibility-verification-engine",
  );
  assert.equal(
    PROTOCOL.commit,
    "24fb0c71968f630382ec8e2034cdfaf9f92c258f",
  );
  assert.equal(PROTOCOL.rivalReviewerCount, 8);
});

test("credibility matrix sums to exactly 100", () => {
  const total = CREDIBILITY_DIMENSIONS.reduce(
    (sum, [, points]) => sum + points,
    0,
  );
  assert.equal(total, 100);
  assert.equal(CREDIBILITY_TOTAL, 100);
});

test("final phase is blocked without completed RedTeam", () => {
  const result = canEnterPhase(
    "FINAL",
    state({ redTeamCompleted: false }),
  );
  assert.equal(result.allowed, false);
  assert.match(result.blockers.join(" "), /RedTeam/);
});

test("final phase is blocked without reconciliation", () => {
  const result = canEnterPhase(
    "FINAL",
    state({ reconciliationCompleted: false }),
  );
  assert.equal(result.allowed, false);
  assert.match(result.blockers.join(" "), /reconciliation/);
});

test("missing required primary evidence produces a final warning", () => {
  const result = canEnterPhase(
    "FINAL",
    state({
      primaryEvidenceRequired: 2,
      primaryEvidenceRecovered: 1,
    }),
  );
  assert.equal(result.allowed, true);
  assert.match(result.warnings.join(" "), /primary evidence/i);
});

test("critical failure survives as an explicit final warning", () => {
  const result = canEnterPhase(
    "FINAL",
    state({ criticalFailure: true }),
  );
  assert.equal(result.allowed, true);
  assert.match(result.warnings.join(" "), /Critical-failure/i);
});

test("eligibility cannot begin before screening checkpoint", () => {
  const result = canEnterPhase(
    "ELIGIBILITY",
    state({ screeningComplete: false }),
  );
  assert.equal(result.allowed, false);
});

test("RedTeam cannot begin before dossier freeze", () => {
  const result = canEnterPhase(
    "REDTEAM",
    state({ preRedTeamFrozen: false }),
  );
  assert.equal(result.allowed, false);
});
