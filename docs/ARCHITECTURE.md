# Credify Architecture — v0.1

## Principle

Credify must **enforce** the credibility protocol rather than merely ask a model to remember it.

Canonical methodology lives in:

`jazzyalchemist/credibility-verification-engine`

Every investigation records the exact protocol release, commit, and resolved protocol snapshot used at creation time.

## Runtime layers

```text
Authenticated Web UI
  │
  ├── Investigation intake / mode selection
  ├── Claim + source workspace
  ├── Phase rail + gate controls
  ├── 100-point credibility matrices
  ├── AI research job console
  ├── Rival RedTeam + reconciliation
  ├── Versioned reports
  ├── Investigator / audit view
  ├── Runtime readiness
  └── Frozen-dossier export
  │
Next.js application / API
  │
  ├── Authentication + private-cache middleware
  ├── Protocol phase/gate service
  ├── Investigation / claim / source services
  ├── Evidence-chain + search-log services
  ├── Credibility scoring service
  ├── OpenAI Responses background-job orchestration
  ├── RedTeam orchestration
  ├── Reconciliation
  ├── Report generation / citation validation
  └── Canonical dossier hashing / integrity export
  │
Persistence
  │
  └── PostgreSQL / Netlify Database
       ├── investigations
       ├── claims / sources
       ├── claim-source edges / evidence chains
       ├── search + retrieval logs
       ├── credibility assessments
       ├── AI jobs
       ├── RedTeam reviews / challenges
       ├── reconciliations
       ├── reports
       └── audit events
  │
External research runtime
  │
  ├── OpenAI Responses API
  └── Responses web_search tool
```

## Artifact evidence layer

Credify supports first-class uploaded evidence in v0.1.

Supported investigation artifacts include PDF, PNG/JPEG/WebP/non-animated GIF,
text/Markdown/HTML/XML/JSON, CSV/TSV, Word/RTF, Excel, and PowerPoint.

Artifact flow:

1. client/server size and count limits are enforced;
2. known filename extensions determine the canonical stored MIME type;
3. formats with reliable magic bytes receive a binary signature sanity check;
4. SHA-256 is computed before persistence;
5. identical bytes within an investigation deduplicate by hash;
6. raw bytes are stored in Netlify Blobs;
7. the artifact row stores storage provenance, byte size, SHA-256, capture method,
   and bounded extracted metadata;
8. during IDENTIFICATION/SCREENING, the artifact receives a source-ledger identity;
9. model access reloads the stored bytes and re-verifies SHA-256 + byte size before
   attaching them to a Responses request;
10. artifact provenance is included in the canonical frozen dossier.

Image metadata is extracted server-side with the pinned `exifr` dependency for
supported JPEG/PNG inputs. Metadata is evidence, not proof: it can be missing,
stripped, edited, copied, or forged.

Tabular CSV/TSV/XLS/XLSX source audits receive a sandboxed Code Interpreter tool.
Credify requires a real `code_interpreter_call` before accepting quantitative
recalculation claims and separately requires web search for external provenance.

## Canonical methodology boundary

The application may translate protocol rules into software invariants, but it must never silently redefine the methodology.

Pinned v0.1 methodology:

- repository: `jazzyalchemist/credibility-verification-engine`
- release: `release/v0.1.0`
- commit: `24fb0c71968f630382ec8e2034cdfaf9f92c258f`

Runtime loading supports:

1. optional live retrieval from the private methodology repository when `PROTOCOL_GITHUB_TOKEN` is present;
2. an immutable bundled release fallback;
3. Git-blob SHA verification of every bundled canonical file;
4. fail-closed behavior if the pinned bytes cannot be verified.

Existing investigations retain their original protocol snapshot and are never silently migrated.

## Protocol state machine

```text
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

Transitions are sequential and server-enforced.

Important invariants include:

- phase skipping is rejected;
- phase-specific mutations are rejected outside their allowed phase;
- transitions are blocked while background jobs are active;
- required checkpoints must be complete before advancing;
- Page-1 evidence is immutable after dossier freeze;
- RedTeam cannot begin before the canonical frozen dossier exists;
- FINAL cannot be entered until all eight reviewer roles and reconciliation are complete.

## Page 1 research architecture

Page 1 is not one monolithic model call.

1. Claim decomposition
2. Evidence discovery with live web search
3. Source screening
4. Source-by-source credibility/provenance audit
5. Evidence-chain / information-origin mapping
6. First-pass synthesis
7. Pre-RedTeam report
8. Canonical dossier freeze

Web-grounded stages record exact search queries and accept model-proposed evidence URLs only when they can be matched to sources actually exposed by the web-search tool.

The model supplies dimension evidence/rationale, but Credify validates each dimension maximum and computes the 100-point total server-side.

## Information independence

Source count is not treated as evidence-chain count.

Each included source receives an information-origin assessment:

- `VERIFIED`
- `UNRESOLVED`
- `UNASSESSED`

Verified shared origins are collapsed into one evidence chain. An unresolved origin is preserved as uncertainty; Credify does not fabricate independence merely to satisfy a gate.

## Frozen dossier

The pre-RedTeam dossier is a versioned forensic artifact.

v0.1 snapshot format:

- `snapshotVersion: 2`
- SHA-256
- `credify-canonical-json-v1`
- recursively lexicographically sorted object keys
- explicitly ordered arrays

The frozen payload includes:

- protocol snapshot;
- investigation input/mode;
- claim and source ledgers;
- claim-source edges;
- evidence chains;
- raw source/claim credibility assessments;
- search logs;
- retrieval logs;
- uploaded artifact provenance and metadata snapshots;
- Page-1 AI job ledger;
- pre-freeze audit chronology;
- exact pre-RedTeam report and its own SHA-256.

Freeze uses compare-and-set semantics and is rejected while AI jobs are active.

The authenticated export endpoint recomputes the canonical SHA-256 before serving a dossier and refuses a mismatch.

## Page 2 adversarial architecture

Eight reviewer roles operate against the frozen Page-1 dossier:

- fact checker;
- methodology critic;
- provenance auditor;
- data / figure forensics;
- logical reasoning analyst;
- bias / framing detector;
- alternative-hypothesis generator;
- devil's advocate.

Reviewer roles are isolated at initial review. PostgreSQL enforces at most one live/completed reviewer record per investigation + role while preserving failed attempts for audit/retry.

Reviewer challenges are reconciled only after all eight roles complete.

Reconciliation must provide exact challenge and claim coverage. Evidence references must resolve to:

- the frozen dossier;
- validated reviewer evidence; or
- the reconciliation run's own web-search results.

## Background-job integrity

OpenAI Responses jobs are persisted in `ai_jobs`.

Safeguards include:

- active singleton-stage uniqueness in PostgreSQL;
- per-source audit uniqueness;
- one AI job per RedTeam reviewer record;
- one nonfailed reconciliation run;
- explicit POST required to process/persist completed model output;
- read-only GET job inspection;
- 10-minute local processing lease;
- visible failure instead of silent replay after a processing lease expires;
- cancellation of unowned OpenAI background responses when persistence loses a concurrency race.

## Report integrity

`PRE_REDTEAM` and `FINAL` reports are immutable versioned rows.

Each report records:

- structured content;
- Markdown content;
- model;
- source AI job;
- SHA-256.

Report prose cites source-ledger IDs such as `[SRC-...]`. Unknown source IDs fail report generation. In the UI, validated citations render as clickable source links.

A pre-RedTeam report that finishes after dossier freeze is rejected so the frozen adversarial input cannot be silently superseded.

## Security boundary

v0.1 is a private single-operator application.

Controls include:

- Netlify team SSO at the hosting layer during review;
- server-configured Credify access key;
- signed HttpOnly session cookie;
- internal-only post-login redirects;
- no-store caching on protected investigation/status responses;
- explicit cross-site mutation rejection;
- HSTS and browser permission restrictions;
- retrieved/submitted material treated as untrusted evidence, never operational instructions.

## Deployment / reproducibility

- Netlify is the hosted target.
- `@netlify/database` supplies hosted PostgreSQL.
- portable migrations remain available for non-Netlify deployments.
- every migration has a Netlify-native mirror.
- npm dependency resolution is locked and CI uses `npm ci`.
- CI must pass tests, strict TypeScript, and production build before publishing a `credify-tested-source` artifact.
