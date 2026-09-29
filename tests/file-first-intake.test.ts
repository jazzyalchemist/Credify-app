import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const form = fs.readFileSync(
  path.join(process.cwd(), "components", "NewInvestigationForm.tsx"),
  "utf8",
);

test("new investigation can begin from files without pasted text", () => {
  assert.match(form, /!input\.trim\(\) && files\.length === 0/);
  assert.match(
    form,
    /Investigate the submitted artifact\(s\).*uploaded files are the primary submitted material/s,
  );
});

test("initial files use the canonical artifact upload endpoint", () => {
  assert.match(form, /new FormData\(\)/);
  assert.match(form, /form\.append\("file", file\)/);
  assert.match(form, /\/artifacts/);
});

test("file-first intake keeps server artifact limits visible client-side", () => {
  assert.match(form, /MAX_INITIAL_FILES = 8/);
  assert.match(form, /MAX_FILE_BYTES = 4 \* 1024 \* 1024/);
  assert.match(form, /MAX_TOTAL_INITIAL_BYTES = 16 \* 1024 \* 1024/);
  assert.match(form, /totalBytes > MAX_TOTAL_INITIAL_BYTES/);
  assert.match(form, /multiple/);
});

test("partial initial-upload failure preserves the created investigation for retry", () => {
  assert.match(form, /setCreatedInvestigationId\(investigationId\)/);
  assert.match(form, /failed to upload/);
  assert.match(form, /Open created investigation/);
  assert.doesNotMatch(form, /DELETE.*investigations/s);
});
