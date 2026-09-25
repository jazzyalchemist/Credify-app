const COOKIE_NAME = "credify_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return bytesToHex(new Uint8Array(signature));
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function issueSessionToken(): Promise<string> {
  const secret = process.env.CREDIFY_SESSION_SECRET;
  if (!secret) throw new Error("CREDIFY_SESSION_SECRET is not configured.");

  const expires = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = String(expires);
  const signature = await hmac(payload, secret);
  return payload + "." + signature;
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.CREDIFY_SESSION_SECRET;
  if (!secret) return false;

  const [expiresRaw, signature] = token.split(".");
  const expires = Number(expiresRaw);
  if (!expiresRaw || !signature || !Number.isFinite(expires)) return false;
  if (expires < Math.floor(Date.now() / 1000)) return false;

  const expected = await hmac(expiresRaw, secret);
  return constantTimeEqual(signature, expected);
}

export function accessKeyConfigured() {
  return Boolean(
    process.env.CREDIFY_ACCESS_KEY && process.env.CREDIFY_SESSION_SECRET,
  );
}

export function validAccessKey(candidate: string): boolean {
  const expected = process.env.CREDIFY_ACCESS_KEY;
  if (!expected || candidate.length !== expected.length) return false;
  return constantTimeEqual(candidate, expected);
}

export const sessionCookie = {
  name: COOKIE_NAME,
  maxAge: MAX_AGE_SECONDS,
};
