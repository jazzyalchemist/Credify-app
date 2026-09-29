import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("database enforces active AI job concurrency by stage and source subject", () => {
  const migration = fs.readFileSync(
    path.join(
      process.cwd(),
      "db",
      "migrations",
      "014_ai_job_concurrency.sql",
    ),
    "utf8",
  );

  assert.match(migration, /one_active_singleton_ai_stage/);
  assert.match(migration, /one_active_source_audit_per_subject/);
  assert.match(migration, /one_job_per_redteam_review/);
  assert.match(
    migration,
    /'QUEUED', 'IN_PROGRESS', 'PROCESSING'/,
  );
});

test("generic background launch helper cancels unowned responses", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "job-launch.ts"),
    "utf8",
  );

  assert.match(source, /cancelBackgroundResponse\(input\.response\.id\)/);
  assert.match(source, /AI_JOB_PERSISTENCE_REJECTED/);
});

test("Page-1 and report launchers use persistence-safe background jobs", () => {
  for (const relative of [
    "lib/ai/orchestrator.ts",
    "lib/ai/page1-orchestrator.ts",
    "lib/ai/reports.ts",
    "lib/redteam/orchestrator.ts",
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), relative), "utf8");
    assert.match(
      source,
      /persistBackgroundJobOrCancel/,
      relative + " must use the safe background launch path",
    );
  }
});
