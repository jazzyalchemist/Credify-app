import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("frozen dossier export re-verifies canonical SHA-256 before serving", () => {
  const route = fs.readFileSync(
    path.join(
      process.cwd(),
      "app",
      "api",
      "investigations",
      "[id]",
      "dossier",
      "download",
      "route.ts",
    ),
    "utf8",
  );

  assert.match(route, /canonicalJsonString/);
  assert.match(route, /createHash\("sha256"\)/);
  assert.match(route, /recomputed !== investigation\.pre_redteam_snapshot_hash/);
  assert.match(route, /integrity verification failed/i);
  assert.match(route, /X-Credify-SHA256/);
  assert.match(route, /Cache-Control.*private, no-store/s);
});
