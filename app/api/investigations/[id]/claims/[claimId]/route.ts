import { NextRequest, NextResponse } from "next/server";
import { updateClaim } from "@/lib/db/repository";
import { updateClaimSchema } from "@/lib/api/schemas";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; claimId: string }> },
) {
  const { id, claimId } = await context.params;
  const parsed = updateClaimSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid claim update.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const claim = await updateClaim(id, claimId, parsed.data);
  if (!claim) {
    return NextResponse.json({ error: "Claim not found." }, { status: 404 });
  }

  return NextResponse.json({ claim });
}
