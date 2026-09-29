import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, sessionCookie } from "@/lib/auth/session";

function privateResponse(response: NextResponse) {
  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate, max-age=0",
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

function isExplicitCrossSiteMutation(request: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return false;

  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return true;

  const fetchSite = request.headers.get("sec-fetch-site");
  return fetchSite === "cross-site";
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path === "/investigations/demo") {
    return NextResponse.next();
  }

  const token = request.cookies.get(sessionCookie.name)?.value;
  const authenticated = await verifySessionToken(token);

  if (
    authenticated &&
    path.startsWith("/api/investigations") &&
    isExplicitCrossSiteMutation(request)
  ) {
    return privateResponse(
      NextResponse.json(
        { error: "Cross-site mutation request rejected." },
        { status: 403 },
      ),
    );
  }

  if (authenticated) {
    return privateResponse(NextResponse.next());
  }

  if (path.startsWith("/api/")) {
    return privateResponse(
      NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    );
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", path + request.nextUrl.search);
  return privateResponse(NextResponse.redirect(login));
}

export const config = {
  matcher: [
    "/investigations/:path*",
    "/status",
    "/api/investigations/:path*",
  ],
};
