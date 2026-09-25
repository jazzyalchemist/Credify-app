import { NextResponse } from "next/server";
import { startReconciliation } from "@/lib/redteam/orchestrator";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const job = await startReconciliation(id);
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start blind reconciliation.",
      },
      { status: 409 },
    );
  }
}
