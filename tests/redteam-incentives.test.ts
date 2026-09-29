import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { REDTEAM_ROLES } from "../lib/redteam/roles";

test("exactly eight rival reviewer incentive profiles exist", () => {
  assert.equal(REDTEAM_ROLES.length, 8);
  assert.equal(new Set(REDTEAM_ROLES.map((role) => role.key)).size, 8);
});

test("every rival role has a nonempty reward penalty and self-falsification target", () => {
  for (const role of REDTEAM_ROLES) {
    assert.ok(role.rewardTarget.trim().length > 30, role.key + " reward is too thin");
    assert.ok(
      role.falsePositivePenalty.trim().length > 30,
      role.key + " false-positive penalty is too thin",
    );
    assert.ok(
      role.selfFalsificationPriority.trim().length > 30,
      role.key + " self-falsification priority is too thin",
    );
  }
});

test("rival roles do not share identical incentive profiles", () => {
  const rewardTargets = REDTEAM_ROLES.map((role) => role.rewardTarget);
  const penalties = REDTEAM_ROLES.map((role) => role.falsePositivePenalty);
  const falsifiers = REDTEAM_ROLES.map((role) => role.selfFalsificationPriority);

  assert.equal(new Set(rewardTargets).size, REDTEAM_ROLES.length);
  assert.equal(new Set(penalties).size, REDTEAM_ROLES.length);
  assert.equal(new Set(falsifiers).size, REDTEAM_ROLES.length);
});

test("role-specific incentives are injected and persisted in the reviewer job", () => {
  const prompts = fs.readFileSync(
    path.join(process.cwd(), "lib", "redteam", "prompts.ts"),
    "utf8",
  );
  const orchestrator = fs.readFileSync(
    path.join(process.cwd(), "lib", "redteam", "orchestrator.ts"),
    "utf8",
  );

  assert.match(prompts, /ROLE-SPECIFIC RIVAL INCENTIVE/);
  assert.match(prompts, /Reward target:/);
  assert.match(prompts, /False-positive penalty:/);
  assert.match(prompts, /Required self-falsification priority:/);

  assert.match(orchestrator, /incentiveProfile/);
  assert.match(orchestrator, /rewardTarget: role\.rewardTarget/);
  assert.match(orchestrator, /falsePositivePenalty: role\.falsePositivePenalty/);
  assert.match(orchestrator, /selfFalsificationPriority: role\.selfFalsificationPriority/);
});

test("UI claims reviewer-instance independence without claiming provider diversity", () => {
  const panel = fs.readFileSync(
    path.join(process.cwd(), "components", "RedTeamPanel.tsx"),
    "utf8",
  );

  assert.match(panel, /Agreement among reviewer instances is not/);
  assert.match(panel, /model\/provider diversity is not assumed/);
  assert.match(panel, /Rival incentive lens/);
});
