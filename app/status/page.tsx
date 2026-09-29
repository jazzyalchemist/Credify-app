import { AppShell } from "@/components/AppShell";
import { getRuntimeReadiness } from "@/lib/runtime/readiness";

export const dynamic = "force-dynamic";

function State({
  ready,
  label,
  detail,
}: {
  ready: boolean;
  label: string;
  detail: string;
}) {
  return (
    <article className={"readinessCard " + (ready ? "ready" : "notReady")}>
      <div className="readinessTop">
        <span className="readinessDot" />
        <strong>{label}</strong>
        <span className="statusChip">{ready ? "READY" : "NEEDS SETUP"}</span>
      </div>
      <p>{detail}</p>
    </article>
  );
}

export default async function StatusPage() {
  const status = await getRuntimeReadiness();

  return (
    <AppShell
      eyebrow="Runtime integrity"
      title="Credify status"
      subtitle="Deployment health is separate from research readiness. This page verifies the runtime pieces without revealing credentials."
    >
      <section className="readinessSummary">
        <div>
          <p className="kicker">Manual investigation</p>
          <strong>
            {status.manualInvestigationReady ? "Ready" : "Not fully ready"}
          </strong>
        </div>
        <div>
          <p className="kicker">AI research pipeline</p>
          <strong>{status.aiResearchReady ? "Ready" : "Not fully ready"}</strong>
        </div>
        <div>
          <p className="kicker">Research model</p>
          <strong>{status.model}</strong>
        </div>
      </section>

      <section className="readinessGrid">
        <State
          ready={status.authentication}
          label="Private authentication"
          detail="Server-side access key and signed session secret."
        />
        <State
          ready={status.database}
          label="Persistent PostgreSQL"
          detail="Investigation, evidence, audit, RedTeam, and report state."
        />
        <State
          ready={status.canonicalProtocol}
          label="Canonical protocol"
          detail={
            "v" +
            status.protocol.version +
            " · " +
            status.protocol.commit.slice(0, 12) +
            " · cryptographically verified"
          }
        />
        <State
          ready={status.openAi}
          label="OpenAI research runtime"
          detail={
            status.openAi
              ? "API credential is present; background research jobs can run."
              : "An API credential must be supplied before AI research jobs can run."
          }
        />
      </section>

      {status.notes.length > 0 ? (
        <section className="runtimeNotes">
          <p className="kicker">Configuration notes</p>
          <ul>
            {status.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="runtimeNotes readyNote">
          <p className="kicker">All systems</p>
          <strong>Credify is fully configured for protocol-enforced AI research.</strong>
        </section>
      )}
    </AppShell>
  );
}
