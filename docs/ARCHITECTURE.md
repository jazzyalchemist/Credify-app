# Credify Architecture

## Principle

The application must **enforce** the credibility protocol rather than merely ask an AI to remember it.

Canonical methodology lives in:

`jazzyalchemist/credibility-verification-engine`

The app records a pinned protocol release and commit for every investigation.

## Initial application layers

```text
Web UI
  │
  ├── Intake / investigation mode
  ├── Claim board
  ├── Evidence / provenance explorer
  ├── Credibility matrix
  ├── Rival-AI console
  ├── Reconciliation
  └── Final + audit views
  │
Application API
  │
  ├── Protocol gate service
  ├── Investigation service
  ├── Claim service
  ├── Evidence service
  ├── Research orchestrator
  ├── RedTeam orchestrator
  └── Reconciliation service
  │
Persistence
  │
  ├── PostgreSQL: investigations, claims, sources, evidence edges, scores, challenges
  └── Object storage: uploaded files, archived evidence, datasets, generated reports
```

## Protocol boundary

The app may implement protocol rules in code, but must never silently redefine the canonical methodology.

A future protocol sync layer should:

1. fetch a specific release/commit from the methodology repository;
2. verify its integrity;
3. translate machine-readable rules into runtime configuration;
4. store the resolved protocol snapshot on the investigation;
5. refuse silent migrations of existing investigations.

## Server-side enforcement

Examples of rules that belong in application logic:

- block a final report until RedTeam and reconciliation complete;
- prevent a claim from receiving a high verification status if required primary evidence is missing;
- collapse multiple URLs that share one information origin;
- apply critical-failure overrides before aggregate scoring;
- constrain confidence when a material contradiction remains unresolved;
- preserve first-pass wording/confidence before adversarial review;
- prevent retrieved source content from changing protocol/tool instructions.

## v0.1 scope

The current foundation contains:

- protocol metadata pinning;
- typed investigation phases;
- server-side gate evaluation endpoint;
- credibility matrix definitions;
- AI research-security rules;
- initial investigation UI;
- demo claim/provenance/RedTeam workspace.

Database persistence, authentication, live research tools, uploads, and real model orchestration are intentionally subsequent milestones.
