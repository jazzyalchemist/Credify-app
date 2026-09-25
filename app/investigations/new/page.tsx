import { AppShell } from "@/components/AppShell";
import { NewInvestigationForm } from "@/components/NewInvestigationForm";

export default function NewInvestigationPage() {
  return (
    <AppShell
      eyebrow="New investigation"
      title="Start with the material, not the conclusion."
      subtitle="Credify will define the protocol, decompose the claims, and build the evidence trail before allowing a final assessment."
    >
      <NewInvestigationForm />

      <section className="modeGrid">
        {[
          ["Academic / scientific", "Methodology, peer review, replication, statistics, COI, corrections and retractions."],
          ["News / current events", "Original reporting, wire tracing, official records, chronology and independent-source checks."],
          ["Historical", "Archives, contemporaneous evidence, historiography, translation and presentism controls."],
          ["Image / video", "Origin tracing, metadata, reverse-search history, manipulation and context verification."],
          ["Corporate / organization", "Ownership, filings, funding, governance, lobbying, disclosures and historical claims."],
          ["General OSINT", "Broad evidence collection, source mapping, provenance, context and adversarial testing."],
        ].map(([title, text]) => (
          <article className="modeCard" key={title}>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
