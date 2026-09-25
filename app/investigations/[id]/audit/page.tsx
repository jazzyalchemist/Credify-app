import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CredibilityAssessmentCard } from "@/components/CredibilityAssessmentCard";
import { listAiJobs } from "@/lib/db/ai-jobs";
import { listCredibilityAssessments } from "@/lib/db/credibility";
import {
  listClaimSourceEdges,
  listEvidenceChains,
} from "@/lib/db/evidence";
import {
  getClaims,
  getInvestigation,
  getSources,
  listAuditEvents,
  listRetrievalLogs,
  listSearchLogs,
} from "@/lib/db/repository";
import {
  listChallenges,
  listReconciliations,
  listRedTeamReviews,
} from "@/lib/db/redteam";

export const dynamic = "force-dynamic";

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const investigation = await getInvestigation(id);
  if (!investigation) notFound();

  const [
    claims,
    sources,
    edges,
    chains,
    assessments,
    searches,
    retrievals,
    jobs,
    reviews,
    challenges,
    reconciliations,
    auditEvents,
  ] = await Promise.all([
    getClaims(id),
    getSources(id),
    listClaimSourceEdges(id),
    listEvidenceChains(id),
    listCredibilityAssessments(id),
    listSearchLogs(id),
    listRetrievalLogs(id),
    listAiJobs(id, 100),
    listRedTeamReviews(id),
    listChallenges(id),
    listReconciliations(id),
    listAuditEvents(id),
  ]);

  return (
    <AppShell
      eyebrow={investigation.id + " · audit"}
      title="Investigator / audit view"
      subtitle="The evidence trail behind the conclusion: protocol version, source provenance, searches, scoring, AI operations, adversarial challenges, and reconciliation."
    >
      <div className="auditToolbar">
        <Link
          className="ghostButton"
          href={"/investigations/" + encodeURIComponent(id)}
        >
          ← Back to investigation
        </Link>
        <div>
          <span>Protocol commit</span>
          <code>{investigation.protocol_commit}</code>
        </div>
        <div>
          <span>Frozen dossier SHA-256</span>
          <code>{investigation.pre_redteam_snapshot_hash ?? "Not frozen"}</code>
        </div>
      </div>

      <section className="auditGrid">
        <article className="panel auditSummaryPanel">
          <p className="kicker">Inventory</p>
          <div className="auditCounts">
            <div><strong>{claims.length}</strong><span>claims</span></div>
            <div><strong>{sources.length}</strong><span>sources</span></div>
            <div><strong>{edges.length}</strong><span>claim-source edges</span></div>
            <div><strong>{assessments.length}</strong><span>matrices</span></div>
            <div><strong>{searches.length}</strong><span>search records</span></div>
            <div><strong>{reviews.length}</strong><span>rival reviews</span></div>
            <div><strong>{challenges.length}</strong><span>challenges</span></div>
            <div><strong>{reconciliations.length}</strong><span>adjudications</span></div>
          </div>
        </article>

        <article className="panel">
          <p className="kicker">Protocol snapshot</p>
          <pre className="auditJson">{pretty(investigation.protocol_snapshot)}</pre>
        </article>
      </section>

      <section className="auditSection">
        <div className="sectionTitle">
          <p className="kicker">Credibility matrices</p>
          <h2>Per-source and per-claim scoring</h2>
        </div>
        {assessments.length ? (
          <div className="matrixGrid">
            {assessments.map((assessment) => (
              <CredibilityAssessmentCard
                key={assessment.id}
                assessment={assessment}
              />
            ))}
          </div>
        ) : (
          <p className="emptyInline">No matrix assessments recorded yet.</p>
        )}
      </section>

      <section className="auditSection">
        <div className="sectionTitle">
          <p className="kicker">Evidence graph</p>
          <h2>Claim ↔ source relationships</h2>
        </div>
        <pre className="auditJson">{pretty(edges)}</pre>
        {chains.length ? (
          <>
            <h3 className="auditSubhead">Information-origin chains</h3>
            <pre className="auditJson">{pretty(chains)}</pre>
          </>
        ) : null}
      </section>

      <section className="auditSection twoCol">
        <article className="panel">
          <p className="kicker">Search log</p>
          <pre className="auditJson">{pretty(searches)}</pre>
        </article>
        <article className="panel">
          <p className="kicker">Retrieval log</p>
          <pre className="auditJson">{pretty(retrievals)}</pre>
        </article>
      </section>

      <section className="auditSection">
        <div className="sectionTitle">
          <p className="kicker">AI execution ledger</p>
          <h2>Background research jobs</h2>
        </div>
        <pre className="auditJson">{pretty(jobs)}</pre>
      </section>

      <section className="auditSection twoCol">
        <article className="panel">
          <p className="kicker">Independent reviewers</p>
          <pre className="auditJson">{pretty(reviews)}</pre>
        </article>
        <article className="panel">
          <p className="kicker">Challenges</p>
          <pre className="auditJson">{pretty(challenges)}</pre>
        </article>
      </section>

      <section className="auditSection">
        <div className="sectionTitle">
          <p className="kicker">Blind adjudication</p>
          <h2>Reconciliation record</h2>
        </div>
        <pre className="auditJson">{pretty(reconciliations)}</pre>
      </section>

      <section className="auditSection">
        <div className="sectionTitle">
          <p className="kicker">System chronology</p>
          <h2>Immutable audit events</h2>
        </div>
        <pre className="auditJson">{pretty(auditEvents)}</pre>
      </section>
    </AppShell>
  );
}
