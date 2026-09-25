# Credify

Credify is the application layer for the **Adversarial Credibility Verification Engine**.

It turns the protocol in `jazzyalchemist/credibility-verification-engine` into an executable, auditable web application for investigating claims, articles, documents, images, datasets, organizations, and broader research questions.

## Architecture rule

The methodology repository remains the canonical source of truth.

Credify records the exact protocol version and commit used for every investigation. The app may implement protocol rules in software, but it must not silently redefine the methodology.

## Current status

**v0.1 foundation — active development**

Initial goals:

- protocol-aware investigation workflow;
- claim decomposition;
- source and evidence-chain tracking;
- credibility matrix;
- phase-gate enforcement;
- independent RedTeam review;
- reconciliation;
- final report and audit view;
- reproducibility metadata;
- AI research-security safeguards.

## Canonical protocol

Repository: `jazzyalchemist/credibility-verification-engine`

Frozen baseline: `release/v0.1.0`

The initial app build pins the protocol baseline until an explicit protocol migration is reviewed.
