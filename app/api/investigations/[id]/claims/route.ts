import { NextRequest, NextResponse } from "next/server";
import { createClaim, getInvestigation } from "@/lib/db/repository";
import { createClaimSchema } from "@/lib/api/schemas";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!(await getInvestigation(id))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const parsed = createClaimSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid claim.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const claim = await createClaim(id, parsed.data);
  return NextResponse.json({ claim }, { status: 201 });
}
