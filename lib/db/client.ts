import { getConnectionString } from "@netlify/database";
import postgres from "postgres";

type SqlClient = ReturnType<typeof postgres>;

let client: SqlClient | null = null;

function resolveConnectionString(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.NETLIFY_DATABASE_URL) return process.env.NETLIFY_DATABASE_URL;

  try {
    const value = getConnectionString();
    return value || null;
  } catch {
    return null;
  }
}

export function db(): SqlClient {
  const url = resolveConnectionString();

  if (!url) {
    throw new Error(
      "No Postgres connection is configured. Set DATABASE_URL locally or deploy with Netlify Database.",
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
  return Boolean(resolveConnectionString());
}
