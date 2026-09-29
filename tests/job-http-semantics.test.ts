import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const routePath = path.join(
  process.cwd(),
  "app",
  "api",
  "investigations",
  "[id]",
  "ai",
  "jobs",
  "[jobId]",
  "route.ts",
);

test("AI job GET is read-only", () => {
  const source = fs.readFileSync(routePath, "utf8");
  const getStart = source.indexOf("export async function GET");
  const postStart = source.indexOf("export async function POST");
  assert.ok(getStart >= 0 && postStart > getStart);

  const getBody = source.slice(getStart, postStart);
  assert.match(getBody, /getAiJob/);
  assert.doesNotMatch(getBody, /refreshAiJob/);
});

test("AI job processing requires explicit POST", () => {
  const source = fs.readFileSync(routePath, "utf8");
  const postStart = source.indexOf("export async function POST");
  assert.ok(postStart >= 0);
  assert.match(source.slice(postStart), /refreshAiJob/);

  const panel = fs.readFileSync(
    path.join(process.cwd(), "components", "AIResearchPanel.tsx"),
    "utf8",
  );
  assert.match(panel, /method:\s*"POST"/);
});
