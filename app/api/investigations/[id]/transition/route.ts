import { NextRequest, NextResponse } from "next/server";
import { transitionInvestigation } from "@/lib/db/repository";
import { transitionSchema } from "@/lib/api/schemas";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const parsed = transitionSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid target phase.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await transitionInvestigation(id, parsed.data.target);
    return NextResponse.json(result, {
      status: result.transitioned ? 200 : 409,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to transition investigation";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
