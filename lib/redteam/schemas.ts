import { CREDIBILITY_DIMENSION_SCHEMA } from "@/lib/ai/schemas";

export const REDTEAM_REVIEW_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    claim_reviews: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claim_id: { type: "string" },
          outcome: {
            type: "string",
            enum: [
              "SURVIVED_SCRUTINY",
              "CHALLENGED",
              "UNRESOLVED",
              "NOT_APPLICABLE_TO_ROLE",
            ],
          },
          attack_summary: { type: "string" },
          strongest_counterevidence_sought: { type: "string" },
          evidence_gap: { type: "string" },
          self_falsification_condition: { type: "string" },
        },
        required: [
          "claim_id",
          "outcome",
          "attack_summary",
          "strongest_counterevidence_sought",
          "evidence_gap",
          "self_falsification_condition",
        ],
        additionalProperties: false,
      },
    },
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
          evidence_strength: {
            type: "string",
            enum: [
              "DIRECT_PRIMARY",
              "INDEPENDENT_CORROBORATED",
              "SECONDARY",
              "METHODOLOGICAL_LOGICAL",
              "TENTATIVE",
            ],
          },
          materiality: {
            type: "string",
            enum: ["CRITICAL", "MATERIAL"],
          },
          self_falsification_condition: { type: "string" },
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
          "evidence_strength",
          "materiality",
          "self_falsification_condition",
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
  required: ["summary", "claim_reviews", "challenges", "global_findings"],
  additionalProperties: false,
} as const;

export const RECONCILIATION_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    investigation_dimension_scores: CREDIBILITY_DIMENSION_SCHEMA,
    investigation_critical_failures: {
      type: "array",
      items: { type: "string" },
    },
    investigation_rationale: { type: "string" },
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
  required: [
    "summary",
    "investigation_dimension_scores",
    "investigation_critical_failures",
    "investigation_rationale",
    "adjudications",
    "final_claims",
  ],
  additionalProperties: false,
} as const;
