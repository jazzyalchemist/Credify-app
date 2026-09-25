import { NextRequest, NextResponse } from "next/server";
import {
  accessKeyConfigured,
  issueSessionToken,
  sessionCookie,
  validAccessKey,
} from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  if (!accessKeyConfigured()) {
    return NextResponse.json(
      {
        error:
          "Authentication is not configured. Set CREDIFY_ACCESS_KEY and CREDIFY_SESSION_SECRET.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { accessKey?: string }
    | null;

  if (!body?.accessKey || !validAccessKey(body.accessKey)) {
    return NextResponse.json({ error: "Invalid access key." }, { status: 401 });
  }

  const token = await issueSessionToken();
  const response = NextResponse.json({ authenticated: true });

  response.cookies.set(sessionCookie.name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionCookie.maxAge,
  });

  return response;
}
