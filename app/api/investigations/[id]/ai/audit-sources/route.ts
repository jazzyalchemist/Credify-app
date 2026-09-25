import { NextResponse } from "next/server";
import { startSourceAudits } from "@/lib/ai/page1-orchestrator";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const result = await startSourceAudits(id);
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start source audits." },
      { status: 409 },
    );
  }
}
