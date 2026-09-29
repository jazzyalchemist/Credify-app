import assert from "node:assert/strict";
import test from "node:test";
import {
  artifactSignatureCheck,
  inferArtifactMime,
} from "../lib/artifacts/content";

test("known filename extension is canonical over browser-supplied MIME", () => {
  assert.equal(
    inferArtifactMime("evidence.pdf", "text/plain"),
    "application/pdf",
  );
  assert.equal(
    inferArtifactMime("photo.png", "application/octet-stream"),
    "image/png",
  );
});

test("valid PNG magic bytes pass signature verification", () => {
  const bytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
  ]);
  const result = artifactSignatureCheck("image/png", bytes);
  assert.equal(result.checked, true);
  assert.equal(result.valid, true);
});

test("fake PDF bytes are rejected", () => {
  const bytes = new TextEncoder().encode("this is not a pdf");
  const result = artifactSignatureCheck("application/pdf", bytes);
  assert.equal(result.checked, true);
  assert.equal(result.valid, false);
});

test("text formats remain accepted without pretending to have magic-byte proof", () => {
  const bytes = new TextEncoder().encode("ordinary text");
  const result = artifactSignatureCheck("text/plain", bytes);
  assert.equal(result.valid, true);
  assert.equal(result.checked, false);
});
