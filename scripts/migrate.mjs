import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });

try {
  await sql.unsafe(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
  );

  const migrationsDir = path.join(process.cwd(), "db", "migrations");
  const files = (await fs.readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const name of files) {
    const alreadyApplied = await sql`
      SELECT name FROM schema_migrations WHERE name = ${name} LIMIT 1
    `;

    if (alreadyApplied.length > 0) {
      console.log("skip", name);
      continue;
    }

    const migration = await fs.readFile(path.join(migrationsDir, name), "utf8");
    await sql.unsafe(migration);
    await sql`INSERT INTO schema_migrations (name) VALUES (${name})`;
    console.log("applied", name);
  }

  console.log("Credify database migrations complete.");
} finally {
  await sql.end();
}
