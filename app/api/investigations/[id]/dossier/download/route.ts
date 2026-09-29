import { createHash } from "crypto";
import { getInvestigation } from "@/lib/db/repository";
import { canonicalJsonString } from "@/lib/crypto/canonical-json";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const investigation = await getInvestigation(id);

  if (!investigation) {
    return new Response("Investigation not found.", { status: 404 });
  }

  if (
    !investigation.pre_redteam_snapshot ||
    !investigation.pre_redteam_snapshot_hash ||
    !investigation.pre_redteam_frozen_at
  ) {
    return new Response("Pre-RedTeam dossier is not frozen.", { status: 409 });
  }

  const canonical = canonicalJsonString(
    investigation.pre_redteam_snapshot,
  );
  const recomputed = createHash("sha256")
    .update(canonical)
    .digest("hex");

  if (recomputed !== investigation.pre_redteam_snapshot_hash) {
    return new Response(
      "Frozen dossier integrity verification failed.",
      { status: 500 },
    );
  }

  const filename =
    "credify-" +
    id.replace(/[^a-zA-Z0-9-_]/g, "_") +
    "-pre-redteam-dossier.json";

  return new Response(
    JSON.stringify(investigation.pre_redteam_snapshot, null, 2),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="' + filename + '"',
        "Cache-Control": "private, no-store",
        "X-Credify-SHA256": recomputed,
        "X-Credify-Snapshot-Version": "2",
      },
    },
  );
}
