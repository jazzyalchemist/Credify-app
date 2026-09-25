import { NextResponse } from "next/server";
import { startReport } from "@/lib/ai/reports";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const job = await startReport(id, "FINAL");
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start report." },
      { status: 409 },
    );
  }
}
