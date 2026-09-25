import { NextResponse } from "next/server";
import { startRedTeam } from "@/lib/redteam/orchestrator";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const result = await startRedTeam(id);
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start the rival RedTeam swarm.",
      },
      { status: 409 },
    );
  }
}
