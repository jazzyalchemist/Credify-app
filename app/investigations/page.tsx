import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { databaseConfigured } from "@/lib/db/client";
import { listInvestigations } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export default async function InvestigationsPage() {
  const configured = databaseConfigured();
  const investigations = configured ? await listInvestigations() : [];

  return (
    <AppShell
      eyebrow="Research workspace"
      title="Investigations"
      subtitle="Each investigation preserves its original input, protocol version, evidence state, adversarial review, and confidence changes."
    >
      {!configured ? (
        <section className="setupCard">
          <p className="kicker">Database setup required</p>
          <h2>Persistence is ready, but DATABASE_URL is not configured.</h2>
          <p>
            Connect a PostgreSQL database, set the server environment variable,
            then run <code>npm run db:migrate</code>. No investigation evidence is
            stored in GitHub.
          </p>
        </section>
      ) : (
        <>
          <div className="listToolbar">
            <p>
              {investigations.length} stored investigation
              {investigations.length === 1 ? "" : "s"}
            </p>
            <Link className="primaryButton" href="/investigations/new">
              New investigation <span>→</span>
            </Link>
          </div>

          {investigations.length === 0 ? (
            <section className="emptyState">
              <p className="kicker">No investigations yet</p>
              <h2>Create the first Credify investigation.</h2>
              <p>
                The original input and exact protocol commit will be pinned at
                creation.
              </p>
            </section>
          ) : (
            <section className="investigationList">
              {investigations.map((item) => (
                <Link
                  key={item.id}
                  href={"/investigations/" + encodeURIComponent(item.id)}
                  className="investigationRow"
                >
                  <div>
                    <span className="claimId">{item.id}</span>
                    <h3>{item.title}</h3>
                    <p>
                      {item.investigation_mode} · Protocol v
                      {item.protocol_version}
                    </p>
                  </div>
                  <div className="rowMeta">
                    <span className="statusChip">
                      {item.current_phase.replaceAll("_", " ")}
                    </span>
                    <small>
                      Updated{" "}
                      {new Date(item.updated_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </small>
                  </div>
                </Link>
              ))}
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}
