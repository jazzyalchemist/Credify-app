# Credify Deployment

## Netlify project

Credify is deployed from the tested application source snapshot to a dedicated Netlify project.

The app requires server-side environment variables for the full private/persistent experience:

- `DATABASE_URL`
- `CREDIFY_ACCESS_KEY`
- `CREDIFY_SESSION_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_RESEARCH_MODEL`
- `OPENAI_STORE_RESPONSES`
- `PROTOCOL_GITHUB_TOKEN`

## Important boundaries

Do not place investigation evidence, credentials, database dumps, or secret values in Git.

Do not run AI research if the canonical protocol cannot be loaded and verified from the pinned methodology repository.

Do not treat a successful frontend deployment as proof that persistence or AI research is configured. Those capabilities require the runtime secrets above.

## Database

After setting `DATABASE_URL`, apply migrations:

```bash
npm run db:migrate
```

Migrations are versioned and recorded in `schema_migrations`.

## Reproducible source

CI publishes a `credify-tested-source` artifact only after protocol tests, strict TypeScript checking, and the production build succeed. The artifact contains `TESTED_COMMIT_SHA` and excludes local secrets, `.git`, `node_modules`, and `.next`.

A deployment intended for review should originate from that tested source snapshot or the exact same Git commit.
