import { NextRequest, NextResponse } from "next/server";
import { updateSource } from "@/lib/db/repository";
import { updateSourceSchema } from "@/lib/api/schemas";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; sourceId: string }> },
) {
  const { id, sourceId } = await context.params;
  const parsed = updateSourceSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid source update.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const source = await updateSource(id, sourceId, parsed.data);
  if (!source) {
    return NextResponse.json({ error: "Source not found." }, { status: 404 });
  }

  return NextResponse.json({ source });
}
