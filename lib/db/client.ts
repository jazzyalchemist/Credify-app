import postgres from "postgres";

type SqlClient = ReturnType<typeof postgres>;

let client: SqlClient | null = null;

export function db(): SqlClient {
  const url = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;

  if (!url) {
    throw new Error(
      "No Postgres connection is configured. Set DATABASE_URL locally or use Netlify Database in deployment.",
    );
  }

  if (!client) {
    client = postgres(url, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }

  return client;
}

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL);
}
