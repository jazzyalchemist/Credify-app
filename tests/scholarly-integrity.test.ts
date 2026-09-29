import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { extractDoi } from "../lib/scholarly/crossref";

test("DOI extraction normalizes raw DOI and doi.org URLs", () => {
  assert.equal(
    extractDoi("10.1177/17588359231172420"),
    "10.1177/17588359231172420",
  );
  assert.equal(
    extractDoi("https://doi.org/10.1128/mbio.01735-25"),
    "10.1128/mbio.01735-25",
  );
  assert.equal(
    extractDoi("See DOI: 10.1021/AM300292V."),
    "10.1021/am300292v",
  );
  assert.equal(extractDoi("https://example.com/article"), null);
});

test("source audit persists independent scholarly registry verification", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "page1-orchestrator.ts"),
    "utf8",
  );

  assert.match(source, /verifyCrossrefStatus/);
  assert.match(source, /scholarlyRegistryVerification/);
  assert.match(source, /Crossref\/Retraction Watch reports a registered retraction/);
  assert.match(source, /not proof that no correction or concern exists/);
});

test("Crossref helper preserves no-DOI and unavailable states instead of asserting clean status", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "scholarly", "crossref.ts"),
    "utf8",
  );

  assert.match(source, /status: "NO_DOI"/);
  assert.match(source, /status: "NOT_FOUND"/);
  assert.match(source, /status: "UNAVAILABLE"/);
  assert.match(source, /absence of an update is not proof/i);
});

test("Crossref helper inspects both update-to and updated-by registry relationships", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "scholarly", "crossref.ts"),
    "utf8",
  );

  assert.match(source, /message\["update-to"\]/);
  assert.match(source, /message\["updated-by"\]/);
  assert.match(source, /update\.type === "retraction"/);
});
