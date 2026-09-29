import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("database enforces one live RedTeam reviewer per investigation role", () => {
  const migration = fs.readFileSync(
    path.join(
      process.cwd(),
      "db",
      "migrations",
      "012_redteam_role_concurrency.sql",
    ),
    "utf8",
  );

  assert.match(
    migration,
    /UNIQUE INDEX[\s\S]*investigation_id,\s*reviewer_role/i,
  );
  assert.match(
    migration,
    /WHERE status IN \('PENDING', 'IN_PROGRESS', 'COMPLETED'\)/,
  );
});

test("review creation uses conflict-safe acquisition rather than duplicate insert", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "db", "redteam.ts"),
    "utf8",
  );
  assert.match(source, /ON CONFLICT DO NOTHING/);
  assert.match(source, /Promise<RedTeamReviewRecord \| null>/);
});

test("orphaned reviewer starts become explicit failed attempts", () => {
  const dbSource = fs.readFileSync(
    path.join(process.cwd(), "lib", "db", "redteam.ts"),
    "utf8",
  );
  const orchestrator = fs.readFileSync(
    path.join(process.cwd(), "lib", "redteam", "orchestrator.ts"),
    "utf8",
  );

  assert.match(dbSource, /failOrphanedRedTeamReviews/);
  assert.match(dbSource, /NOT EXISTS[\s\S]*ai_jobs/);
  assert.match(orchestrator, /REDTEAM_ORPHANED_STARTS_FAILED/);
});
