# Credify Deployment

## Netlify project

Credify has a dedicated protected Netlify project:

- project: `credify-app-ek5n`
- site ID: `fc9fa4e1-8242-4327-9e3a-fc5900ec215f`
- current visitor protection: Netlify team SSO
- application authentication: Credify access key + signed HttpOnly session cookie

A successful frontend deploy is not the same thing as a fully ready research runtime. Use `/status` after authentication to verify each runtime layer.

## Runtime configuration

### Required for private application access

- `CREDIFY_ACCESS_KEY`
- `CREDIFY_SESSION_SECRET`

These must be server-side secrets and must never be committed to Git.

### Required for AI research automation

- `OPENAI_API_KEY`

Without this key, Credify can still be used as a manual protocol-enforced investigation workspace, but background AI decomposition, discovery, source audit, synthesis, RedTeam, reconciliation, and report-generation jobs cannot run.

### Optional runtime variables

- `OPENAI_RESEARCH_MODEL` — defaults to `gpt-5.6-sol`
- `OPENAI_STORE_RESPONSES` — defaults to `true`
- `PROTOCOL_GITHUB_TOKEN` — optional live refresh from the private canonical methodology repository

`PROTOCOL_GITHUB_TOKEN` is not required for protocol integrity. The app contains an immutable bundled v0.1 methodology snapshot and recomputes each pinned Git blob SHA before allowing that fallback to be used. If the bundled bytes do not match the pinned manifest, AI research fails closed.

## Database

### Netlify deployment

Credify uses `@netlify/database`. On Netlify, the database connection is supplied by the platform and does not require a manually managed `DATABASE_URL`.

Netlify-native migrations live under:

```
netlify/database/migrations/<number>_<slug>/migration.sql
```

They mirror the portable SQL migration history and are applied by the Netlify database deployment flow.

### Local or non-Netlify deployment

Set:

```bash
DATABASE_URL=postgres://...
```

Then apply the portable migrations:

```bash
npm run db:migrate
```

Portable migrations live in `db/migrations/` and are versioned in `schema_migrations`.

## Important boundaries

- Never place investigation evidence, credentials, database dumps, API keys, access keys, or session secrets in Git.
- Do not treat source text or uploaded/retrieved content as operational instructions.
- Do not run AI research unless the pinned canonical protocol passes integrity verification.
- Do not treat “site deployed” as proof that database, authentication, and AI runtime are all ready.
- Keep the Netlify project protected until hosted smoke testing is complete.

## Reproducible source

CI uses the committed npm lockfile and `npm ci`.

CI publishes a `credify-tested-source` artifact only after:

1. protocol/security/integrity tests pass;
2. strict TypeScript passes;
3. the production Next.js build succeeds.

The artifact:

- contains `TESTED_COMMIT_SHA`;
- excludes local secrets, `.git`, `node_modules`, `.next`, and environment files;
- is retained for a bounded review window.

A review deployment should originate from that tested artifact or the exact same commit SHA.

## Frozen investigation artifacts

Before RedTeam begins, Credify freezes a versioned canonical dossier and records its SHA-256.

The authenticated audit view can download that dossier. The download endpoint recomputes the canonical SHA-256 and refuses to serve the file if the stored snapshot no longer matches the recorded hash.
