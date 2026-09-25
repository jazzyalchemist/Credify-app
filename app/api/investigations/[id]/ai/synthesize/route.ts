import { NextResponse } from "next/server";
import { startSynthesis } from "@/lib/ai/page1-orchestrator";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const job = await startSynthesis(id);
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start synthesis." },
      { status: 409 },
    );
  }
}
