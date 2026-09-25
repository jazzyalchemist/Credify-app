"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { InvestigationPhase } from "@/lib/protocol/types";

type Job = {
  id: string;
  job_type: string;
  model: string;
  status: string;
  error: string | null;
  created_at: string | Date;
};

const ACTIVE = new Set(["QUEUED", "IN_PROGRESS", "PROCESSING"]);

export function AIResearchPanel({
  investigationId,
  currentPhase,
  jobs,
  frozen,
}: {
  investigationId: string;
  currentPhase: InvestigationPhase;
  jobs: Job[];
  frozen: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const activeJobs = useMemo(
    () => jobs.filter((job) => ACTIVE.has(job.status)),
    [jobs],
  );

  useEffect(() => {
    if (activeJobs.length === 0) return;

    const timer = window.setInterval(async () => {
      await Promise.all(
        activeJobs.map((job) =>
          fetch(
            "/api/investigations/" +
              encodeURIComponent(investigationId) +
              "/ai/jobs/" +
              encodeURIComponent(job.id),
            { cache: "no-store" },
          ).catch(() => null),
        ),
      );
      router.refresh();
    }, 3500);

    return () => window.clearInterval(timer);
  }, [activeJobs, investigationId, router]);

  async function start(kind: "decompose" | "discover") {
    setBusy(true);
    setMessage("");

    const response = await fetch(
      "/api/investigations/" +
        encodeURIComponent(investigationId) +
        "/ai/" +
        kind,
      { method: "POST" },
    );

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!response.ok) {
      setMessage(data.error ?? "Unable to start AI research.");
      setBusy(false);
      return;
    }

    setBusy(false);
    router.refresh();
  }

  const canDecompose = currentPhase === "INTAKE" && !frozen;
  const canDiscover = currentPhase === "IDENTIFICATION" && !frozen;

  return (
    <section className="panel aiResearchPanel">
      <div className="panelHeading">
        <div>
          <p className="kicker">Research automation</p>
          <h2>Protocol-aware AI research</h2>
        </div>
        <span className="statusChip">
          {activeJobs.length > 0 ? activeJobs.length + " running" : "Idle"}
        </span>
      </div>

      <p className="panelIntro">
        AI outputs do not bypass the protocol. Claim decomposition writes only to
        the claim ledger. Discovery uses live web search, records search activity,
        and rejects proposed URLs that were not actually returned by the search
        tool.
      </p>

      <div className="aiActions">
        <button
          className="primaryButton"
          disabled={!canDecompose || busy || activeJobs.length > 0}
          onClick={() => start("decompose")}
        >
          {busy && canDecompose ? "Starting…" : "AI claim decomposition"}
        </button>
        <button
          className="ghostButton"
          disabled={!canDiscover || busy || activeJobs.length > 0}
          onClick={() => start("discover")}
        >
          {busy && canDiscover ? "Starting…" : "Run evidence discovery"}
        </button>
      </div>

      {message ? <p className="gateMessage">{message}</p> : null}

      {jobs.length > 0 ? (
        <div className="jobList">
          {jobs.slice(0, 8).map((job) => (
            <div className="jobRow" key={job.id}>
              <div>
                <span className="claimId">{job.id}</span>
                <strong>{job.job_type.replaceAll("_", " ")}</strong>
                <small>{job.model}</small>
              </div>
              <span
                className={
                  "statusChip " +
                  (job.status === "COMPLETED"
                    ? "upheld"
                    : job.status === "FAILED"
                      ? "disproven"
                      : "")
                }
              >
                {job.status}
              </span>
              {job.error ? <p className="jobError">{job.error}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="emptyInline">
          No AI research jobs yet. The investigation can also be completed
          manually.
        </p>
      )}
    </section>
  );
}
