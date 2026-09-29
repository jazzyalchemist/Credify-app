import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const ORCHESTRATORS = [
  "lib/ai/orchestrator.ts",
  "lib/ai/page1-orchestrator.ts",
  "lib/redteam/orchestrator.ts",
];

test("Responses web_search payloads contain no deprecated external_web_access field", () => {
  for (const relative of ORCHESTRATORS) {
    const source = fs.readFileSync(path.join(ROOT, relative), "utf8");
    assert.doesNotMatch(
      source,
      /external_web_access/,
      relative + " contains a deprecated Responses web_search field",
    );
  }
});

test("default research model is GPT-5.6 Sol", () => {
  const source = fs.readFileSync(
    path.join(ROOT, "lib/ai/openai.ts"),
    "utf8",
  );
  assert.match(source, /gpt-5\.6-sol/);
});

test("research web search uses the current web_search tool type", () => {
  const combined = ORCHESTRATORS.map((relative) =>
    fs.readFileSync(path.join(ROOT, relative), "utf8"),
  ).join("\n");
  assert.match(combined, /type:\s*"web_search"/);
});
