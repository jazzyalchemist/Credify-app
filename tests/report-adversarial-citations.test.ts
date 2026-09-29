import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const reports = fs.readFileSync(
  path.join(process.cwd(), "lib", "ai", "reports.ts"),
  "utf8",
);

test("report validator recognizes source challenge and reconciliation IDs", () => {
  assert.match(reports, /\(\?:SRC\|CHL\|REC\)/);
  assert.match(reports, /Pre-RedTeam report cited Page-2 records/);
  assert.match(reports, /Final report contains adversarial review history but no validated/);
});

test("final report prompt defines challenge and reconciliation citation semantics", () => {
  assert.match(reports, /FINAL may additionally cite \[CHL-\.\.\.\]/);
  assert.match(reports, /A rejected challenge is not supporting evidence/);
  assert.match(reports, /\[REC-\.\.\.\] adjudication/);
});

test("Markdown export includes server-generated adversarial ledger", () => {
  assert.match(reports, /renderAdversarialAppendix/);
  assert.match(reports, /## Adversarial Ledger/);
  assert.match(reports, /generated from Credify's validated Page-2 records/);
});

test("interactive report citations resolve Page-2 records to audit anchors", () => {
  const component = fs.readFileSync(
    path.join(process.cwd(), "components", "CitedReportText.tsx"),
    "utf8",
  );
  const audit = fs.readFileSync(
    path.join(
      process.cwd(),
      "app",
      "investigations",
      "[id]",
      "audit",
      "page.tsx",
    ),
    "utf8",
  );

  assert.match(component, /challengeCitation/);
  assert.match(component, /reconciliationCitation/);
  assert.match(component, /audit#challenges/);
  assert.match(component, /audit#reconciliation/);
  assert.match(audit, /id="challenges"/);
  assert.match(audit, /id="reconciliation"/);
});
