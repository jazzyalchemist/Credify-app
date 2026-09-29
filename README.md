# Credify

Credify is the application layer for the **Adversarial Credibility Verification Engine**.

It turns the canonical protocol in `jazzyalchemist/credibility-verification-engine` into an executable, auditable web application for investigating claims, articles, documents, images, datasets, organizations, and broader research questions.

## Architecture rule

The methodology repository remains the canonical source of truth.

Credify records the exact protocol version and commit used for every investigation. Application code may enforce protocol rules, but it must not silently redefine the methodology.

## Current status

**v0.1 — protocol-enforced private research platform, pending hosted smoke test and human review**

Implemented end-to-end:

- investigation intake and claim decomposition;
- live evidence discovery with search provenance;
- source screening and retrieval/provenance state;
- information-origin and evidence-chain mapping;
- 12-dimension / 100-point credibility matrix;
- source-by-source audit and claim-level first-pass synthesis;
- versioned pre-RedTeam report;
- canonical frozen Page-1 dossier with SHA-256;
- eight-role independent rival RedTeam;
- structured challenge ledger;
- blind reconciliation and final claim state;
- versioned final report with validated clickable source-ledger citations;
- investigator/audit view;
- integrity-verified dossier export;
- private authentication and runtime-readiness view;
- deterministic CI, migration parity, and concurrency/security invariants.

## Protocol phases

```
INTAKE
→ IDENTIFICATION
→ SCREENING
→ ELIGIBILITY
→ ANALYSIS
→ SYNTHESIS
→ PRE_REDTEAM
→ REDTEAM
→ RECONCILIATION
→ FINAL
```

Phase transitions are server-enforced. The frozen Page-1 dossier is immutable after RedTeam begins.

## Canonical protocol

Repository: `jazzyalchemist/credibility-verification-engine`

Frozen baseline: `release/v0.1.0`

Pinned commit: `24fb0c71968f630382ec8e2034cdfaf9f92c258f`

The app supports an optional live refresh from the private methodology repository and an immutable bundled fallback. The fallback is accepted only after its Git blob hashes match the pinned manifest.

## Development

```bash
npm ci
npm test
npm run typecheck
npm run build
```

See:

- `docs/ARCHITECTURE.md`
- `docs/DATA-MODEL.md`
- `docs/DEPLOYMENT.md`
