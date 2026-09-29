import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("database permits only one nonfailed reconciliation job", () => {
  const migration = fs.readFileSync(
    path.join(
      process.cwd(),
      "db",
      "migrations",
      "013_reconciliation_concurrency.sql",
    ),
    "utf8",
  );

  assert.match(migration, /UNIQUE INDEX/i);
  assert.match(migration, /job_type = 'RECONCILIATION'/);
  assert.match(
    migration,
    /'QUEUED', 'IN_PROGRESS', 'PROCESSING', 'COMPLETED'/,
  );
});

test("orphaned reconciliation response is cancelled when job persistence is rejected", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "redteam", "orchestrator.ts"),
    "utf8",
  );

  assert.match(source, /cancelBackgroundResponse\(response\.id\)/);
  assert.match(source, /RECONCILIATION_JOB_PERSISTENCE_REJECTED/);
});

test("OpenAI wrapper exposes background response cancellation endpoint", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "openai.ts"),
    "utf8",
  );

  assert.match(source, /cancelBackgroundResponse/);
  assert.match(source, /\/responses\/.*\/cancel/);
});
