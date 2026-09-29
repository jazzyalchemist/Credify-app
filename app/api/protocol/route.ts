import { NextResponse } from "next/server";
import { PROTOCOL } from "@/lib/protocol/manifest";
import { CREDIBILITY_DIMENSIONS, CREDIBILITY_TOTAL } from "@/lib/protocol/scoring";
import { RESEARCH_SECURITY_RULES } from "@/lib/security/safeguards";

export async function GET() {
  return NextResponse.json({
    protocol: PROTOCOL,
    scoring: {
      total: CREDIBILITY_TOTAL,
      dimensions: CREDIBILITY_DIMENSIONS,
    },
    securitySafeguards: RESEARCH_SECURITY_RULES,
  });
}
