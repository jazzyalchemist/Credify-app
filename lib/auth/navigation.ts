export function safeInternalPath(
  candidate: string | null | undefined,
  fallback = "/investigations",
) {
  if (!candidate) return fallback;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;

  try {
    const url = new URL(candidate, "https://credify.invalid");
    if (url.origin !== "https://credify.invalid") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
