import { NextRequest, NextResponse } from "next/server";
import {
  createInvestigation,
  listInvestigations,
} from "@/lib/db/repository";
import { databaseConfigured } from "@/lib/db/client";
import { createInvestigationSchema } from "@/lib/api/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!databaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured." },
      { status: 503 },
    );
  }

  const investigations = await listInvestigations();
  return NextResponse.json({ investigations });
}

export async function POST(request: NextRequest) {
  if (!databaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured." },
      { status: 503 },
    );
  }

  const parsed = createInvestigationSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid investigation input.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const investigation = await createInvestigation(parsed.data);
  return NextResponse.json({ investigation }, { status: 201 });
}
