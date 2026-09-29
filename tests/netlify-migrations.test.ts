import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.join(process.cwd(), "netlify", "database", "migrations");

test("Netlify database migrations use the required number_slug directory shape", () => {
  const directories = fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.ok(directories.length >= 11);

  for (const directory of directories) {
    assert.match(
      directory,
      /^\d+_[a-z0-9-]+$/,
      directory + " does not match <number>_<slug>",
    );
    assert.ok(
      fs.existsSync(path.join(ROOT, directory, "migration.sql")),
      directory + " is missing migration.sql",
    );
  }
});

test("Netlify mirror has the same migration count as the portable SQL history", () => {
  const netlifyCount = fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).length;

  const portableCount = fs
    .readdirSync(path.join(process.cwd(), "db", "migrations"))
    .filter((name) => name.endsWith(".sql")).length;

  assert.equal(netlifyCount, portableCount);
});
