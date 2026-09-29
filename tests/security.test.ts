import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { safeInternalPath } from "../lib/auth/navigation";

test("login redirect sanitizer accepts only internal application paths", () => {
  assert.equal(
    safeInternalPath("/investigations/INV-1?tab=a#x"),
    "/investigations/INV-1?tab=a#x",
  );
  assert.equal(safeInternalPath("https://example.com"), "/investigations");
  assert.equal(safeInternalPath("//example.com/path"), "/investigations");
  assert.equal(safeInternalPath("javascript:alert(1)"), "/investigations");
  assert.equal(safeInternalPath(null), "/investigations");
});

test("private middleware protects runtime status and disables caching", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "middleware.ts"),
    "utf8",
  );
  assert.match(source, /"\/status"/);
  assert.match(source, /private, no-store, no-cache/);
});

test("authenticated investigation mutations reject explicit cross-site requests", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "middleware.ts"),
    "utf8",
  );
  assert.match(source, /Cross-site mutation request rejected/);
  assert.match(source, /sec-fetch-site/);
  assert.match(source, /request\.headers\.get\("origin"\)/);
});

test("Netlify sends transport and unnecessary-browser-capability hardening headers", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "netlify.toml"),
    "utf8",
  );
  assert.match(source, /Strict-Transport-Security/);
  assert.match(source, /Permissions-Policy/);
  assert.match(source, /X-Frame-Options = "DENY"/);
});
