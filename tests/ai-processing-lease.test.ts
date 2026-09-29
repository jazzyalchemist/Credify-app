import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_PROCESSING_LEASE_MS,
  aiProcessingLeaseExpired,
} from "../lib/db/ai-jobs";

test("AI processing lease does not expire active work prematurely", () => {
  const now = Date.now();
  assert.equal(
    aiProcessingLeaseExpired(
      { status: "PROCESSING", updated_at: new Date(now - 60_000) },
      now,
    ),
    false,
  );
});

test("AI processing lease expires work stuck beyond ten minutes", () => {
  const now = Date.now();
  assert.equal(
    aiProcessingLeaseExpired(
      {
        status: "PROCESSING",
        updated_at: new Date(now - AI_PROCESSING_LEASE_MS - 1),
      },
      now,
    ),
    true,
  );
});

test("processing lease helper never expires non-processing jobs", () => {
  const now = Date.now();
  assert.equal(
    aiProcessingLeaseExpired(
      {
        status: "IN_PROGRESS",
        updated_at: new Date(now - AI_PROCESSING_LEASE_MS * 10),
      },
      now,
    ),
    false,
  );
});
