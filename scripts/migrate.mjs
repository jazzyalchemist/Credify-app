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
  const migrationPath = path.join(
    process.cwd(),
    "db",
    "migrations",
    "001_initial.sql",
  );
  const migration = await fs.readFile(migrationPath, "utf8");
  await sql.unsafe(migration);
  console.log("Credify migration 001_initial.sql applied successfully.");
} finally {
  await sql.end();
}
