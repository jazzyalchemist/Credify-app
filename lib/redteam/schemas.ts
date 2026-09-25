export const REDTEAM_REVIEW_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    challenges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claim_id: { type: "string" },
          attack_method: { type: "string" },
          finding: { type: "string" },
          evidence_urls: {
            type: "array",
            items: { type: "string" },
          },
          proposed_classification: {
            type: "string",
            enum: [
              "VALIDATED_ERROR",
              "VALIDATED_OMISSION",
              "CONFIDENCE_OVERSTATEMENT",
              "METHODOLOGICAL_WEAKNESS",
              "SOURCE_INDEPENDENCE_FAILURE",
              "UNRESOLVED_CONFLICT",
            ],
          },
          proposed_claim_status: {
            type: "string",
            enum: ["UPHELD", "MODIFIED", "DISPROVEN", "UNCERTAIN"],
          },
          proposed_confidence: {
            type: "number",
            minimum: 0,
            maximum: 100,
          },
          rationale: { type: "string" },
          unresolved_questions: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [
          "claim_id",
          "attack_method",
          "finding",
          "evidence_urls",
          "proposed_classification",
          "proposed_claim_status",
          "proposed_confidence",
          "rationale",
          "unresolved_questions",
        ],
        additionalProperties: false,
      },
    },
    global_findings: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["summary", "challenges", "global_findings"],
  additionalProperties: false,
} as const;

export const RECONCILIATION_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    adjudications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          challenge_id: { type: "string" },
          classification: {
            type: "string",
            enum: [
              "VALIDATED_ERROR",
              "VALIDATED_OMISSION",
              "CONFIDENCE_OVERSTATEMENT",
              "METHODOLOGICAL_WEAKNESS",
              "SOURCE_INDEPENDENCE_FAILURE",
              "UNRESOLVED_CONFLICT",
              "CHALLENGE_REJECTED",
            ],
          },
          independently_reproduced: { type: "boolean" },
          adjudication: { type: "string" },
          evidence_for_refs: {
            type: "array",
            items: { type: "string" },
          },
          evidence_against_refs: {
            type: "array",
            items: { type: "string" },
          },
          revised_wording: { type: "string" },
          revised_confidence: {
            type: "number",
            minimum: 0,
            maximum: 100,
          },
          unresolved_issue: { type: "string" },
          rationale: { type: "string" },
        },
        required: [
          "challenge_id",
          "classification",
          "independently_reproduced",
          "adjudication",
          "evidence_for_refs",
          "evidence_against_refs",
          "revised_wording",
          "revised_confidence",
          "unresolved_issue",
          "rationale",
        ],
        additionalProperties: false,
      },
    },
    final_claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claim_id: { type: "string" },
          status: {
            type: "string",
            enum: ["UPHELD", "MODIFIED", "DISPROVEN", "UNCERTAIN"],
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 100,
          },
          wording: { type: "string" },
          rationale: { type: "string" },
        },
        required: [
          "claim_id",
          "status",
          "confidence",
          "wording",
          "rationale",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "adjudications", "final_claims"],
  additionalProperties: false,
} as const;
