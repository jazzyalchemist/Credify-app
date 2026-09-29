import { NextRequest, NextResponse } from "next/server";
import { createSource, getInvestigation } from "@/lib/db/repository";
import { createSourceSchema } from "@/lib/api/schemas";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!(await getInvestigation(id))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const parsed = createSourceSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid source.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const source = await createSource(id, parsed.data);
  return NextResponse.json({ source }, { status: 201 });
}
