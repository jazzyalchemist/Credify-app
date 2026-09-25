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


const dimensionScore = (max: number) => ({
  type: "object",
  properties: {
    score: { type: "number", minimum: 0, maximum: max },
    rationale: { type: "string" },
  },
  required: ["score", "rationale"],
  additionalProperties: false,
});

export const CREDIBILITY_DIMENSION_SCHEMA = {
  type: "object",
  properties: {
    provenance_traceability: dimensionScore(12),
    author_expertise: dimensionScore(8),
    methodological_quality: dimensionScore(12),
    citation_integrity: dimensionScore(10),
    data_integrity: dimensionScore(10),
    independent_corroboration: dimensionScore(10),
    funding_conflicts: dimensionScore(8),
    transparency_reproducibility: dimensionScore(8),
    historical_cultural_temporal_context: dimensionScore(7),
    media_digital_authenticity: dimensionScore(5),
    corrections_research_integrity: dimensionScore(5),
    adversarial_resilience: dimensionScore(5),
  },
  required: [
    "provenance_traceability",
    "author_expertise",
    "methodological_quality",
    "citation_integrity",
    "data_integrity",
    "independent_corroboration",
    "funding_conflicts",
    "transparency_reproducibility",
    "historical_cultural_temporal_context",
    "media_digital_authenticity",
    "corrections_research_integrity",
    "adversarial_resilience",
  ],
  additionalProperties: false,
} as const;

export const SCREENING_SCHEMA = {
  type: "object",
  properties: {
    decisions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source_id: { type: "string" },
          decision: {
            type: "string",
            enum: ["INCLUDED", "EXCLUDED"],
          },
          reason: { type: "string" },
          potential_duplicate_of_source_id: { type: "string" },
        },
        required: [
          "source_id",
          "decision",
          "reason",
          "potential_duplicate_of_source_id",
        ],
        additionalProperties: false,
      },
    },
    screening_summary: { type: "string" },
    unresolved_retrieval_questions: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "decisions",
    "screening_summary",
    "unresolved_retrieval_questions",
  ],
  additionalProperties: false,
} as const;

export const SOURCE_AUDIT_SCHEMA = {
  type: "object",
  properties: {
    source_id: { type: "string" },
    retrieval_status: {
      type: "string",
      enum: ["RETRIEVED", "PARTIAL", "NOT_RETRIEVED"],
    },
    primary_or_secondary: {
      type: "string",
      enum: ["PRIMARY", "SECONDARY", "UNKNOWN"],
    },
    provenance_status: {
      type: "string",
      enum: ["VERIFIED", "PARTIAL", "FAILED"],
    },
    information_origin_url: { type: "string" },
    author: { type: "string" },
    institution: { type: "string" },
    author_expertise_summary: { type: "string" },
    institutional_analysis: { type: "string" },
    peer_review_status: { type: "string" },
    correction_retraction_status: { type: "string" },
    funding_conflicts: { type: "string" },
    methodology_summary: { type: "string" },
    citation_integrity_summary: { type: "string" },
    data_integrity_summary: { type: "string" },
    historical_cultural_temporal_context: { type: "string" },
    media_digital_authenticity_summary: { type: "string" },
    critical_failures: {
      type: "array",
      items: { type: "string" },
    },
    evidence_urls: {
      type: "array",
      items: { type: "string" },
    },
    dimension_scores: CREDIBILITY_DIMENSION_SCHEMA,
    overall_rationale: { type: "string" },
  },
  required: [
    "source_id",
    "retrieval_status",
    "primary_or_secondary",
    "provenance_status",
    "information_origin_url",
    "author",
    "institution",
    "author_expertise_summary",
    "institutional_analysis",
    "peer_review_status",
    "correction_retraction_status",
    "funding_conflicts",
    "methodology_summary",
    "citation_integrity_summary",
    "data_integrity_summary",
    "historical_cultural_temporal_context",
    "media_digital_authenticity_summary",
    "critical_failures",
    "evidence_urls",
    "dimension_scores",
    "overall_rationale",
  ],
  additionalProperties: false,
} as const;

export const SYNTHESIS_SCHEMA = {
  type: "object",
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claim_id: { type: "string" },
          first_pass_status: {
            type: "string",
            enum: [
              "VERIFIED",
              "HIGH_CONFIDENCE",
              "TENTATIVE",
              "UNKNOWN",
              "CONTRADICTED",
            ],
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 100,
          },
          evidence_source_ids: {
            type: "array",
            items: { type: "string" },
          },
          counterevidence_source_ids: {
            type: "array",
            items: { type: "string" },
          },
          reasoning: { type: "string" },
          known_unknowns: { type: "string" },
          additional_evidence_needed: { type: "string" },
          unresolved_material_conflict: { type: "boolean" },
          critical_failure: { type: "boolean" },
          dimension_scores: CREDIBILITY_DIMENSION_SCHEMA,
        },
        required: [
          "claim_id",
          "first_pass_status",
          "confidence",
          "evidence_source_ids",
          "counterevidence_source_ids",
          "reasoning",
          "known_unknowns",
          "additional_evidence_needed",
          "unresolved_material_conflict",
          "critical_failure",
          "dimension_scores",
        ],
        additionalProperties: false,
      },
    },
    executive_finding: { type: "string" },
    strongest_supporting_evidence: {
      type: "array",
      items: { type: "string" },
    },
    strongest_contrary_evidence: {
      type: "array",
      items: { type: "string" },
    },
    counter_hypotheses_tested: {
      type: "array",
      items: { type: "string" },
    },
    known_unknowns: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "claims",
    "executive_finding",
    "strongest_supporting_evidence",
    "strongest_contrary_evidence",
    "counter_hypotheses_tested",
    "known_unknowns",
  ],
  additionalProperties: false,
} as const;
