import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { artifactNeedsQuantitativeForensics } from "../lib/artifacts/content";
import {
  extractCodeInterpreterUsage,
  hasWebSearchCall,
  type OpenAIResponse,
} from "../lib/ai/openai";

test("only tabular spreadsheet artifacts require quantitative recomputation", () => {
  assert.equal(artifactNeedsQuantitativeForensics("text/csv"), true);
  assert.equal(
    artifactNeedsQuantitativeForensics(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ),
    true,
  );
  assert.equal(artifactNeedsQuantitativeForensics("application/pdf"), false);
  assert.equal(artifactNeedsQuantitativeForensics("image/png"), false);
});

test("tool-call verification detects actual web and Python execution", () => {
  const response: OpenAIResponse = {
    id: "resp-test",
    status: "completed",
    output: [
      {
        type: "web_search_call",
        id: "ws-1",
        action: { query: "source provenance" },
      },
      {
        type: "code_interpreter_call",
        id: "ci-1",
        container_id: "cntr-1",
        status: "completed",
        code: "import pandas as pd\nprint(2 + 2)",
      },
    ],
  };

  assert.equal(hasWebSearchCall(response), true);
  const usage = extractCodeInterpreterUsage(response);
  assert.equal(usage.used, true);
  assert.equal(usage.callCount, 1);
  assert.equal(usage.completedCallCount, 1);
  assert.equal(usage.codePresentCallCount, 1);
  assert.deepEqual(usage.containerIds, ["cntr-1"]);
  assert.equal(usage.calls.length, 1);
  assert.equal(usage.calls[0].status, "completed");
  assert.match(usage.calls[0].code ?? "", /pandas/);
  assert.match(usage.calls[0].codeSha256 ?? "", /^[a-f0-9]{64}$/);
});

test("source audits conditionally expose Code Interpreter for tabular data", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
    "utf8",
  );

  assert.match(source, /artifactNeedsQuantitativeForensics/);
  assert.match(source, /type:\s*"code_interpreter"/);
  assert.match(source, /container:\s*\{\s*type:\s*"auto"\s*\}/);
  assert.match(source, /did not complete a verifiable Python recomputation step/);
  assert.match(source, /Source audit did not execute the required independent web-search step/);
});

test("quantitative-forensics prompt requires actual Python recalculation", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "prompts.ts"),
    "utf8",
  );

  assert.match(source, /You MUST use the python tool/);
  assert.match(source, /Do not claim a figure was reproduced unless the Python execution actually/);
  assert.match(source, /percent versus percentage-point changes/);
});

test("quantitative findings and verified tool use are persisted separately", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
    "utf8",
  );

  assert.match(source, /quantitativeForensics:\s*output\.quantitative_forensics/);
  assert.match(source, /quantitativeToolVerification/);
  assert.match(source, /callCount:\s*codeInterpreterUsage\.callCount/);
  assert.match(source, /completedCallCount/);
  assert.match(source, /codePresentCallCount/);
  assert.match(source, /calls:\s*codeInterpreterUsage\.calls/);
});
