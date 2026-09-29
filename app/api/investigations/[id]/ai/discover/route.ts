import { NextResponse } from "next/server";
import { startDiscovery } from "@/lib/ai/orchestrator";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const job = await startDiscovery(id);
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start evidence discovery.",
      },
      { status: 409 },
    );
  }
}
