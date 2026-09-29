import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("source audit schema requires structured URL forensics", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "schemas.ts"),
    "utf8",
  );

  assert.match(source, /url_forensics/);
  assert.match(source, /canonical_page_finding/);
  assert.match(source, /archive_historical_version_finding/);
  assert.match(source, /redirect_lookalike_risk_finding/);
  assert.match(source, /unavailable_technical_checks/);
});

test("URL-forensics prompt forbids unsupported technical claims", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "prompts.ts"),
    "utf8",
  );

  assert.match(source, /Do NOT claim that Credify directly performed WHOIS\/RDAP/);
  assert.match(source, /Finding no archive\/search result is not proof/);
  assert.match(source, /current content from claims about what it said at an earlier/);
});

test("server binds URL-forensics applicability to parsed source identity", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
    "utf8",
  );

  assert.match(source, /function sourceUrlIdentity/);
  assert.match(source, /output\.url_forensics\.applicability !== "URL_SOURCE"/);
  assert.match(source, /output\.url_forensics\.applicability !== "NOT_APPLICABLE"/);
  assert.match(source, /urlIdentityVerification:\s*urlIdentity/);
});

test("URL findings survive into persisted credibility rationale", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
    "utf8",
  );

  assert.match(source, /urlForensics:\s*output\.url_forensics/);
});
