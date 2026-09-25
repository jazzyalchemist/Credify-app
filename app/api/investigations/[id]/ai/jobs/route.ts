import { NextResponse } from "next/server";
import { listAiJobs } from "@/lib/db/ai-jobs";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const jobs = await listAiJobs(id);
  return NextResponse.json({ jobs });
}
