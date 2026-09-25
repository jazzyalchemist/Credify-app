import { NextRequest, NextResponse } from "next/server";
import { canEnterPhase } from "@/lib/protocol/gates";
import type {
  InvestigationPhase,
  InvestigationState,
} from "@/lib/protocol/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    target?: InvestigationPhase;
    state?: InvestigationState;
  };

  if (!body.target || !body.state) {
    return NextResponse.json(
      { error: "target and state are required" },
      { status: 400 },
    );
  }

  const result = canEnterPhase(body.target, body.state);

  return NextResponse.json(
    { target: body.target, ...result },
    { status: result.allowed ? 200 : 409 },
  );
}
