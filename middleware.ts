import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, sessionCookie } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path === "/investigations/demo") {
    return NextResponse.next();
  }

  const token = request.cookies.get(sessionCookie.name)?.value;
  const authenticated = await verifySessionToken(token);

  if (authenticated) {
    return NextResponse.next();
  }

  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", path);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/investigations/:path*",
    "/api/investigations/:path*",
  ],
};
