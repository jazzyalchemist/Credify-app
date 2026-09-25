"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REDTEAM_ROLES } from "@/lib/redteam/roles";
import type { InvestigationPhase } from "@/lib/protocol/types";

type Review = {
  id: string;
  reviewer_role: string;
  status: string;
  model_version: string | null;
};

export function RedTeamPanel({
  investigationId,
  currentPhase,
  reviews,
  challengeCount,
  reconciliationCount,
}: {
  investigationId: string;
  currentPhase: InvestigationPhase;
  reviews: Review[];
  challengeCount: number;
  reconciliationCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const reviewByRole = new Map(
    reviews
      .filter((review) => review.status !== "FAILED")
      .map((review) => [review.reviewer_role, review]),
  );

  const completedRoles = REDTEAM_ROLES.filter(
    (role) => reviewByRole.get(role.key)?.status === "COMPLETED",
  ).length;

  async function start(path: string) {
    setBusy(true);
    setMessage("");

    const response = await fetch(
      "/api/investigations/" +
        encodeURIComponent(investigationId) +
        path,
      { method: "POST" },
    );

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      errors?: Array<{ role: string; error: string }>;
    };

    if (!response.ok) {
      setMessage(data.error ?? "Unable to start this adversarial stage.");
      setBusy(false);
      return;
    }

    if (data.errors?.length) {
      setMessage(
        data.errors.length +
          " reviewer(s) could not start and can be retried without discarding completed reviewers.",
      );
    }

    setBusy(false);
    router.refresh();
  }

  return (
    <section className="panel adversarialPanel">
      <div className="panelHeading">
        <div>
          <p className="kicker">Page 2 · adversarial validation</p>
          <h2>Independent rival-AI swarm</h2>
        </div>
        <span className="statusChip">
          {completedRoles} / {REDTEAM_ROLES.length} complete
        </span>
      </div>

      <p className="panelIntro">
        Each role receives the same frozen Page-1 dossier but not the other
        reviewers&apos; conclusions. Agreement among models is not counted as
        independent evidence; attacks must survive evidence-based reconciliation.
      </p>

      <div className="redteamRoleGrid">
        {REDTEAM_ROLES.map((role, index) => {
          const review = reviewByRole.get(role.key);
          const status = review?.status ?? "NOT STARTED";
          return (
            <article className="redteamRoleCard" key={role.key}>
              <div className="redteamRoleTop">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span
                  className={
                    "statusChip " +
                    (status === "COMPLETED"
                      ? "upheld"
                      : status === "FAILED"
                        ? "disproven"
                        : "")
                  }
                >
                  {status}
                </span>
              </div>
              <h3>{role.name}</h3>
              <p>{role.mission}</p>
              {review?.model_version ? (
                <small>{review.model_version}</small>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="redteamSummaryBar">
        <div>
          <span>Challenges</span>
          <strong>{challengeCount}</strong>
        </div>
        <div>
          <span>Reconciled</span>
          <strong>{reconciliationCount}</strong>
        </div>
        <div>
          <span>Reviewer isolation</span>
          <strong>Enforced</strong>
        </div>
      </div>

      <div className="aiActions">
        {currentPhase === "REDTEAM" ? (
          <button
            className="primaryButton"
            disabled={busy}
            onClick={() => start("/redteam/start")}
          >
            {busy
              ? "Starting reviewers…"
              : completedRoles === 0
                ? "Launch 8-role rival swarm"
                : "Retry incomplete reviewers"}
          </button>
        ) : null}

        {currentPhase === "RECONCILIATION" ? (
          <button
            className="primaryButton"
            disabled={busy}
            onClick={() => start("/reconciliation/start")}
          >
            {busy ? "Starting judge…" : "Run blind reconciliation"}
          </button>
        ) : null}
      </div>

      {message ? <p className="gateMessage">{message}</p> : null}
    </section>
  );
}
