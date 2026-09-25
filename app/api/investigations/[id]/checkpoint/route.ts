import { NextRequest, NextResponse } from "next/server";
import { markPhaseCheckpoint } from "@/lib/db/repository";
import { checkpointSchema } from "@/lib/api/schemas";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const parsed = checkpointSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid checkpoint.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const investigation = await markPhaseCheckpoint(id, parsed.data.phase);
    return NextResponse.json({ investigation });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete checkpoint.",
      },
      { status: 409 },
    );
  }
}
