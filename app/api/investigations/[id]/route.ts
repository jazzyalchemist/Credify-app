import { NextResponse } from "next/server";
import {
  buildInvestigationState,
  getClaims,
  getInvestigation,
  getSources,
} from "@/lib/db/repository";
import { databaseConfigured } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!databaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured." },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  const investigation = await getInvestigation(id);
  if (!investigation) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const [claims, sources, state] = await Promise.all([
    getClaims(id),
    getSources(id),
    buildInvestigationState(id),
  ]);

  return NextResponse.json({ investigation, claims, sources, state });
}
