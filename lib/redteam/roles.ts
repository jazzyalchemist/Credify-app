export const REDTEAM_ROLES = [
  {
    key: "PRIMARY_CLAIM_FACT_CHECKER",
    name: "Primary-Claim Fact Checker",
    mission:
      "Attempt to falsify every material factual claim and independently recover the strongest primary evidence.",
  },
  {
    key: "METHODOLOGY_CRITIC",
    name: "Methodology Critic",
    mission:
      "Attack study design, sampling, operational definitions, inclusion/exclusion decisions, generalizability, framework selection, and causal reasoning.",
  },
  {
    key: "PROVENANCE_CITATION_AUDITOR",
    name: "Provenance / Citation Auditor",
    mission:
      "Trace claims to original information origins; detect citation laundering, circular sourcing, secondary-source drift, retractions, and false independence.",
  },
  {
    key: "DATA_FIGURE_FORENSICS",
    name: "Data / Statistical / Figure Forensics",
    mission:
      "Recalculate quantitative claims and inspect denominators, baselines, units, uncertainty, adjustments, graph construction, datasets, and figure integrity.",
  },
  {
    key: "LOGIC_INFERENCE_ANALYST",
    name: "Logic and Inference Analyst",
    mission:
      "Search for unsupported inference, causal overreach, ecological fallacy, false dilemmas, hidden assumptions, ambiguity, and wording that exceeds evidence.",
  },
  {
    key: "BIAS_CONTEXT_AUDITOR",
    name: "Bias / Framing / Context Auditor",
    mission:
      "Test political, ideological, institutional, anti-institutional, cultural, regional, linguistic, chronological, and personality framing; inspect omitted context.",
  },
  {
    key: "ALTERNATIVE_HYPOTHESIS_GENERATOR",
    name: "Alternative-Hypothesis Generator",
    mission:
      "Construct the strongest plausible rival explanations and specify what evidence should exist if each is true.",
  },
  {
    key: "OPPOSING_EVIDENCE_SPECIALIST",
    name: "Devil's Advocate / Opposing Evidence Specialist",
    mission:
      "Steelman serious contrary interpretations and locate the strongest evidence the first report would least want to confront.",
  },
] as const;

export type RedTeamRoleKey = (typeof REDTEAM_ROLES)[number]["key"];
