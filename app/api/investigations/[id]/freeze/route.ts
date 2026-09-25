import { NextResponse } from "next/server";
import { freezePreRedTeamDossier } from "@/lib/db/repository";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const result = await freezePreRedTeamDossier(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to freeze dossier.",
      },
      { status: 409 },
    );
  }
}
