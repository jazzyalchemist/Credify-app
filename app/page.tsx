import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PROTOCOL } from "@/lib/protocol/manifest";

export default function Home() {
  return (
    <AppShell
      eyebrow="Evidence intelligence"
      title="What can you actually know?"
      subtitle="Credify turns a rigorous OSINT, academic, provenance, and adversarial review protocol into a tool you can use from anywhere."
    >
      <section className="heroGrid">
        <div className="heroCard heroPrimary">
          <div>
            <span className="kicker">Protocol-enforced research</span>
            <h2>
              Investigate a claim, article, document, image, dataset, or
              organization.
            </h2>
            <p>
              Credify decomposes the material into testable claims, traces evidence
              to its origin, distinguishes repetition from independent corroboration,
              and sends the first-pass result through a hostile rival-AI review.
            </p>
          </div>
          <div className="heroActions">
            <Link className="primaryButton" href="/investigations/new">
              Start an investigation <span>→</span>
            </Link>
            <Link className="ghostButton" href="/investigations/demo">
              Explore demo workspace
            </Link>
          </div>
        </div>

        <aside className="heroCard protocolCard">
          <p className="kicker">Pinned methodology</p>
          <h3>{PROTOCOL.name}</h3>
          <dl className="protocolFacts">
            <div>
              <dt>Protocol</dt>
              <dd>v{PROTOCOL.version}</dd>
            </div>
            <div>
              <dt>Matrix</dt>
              <dd>{PROTOCOL.credibilityMatrixTotal} pts</dd>
            </div>
            <div>
              <dt>Rival roles</dt>
              <dd>{PROTOCOL.rivalReviewerCount}</dd>
            </div>
            <div>
              <dt>Release</dt>
              <dd>{PROTOCOL.releaseRef}</dd>
            </div>
          </dl>
          <p className="micro">
            Every investigation records the exact protocol commit used. Methodology
            changes cannot silently rewrite prior investigations.
          </p>
        </aside>
      </section>

      <section className="featureGrid">
        <article className="featureCard">
          <span>01</span>
          <h3>Claim decomposition</h3>
          <p>
            Separate facts, statistics, causal assertions, interpretation,
            allegations, and rhetoric before judging the source as a whole.
          </p>
        </article>
        <article className="featureCard">
          <span>02</span>
          <h3>Provenance graph</h3>
          <p>
            Trace articles, studies, datasets, press releases, archives, and reports
            back to their true information origin.
          </p>
        </article>
        <article className="featureCard">
          <span>03</span>
          <h3>Adversarial review</h3>
          <p>
            Freeze the first-pass dossier, then task independent rival reviewers
            with disproving it rather than polishing it.
          </p>
        </article>
        <article className="featureCard">
          <span>04</span>
          <h3>Auditability</h3>
          <p>
            Preserve searches, failed retrievals, evidence chains, score changes,
            and reconciliation decisions instead of hiding uncertainty.
          </p>
        </article>
      </section>

      <section className="principleBand">
        <p>Governing question</p>
        <blockquote>
          After attempting as seriously as possible to disprove this conclusion,
          what does the strongest available evidence still allow me to say?
        </blockquote>
      </section>
    </AppShell>
  );
}
