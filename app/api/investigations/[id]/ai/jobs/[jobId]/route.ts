import { NextResponse } from "next/server";
import { refreshAiJob } from "@/lib/ai/orchestrator";
import { getAiJob } from "@/lib/db/ai-jobs";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; jobId: string }> },
) {
  const { id, jobId } = await context.params;
  const job = await getAiJob(id, jobId);

  if (!job) {
    return NextResponse.json({ error: "AI job not found." }, { status: 404 });
  }

  return NextResponse.json({ job });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; jobId: string }> },
) {
  const { id, jobId } = await context.params;

  try {
    const job = await refreshAiJob(id, jobId);
    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to refresh AI job.",
      },
      { status: 404 },
    );
  }
}
