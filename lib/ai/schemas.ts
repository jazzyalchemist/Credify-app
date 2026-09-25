export const DECOMPOSITION_SCHEMA = {
  type: "object",
  properties: {
    domain: {
      type: "string",
      enum: [
        "ACADEMIC",
        "NEWS",
        "HISTORICAL",
        "MEDIA",
        "CORPORATE",
        "OSINT",
        "MIXED",
      ],
    },
    research_questions: {
      type: "array",
      items: { type: "string" },
    },
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          claim_type: {
            type: "string",
            enum: [
              "FACTUAL",
              "STATISTICAL",
              "CAUSAL",
              "HISTORICAL",
              "INTERPRETIVE",
              "ALLEGATION",
              "OPINION",
            ],
          },
          requires_primary_evidence: { type: "boolean" },
          why_material: { type: "string" },
        },
        required: [
          "text",
          "claim_type",
          "requires_primary_evidence",
          "why_material",
        ],
        additionalProperties: false,
      },
    },
    search_strategy: {
      type: "object",
      properties: {
        languages: { type: "array", items: { type: "string" } },
        jurisdictions: { type: "array", items: { type: "string" } },
        evidence_streams: { type: "array", items: { type: "string" } },
        opposing_queries: { type: "array", items: { type: "string" } },
      },
      required: [
        "languages",
        "jurisdictions",
        "evidence_streams",
        "opposing_queries",
      ],
      additionalProperties: false,
    },
    known_ambiguities: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "domain",
    "research_questions",
    "claims",
    "search_strategy",
    "known_ambiguities",
  ],
  additionalProperties: false,
} as const;

export const DISCOVERY_SCHEMA = {
  type: "object",
  properties: {
    research_summary: { type: "string" },
    selected_sources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          url: { type: "string" },
          title: { type: "string" },
          source_type: {
            type: "string",
            enum: [
              "ACADEMIC",
              "DATASET",
              "NEWS",
              "ARCHIVE",
              "OFFICIAL",
              "WEB",
              "MEDIA",
            ],
          },
          primary_or_secondary: {
            type: "string",
            enum: ["PRIMARY", "SECONDARY", "UNKNOWN"],
          },
          claim_ids: {
            type: "array",
            items: { type: "string" },
          },
          evidence_role: {
            type: "string",
            enum: ["SUPPORTS", "CONTRADICTS", "CONTEXT", "PROVENANCE"],
          },
          selection_rationale: { type: "string" },
        },
        required: [
          "url",
          "title",
          "source_type",
          "primary_or_secondary",
          "claim_ids",
          "evidence_role",
          "selection_rationale",
        ],
        additionalProperties: false,
      },
    },
    contrary_evidence_sought: {
      type: "array",
      items: { type: "string" },
    },
    coverage_gaps: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "research_summary",
    "selected_sources",
    "contrary_evidence_sought",
    "coverage_gaps",
  ],
  additionalProperties: false,
} as const;
