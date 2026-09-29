import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { extractArtifactMetadata } from "../lib/artifacts/metadata";

test("non-image artifacts report metadata as not applicable", async () => {
  const result = await extractArtifactMetadata(
    "application/pdf",
    new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
  );
  assert.equal(result.status, "NOT_APPLICABLE");
  assert.deepEqual(result.metadata, {});
});

test("unsupported image formats are explicit rather than silently treated as no metadata", async () => {
  const result = await extractArtifactMetadata(
    "image/webp",
    new Uint8Array([0x52, 0x49, 0x46, 0x46]),
  );
  assert.equal(result.status, "NOT_SUPPORTED");
  assert.equal(result.parser, "exifr@7.1.3");
});

test("artifact upload persists metadata extraction state", () => {
  const source = fs.readFileSync(
    path.join(
      process.cwd(),
      "app",
      "api",
      "investigations",
      "[id]",
      "artifacts",
      "route.ts",
    ),
    "utf8",
  );

  assert.match(source, /extractArtifactMetadata/);
  assert.match(source, /metadataExtractionStatus/);
  assert.match(source, /metadataKeys/);
});

test("source audits receive server-extracted metadata with an anti-overclaim warning", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "ai", "prompts.ts"),
    "utf8",
  );

  assert.match(source, /Server-extracted metadata snapshot/);
  assert.match(source, /metadata may be absent, stripped, edited, copied, or forged/i);
});
