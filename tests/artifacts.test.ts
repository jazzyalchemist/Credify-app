import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  buildArtifactInputPart,
  inferArtifactMime,
  safeArtifactFilename,
} from "../lib/artifacts/content";
import {
  MAX_ARTIFACT_BYTES,
  MAX_ARTIFACT_COUNT,
  MAX_TOTAL_ARTIFACT_BYTES,
} from "../lib/db/artifacts";

test("artifact filename normalization strips paths and control characters", () => {
  assert.equal(
    safeArtifactFilename("../folder/evil\u0000report.pdf"),
    "evilreport.pdf",
  );
  assert.equal(
    safeArtifactFilename("C:\\temp\\  report   final.pdf"),
    "report final.pdf",
  );
});

test("artifact MIME inference handles common forensic inputs", () => {
  assert.equal(inferArtifactMime("paper.pdf", ""), "application/pdf");
  assert.equal(inferArtifactMime("photo.JPG", ""), "image/jpeg");
  assert.equal(
    inferArtifactMime("sheet.xlsx", "application/octet-stream"),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  assert.equal(
    inferArtifactMime("custom.bin", "application/x-custom"),
    "application/x-custom",
  );
});

test("artifact input parts preserve filename and high-detail visual review", () => {
  const base = {
    id: "ART-1",
    investigation_id: "INV-1",
    source_id: "SRC-1",
    role: "SUBMITTED_MATERIAL",
    byte_size: 3,
    sha256: "x",
    storage_provider: "NETLIFY_BLOBS",
    storage_key: "k",
    capture_method: "USER_UPLOAD",
    captured_at: new Date(),
    created_at: new Date(),
  };

  const pdf = buildArtifactInputPart(
    {
      ...base,
      original_filename: "paper.pdf",
      mime_type: "application/pdf",
    },
    new Uint8Array([1, 2, 3]),
  );
  assert.equal(pdf.type, "input_file");
  assert.equal(pdf.filename, "paper.pdf");
  assert.equal(pdf.detail, "high");

  const image = buildArtifactInputPart(
    {
      ...base,
      original_filename: "photo.png",
      mime_type: "image/png",
    },
    new Uint8Array([1, 2, 3]),
  );
  assert.equal(image.type, "input_image");
  assert.equal(image.detail, "high");
});

test("artifact limits stay below Netlify binary function request ceiling", () => {
  assert.equal(MAX_ARTIFACT_BYTES, 4 * 1024 * 1024);
  assert.equal(MAX_ARTIFACT_COUNT, 8);
  assert.equal(MAX_TOTAL_ARTIFACT_BYTES, 16 * 1024 * 1024);
});

test("artifact model analysis re-verifies SHA-256 and byte size", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "artifacts", "verified.ts"),
    "utf8",
  );
  assert.match(source, /createHash\("sha256"\)/);
  assert.match(source, /sha256 !== artifact\.sha256/);
  assert.match(source, /bytes\.byteLength !== Number\(artifact\.byte_size\)/);
  assert.match(source, /model analysis was blocked/);
});

test("artifact downloads re-verify raw bytes", () => {
  const source = fs.readFileSync(
    path.join(
      process.cwd(),
      "app",
      "api",
      "investigations",
      "[id]",
      "artifacts",
      "[artifactId]",
      "download",
      "route.ts",
    ),
    "utf8",
  );
  assert.match(source, /createHash\("sha256"\)/);
  assert.match(source, /sha256 !== artifact\.sha256/);
  assert.match(source, /X-Credify-SHA256/);
  assert.match(source, /private, no-store/);
});

test("submitted artifacts enter screening but are not presumed credible", () => {
  const prompts = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "prompts.ts"),
    "utf8",
  );
  assert.match(prompts, /storage-integrity verification only/i);
  assert.match(prompts, /do not treat user submission or a valid hash/i);

  const orchestrator = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "orchestrator.ts"),
    "utf8",
  );
  assert.match(orchestrator, /ensureArtifactSources/);
});

test("frozen dossier and reports preserve artifact provenance metadata", () => {
  const repository = fs.readFileSync(
    path.join(process.cwd(), "lib", "db", "repository.ts"),
    "utf8",
  );
  const reports = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "reports.ts"),
    "utf8",
  );

  assert.match(repository, /artifacts,/);
  assert.match(repository, /artifacts: artifacts\.length/);
  assert.match(reports, /sha256: artifact\.sha256/);
  assert.match(reports, /source_id: artifact\.source_id/);
});
