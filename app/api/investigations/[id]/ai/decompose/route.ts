import { NextResponse } from "next/server";
import { startDecomposition } from "@/lib/ai/orchestrator";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const job = await startDecomposition(id);
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start claim decomposition.",
      },
      { status: 409 },
    );
  }
}
