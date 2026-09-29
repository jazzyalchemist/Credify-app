import { AppShell } from "@/components/AppShell";
import { ClaimCard } from "@/components/ClaimCard";
import { EvidenceChain } from "@/components/EvidenceChain";
import { Metric } from "@/components/Metric";
import { PhaseRail } from "@/components/PhaseRail";
import { demoInvestigation } from "@/lib/demo";

export default function DemoInvestigationPage() {
  const d = demoInvestigation;

  return (
    <AppShell
      eyebrow="Investigation INV-DEMO-001"
      title={d.title}
      subtitle={d.subtitle}
    >
      <section className="workspaceGrid">
        <aside className="railPanel">
          <div className="panelHeading">
            <p className="kicker">Protocol progress</p>
            <span className="lockedBadge">Gate enforced</span>
          </div>
          <PhaseRail current={d.currentPhase} completed={d.completed} />
        </aside>

        <div className="workspaceMain">
          <section className="metricsGrid">
            <Metric label="Claims" value={String(d.metrics.claims)} note="Decomposed" />
            <Metric label="Sources" value={String(d.metrics.sources)} note="Screened" />
            <Metric
              label="Independent chains"
              value={String(d.metrics.independentChains)}
              note="Not URL count"
              tone="good"
            />
            <Metric
              label="Primary recovered"
              value={d.metrics.primaryRecovered}
              note="Required material"
            />
            <Metric
              label="Unresolved"
              value={String(d.metrics.unresolved)}
              note="Material conflicts"
              tone="warn"
            />
            <Metric
              label="RedTeam"
              value={d.metrics.redTeamChallenges}
              note="Challenges upheld"
              tone="warn"
            />
          </section>

          <section className="panel">
            <div className="panelHeading">
              <div>
                <p className="kicker">Claim board</p>
                <h2>What survived the first adversarial pass?</h2>
              </div>
              <button className="smallButton">View all 17 claims</button>
            </div>
            <div className="claimGrid">
              {d.claims.map((claim) => (
                <ClaimCard key={claim.id} {...claim} />
              ))}
            </div>
          </section>

          <section className="twoCol">
            <div className="panel">
              <div className="panelHeading">
                <div>
                  <p className="kicker">Evidence provenance</p>
                  <h2>Information-chain independence</h2>
                </div>
              </div>
              <EvidenceChain />
            </div>

            <div className="panel redTeamPanel">
              <div className="panelHeading">
                <div>
                  <p className="kicker">Page 2</p>
                  <h2>Rival AI swarm</h2>
                </div>
                <span className="activeBadge">Running</span>
              </div>

              <div className="reviewerList">
                {[
                  ["01", "Primary-claim fact checker", "Upheld 8 · Challenged 1"],
                  ["02", "Methodology critic", "Causal overreach found"],
                  ["03", "Provenance / citation auditor", "Shared-origin failure found"],
                  ["04", "Data / figure forensics", "Recalculation passed"],
                  ["05", "Logic and inference analyst", "Reviewing"],
                  ["06", "Bias / context auditor", "Reviewing"],
                  ["07", "Alternative-hypothesis generator", "3 rivals generated"],
                  ["08", "Opposing-evidence specialist", "Searching"],
                ].map(([num, name, result]) => (
                  <div className="reviewer" key={num}>
                    <span>{num}</span>
                    <div>
                      <strong>{name}</strong>
                      <small>{result}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="auditBanner">
            <div>
              <p className="kicker">Reproducibility</p>
              <h3>Every conclusion keeps its evidence trail.</h3>
              <p>
                Protocol commit, exact searches, retrieval failures, source origin,
                calculations, RedTeam challenges, and confidence changes remain
                auditable.
              </p>
            </div>
            <button className="ghostButton">Open audit view</button>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
