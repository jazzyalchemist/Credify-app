import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AIResearchPanel } from "@/components/AIResearchPanel";
import { AddClaimForm } from "@/components/AddClaimForm";
import { AddSourceForm } from "@/components/AddSourceForm";
import { ClaimAuditEditor } from "@/components/ClaimAuditEditor";
import { Metric } from "@/components/Metric";
import { PhaseRail } from "@/components/PhaseRail";
import { SourceAuditEditor } from "@/components/SourceAuditEditor";
import { WorkspaceControls } from "@/components/WorkspaceControls";
import { databaseConfigured } from "@/lib/db/client";
import { listAiJobs } from "@/lib/db/ai-jobs";
import {
  buildInvestigationState,
  getClaims,
  getInvestigation,
  getSources,
} from "@/lib/db/repository";
import type { InvestigationPhase } from "@/lib/protocol/types";

export const dynamic = "force-dynamic";

const PHASES: InvestigationPhase[] = [
  "INTAKE",
  "IDENTIFICATION",
  "SCREENING",
  "ELIGIBILITY",
  "ANALYSIS",
  "SYNTHESIS",
  "PRE_REDTEAM",
  "REDTEAM",
  "RECONCILIATION",
  "FINAL",
];

function confidence(value: string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function InvestigationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!databaseConfigured()) {
    return (
      <AppShell
        eyebrow="Configuration"
        title="Database connection required."
        subtitle="Set DATABASE_URL and run the migrations before opening persistent investigations."
      >
        <section className="setupCard">
          <code>npm run db:migrate</code>
        </section>
      </AppShell>
    );
  }

  const { id } = await params;
  const investigation = await getInvestigation(id);
  if (!investigation) notFound();

  const [claims, sources, state, aiJobs] = await Promise.all([
    getClaims(id),
    getSources(id),
    buildInvestigationState(id),
    listAiJobs(id),
  ]);

  const currentIndex = PHASES.indexOf(investigation.current_phase);
  const completed = PHASES.slice(0, Math.max(0, currentIndex));
  const frozen = Boolean(investigation.pre_redteam_frozen_at);

  return (
    <AppShell
      eyebrow={investigation.id}
      title={investigation.title}
      subtitle={
        investigation.investigation_mode +
        " investigation · Protocol v" +
        investigation.protocol_version
      }
    >
      <WorkspaceControls
        investigationId={id}
        currentPhase={investigation.current_phase}
        phaseCheckpoints={investigation.phase_checkpoints ?? {}}
        preRedTeamFrozen={frozen}
      />

      <section className="workspaceGrid">
        <aside className="railPanel">
          <div className="panelHeading">
            <p className="kicker">Protocol progress</p>
            {frozen ? (
              <span className="lockedBadge">Dossier frozen</span>
            ) : (
              <span className="activeBadge">Live</span>
            )}
          </div>
          <PhaseRail current={investigation.current_phase} completed={completed} />

          <div className="protocolSnapshot">
            <span>Protocol commit</span>
            <code>{investigation.protocol_commit.slice(0, 12)}</code>
            {investigation.pre_redteam_snapshot_hash ? (
              <>
                <span>Dossier SHA-256</span>
                <code>{investigation.pre_redteam_snapshot_hash.slice(0, 16)}…</code>
              </>
            ) : null}
          </div>
        </aside>

        <div className="workspaceMain">
          <AIResearchPanel
            investigationId={id}
            currentPhase={investigation.current_phase}
            jobs={aiJobs}
            frozen={frozen}
          />

          <section className="metricsGrid">
            <Metric label="Claims" value={String(state.claimCount)} note="Tracked" />
            <Metric label="Sources" value={String(state.sourceCount)} note="Included evidence" />
            <Metric
              label="Primary evidence"
              value={
                state.primaryEvidenceRecovered +
                " / " +
                state.primaryEvidenceRequired
              }
              note="Required claims"
              tone={
                state.primaryEvidenceRecovered >= state.primaryEvidenceRequired
                  ? "good"
                  : "warn"
              }
            />
            <Metric
              label="Provenance"
              value={state.provenanceComplete ? "Complete" : "Open"}
              note="Material sources"
              tone={state.provenanceComplete ? "good" : "warn"}
            />
            <Metric
              label="Conflicts"
              value={state.unresolvedMaterialConflict ? "Open" : "None"}
              note="Material"
              tone={state.unresolvedMaterialConflict ? "warn" : "good"}
            />
            <Metric
              label="Critical failure"
              value={state.criticalFailure ? "ACTIVE" : "None"}
              note="Override"
              tone={state.criticalFailure ? "danger" : "good"}
            />
          </section>

          <section className="panel originalInput">
            <div className="panelHeading">
              <div>
                <p className="kicker">Immutable starting point</p>
                <h2>Original submitted material</h2>
              </div>
            </div>
            <pre>{investigation.input_material}</pre>
          </section>

          <section className="panel">
            <div className="panelHeading">
              <div>
                <p className="kicker">Claim ledger</p>
                <h2>Discrete propositions</h2>
              </div>
              <span className="statusChip">{claims.length} claims</span>
            </div>

            {!frozen ? <AddClaimForm investigationId={id} /> : null}

            <div className="ledgerList">
              {claims.length === 0 ? (
                <p className="emptyInline">
                  Add at least one testable claim or research proposition to begin
                  identification.
                </p>
              ) : (
                claims.map((claim) => (
                  <article className="ledgerCard" key={claim.id}>
                    <div className="ledgerCardTop">
                      <div>
                        <span className="claimId">{claim.id}</span>
                        <h3>{claim.text}</h3>
                      </div>
                      <span className="statusChip">
                        {claim.claim_type.replaceAll("_", " ")}
                      </span>
                    </div>
                    <div className="ledgerMeta">
                      <span>First-pass: {claim.first_pass_status}</span>
                      <span>
                        Confidence:{" "}
                        {confidence(claim.first_pass_confidence) === null
                          ? "—"
                          : confidence(claim.first_pass_confidence) + "%"}
                      </span>
                    </div>
                    {!frozen ? (
                      <ClaimAuditEditor
                        investigationId={id}
                        claimId={claim.id}
                        initialStatus={claim.first_pass_status}
                        initialConfidence={confidence(claim.first_pass_confidence)}
                        requiresPrimary={claim.requires_primary_evidence}
                        primaryRecovered={claim.primary_evidence_recovered}
                        criticalFailure={claim.critical_failure}
                        unresolvedConflict={claim.unresolved_material_conflict}
                      />
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panelHeading">
              <div>
                <p className="kicker">Source ledger</p>
                <h2>Evidence and provenance</h2>
              </div>
              <span className="statusChip">{sources.length} sources</span>
            </div>

            {!frozen ? <AddSourceForm investigationId={id} /> : null}

            <div className="ledgerList">
              {sources.length === 0 ? (
                <p className="emptyInline">
                  No sources recorded yet. Identification should search broadly
                  before synthesis.
                </p>
              ) : (
                sources.map((source) => (
                  <article className="ledgerCard sourceLedgerCard" key={source.id}>
                    <div className="ledgerCardTop">
                      <div>
                        <span className="claimId">{source.id}</span>
                        <h3>{source.title}</h3>
                        {source.url_or_identifier ? (
                          <p className="sourceUrl">{source.url_or_identifier}</p>
                        ) : null}
                      </div>
                      <span className="statusChip">
                        {source.primary_or_secondary}
                      </span>
                    </div>
                    <div className="ledgerMeta">
                      <span>Screening: {source.screening_decision}</span>
                      <span>Retrieval: {source.retrieval_status}</span>
                      <span>Provenance: {source.provenance_status}</span>
                      <span>
                        Score:{" "}
                        {confidence(source.credibility_score) === null
                          ? "—"
                          : confidence(source.credibility_score) + "/100"}
                      </span>
                    </div>
                    {!frozen ? (
                      <SourceAuditEditor
                        investigationId={id}
                        sourceId={source.id}
                        retrievalStatus={source.retrieval_status}
                        provenanceStatus={source.provenance_status}
                        primaryOrSecondary={source.primary_or_secondary}
                        screeningDecision={source.screening_decision}
                        originId={source.information_origin_id}
                        credibilityScore={confidence(source.credibility_score)}
                      />
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
