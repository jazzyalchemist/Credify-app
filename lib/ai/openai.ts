import { createHash } from "crypto";

export interface OpenAIWebSource {
  url: string;
  title: string;
}

export interface OpenAIResponse {
  id: string;
  status: string;
  model?: string;
  output?: unknown[];
  error?: { message?: string } | null;
}

const API_ROOT = "https://api.openai.com/v1";

function apiKey() {
  const value = process.env.OPENAI_API_KEY;
  if (!value) throw new Error("OPENAI_API_KEY is not configured.");
  return value;
}

export function researchModel() {
  return process.env.OPENAI_RESEARCH_MODEL || "gpt-5.6-sol";
}

export function shouldStoreResponses() {
  return (process.env.OPENAI_STORE_RESPONSES || "true").toLowerCase() === "true";
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(API_ROOT + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + apiKey(),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as
    | T
    | { error?: { message?: string } }
    | null;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? body.error?.message
        : undefined;
    throw new Error(message || "OpenAI API request failed.");
  }

  return body as T;
}

export async function createBackgroundResponse(
  payload: Record<string, unknown>,
): Promise<OpenAIResponse> {
  return request<OpenAIResponse>("/responses", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      background: true,
      store: shouldStoreResponses(),
    }),
  });
}

export async function cancelBackgroundResponse(
  responseId: string,
): Promise<OpenAIResponse> {
  return request<OpenAIResponse>(
    "/responses/" + encodeURIComponent(responseId) + "/cancel",
    { method: "POST" },
  );
}

export async function retrieveResponse(
  responseId: string,
): Promise<OpenAIResponse> {
  return request<OpenAIResponse>(
    "/responses/" +
      encodeURIComponent(responseId) +
      "?include=web_search_call.action.sources",
    { method: "GET" },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function hasWebSearchCall(response: OpenAIResponse) {
  return (response.output ?? []).some(
    (item) => isRecord(item) && item.type === "web_search_call",
  );
}

export function extractCodeInterpreterUsage(response: OpenAIResponse) {
  const containerIds = new Set<string>();
  const calls: Array<{
    containerId: string | null;
    status: string | null;
    code: string | null;
    codeSha256: string | null;
    codeLength: number;
    codeTruncated: boolean;
  }> = [];

  for (const item of response.output ?? []) {
    if (!isRecord(item) || item.type !== "code_interpreter_call") continue;

    const containerId =
      typeof item.container_id === "string" ? item.container_id : null;
    if (containerId) containerIds.add(containerId);

    const rawCode = typeof item.code === "string" ? item.code : null;
    const codeLength = rawCode?.length ?? 0;
    const codeSha256 = rawCode
      ? createHash("sha256").update(rawCode).digest("hex")
      : null;
    const codeLimit = 50_000;
    const code =
      rawCode && rawCode.length > codeLimit
        ? rawCode.slice(0, codeLimit)
        : rawCode;

    calls.push({
      containerId,
      status: typeof item.status === "string" ? item.status : null,
      code,
      codeSha256,
      codeLength,
      codeTruncated: Boolean(rawCode && rawCode.length > codeLimit),
    });
  }

  return {
    used: calls.length > 0,
    callCount: calls.length,
    containerIds: [...containerIds],
    calls,
  };
}

export function extractOutputText(response: OpenAIResponse): string {
  const chunks: string[] = [];
  for (const item of response.output ?? []) {
    if (!isRecord(item) || item.type !== "message") continue;
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (!isRecord(part) || part.type !== "output_text") continue;
      if (typeof part.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

export function extractWebSources(
  response: OpenAIResponse,
): OpenAIWebSource[] {
  const seen = new Set<string>();
  const sources: OpenAIWebSource[] = [];

  for (const item of response.output ?? []) {
    if (!isRecord(item) || item.type !== "web_search_call") continue;
    const action = isRecord(item.action) ? item.action : null;
    const rawSources = action && Array.isArray(action.sources)
      ? action.sources
      : [];

    for (const source of rawSources) {
      if (!isRecord(source) || typeof source.url !== "string") continue;
      if (seen.has(source.url)) continue;
      seen.add(source.url);
      sources.push({
        url: source.url,
        title: typeof source.title === "string" ? source.title : source.url,
      });
    }
  }

  return sources;
}

export function extractWebQueries(response: OpenAIResponse): string[] {
  const queries = new Set<string>();

  for (const item of response.output ?? []) {
    if (!isRecord(item) || item.type !== "web_search_call") continue;
    const action = isRecord(item.action) ? item.action : null;
    if (!action) continue;

    if (typeof action.query === "string") queries.add(action.query);
    if (Array.isArray(action.queries)) {
      for (const query of action.queries) {
        if (typeof query === "string") queries.add(query);
      }
    }
  }

  return [...queries];
}
