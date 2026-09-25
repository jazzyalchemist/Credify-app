import Link from "next/link";
import { PROTOCOL } from "@/lib/protocol/manifest";

export function AppShell({
  children,
  eyebrow,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="app">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Credify home">
          <span className="brandMark">C</span>
          <span>Credify</span>
        </Link>
        <nav className="topnav" aria-label="Primary">
          <Link href="/investigations/new">New investigation</Link>
          <Link href="/investigations/demo">Demo workspace</Link>
          <a
            href="https://github.com/jazzyalchemist/credibility-verification-engine"
            target="_blank"
            rel="noreferrer"
          >
            Protocol
          </a>
        </nav>
        <div className="protocolPill">
          <span className="liveDot" />
          Protocol v{PROTOCOL.version}
        </div>
      </header>

      <main className="page">
        <section className="pageIntro">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          {subtitle ? <p className="lede">{subtitle}</p> : null}
        </section>
        {children}
      </main>
    </div>
  );
}
