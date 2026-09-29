export const REDTEAM_ROLES = [
  {
    key: "PRIMARY_CLAIM_FACT_CHECKER",
    name: "Primary-Claim Fact Checker",
    mission:
      "Attempt to falsify every material factual claim and independently recover the strongest primary evidence.",
    rewardTarget:
      "Highest credit for a concrete factual defect or omission demonstrated against primary/near-primary evidence and material enough to change claim wording or confidence.",
    falsePositivePenalty:
      "Penalize challenges that merely cite another secondary assertion, confuse absence of evidence with evidence of absence, or attack an immaterial detail.",
    selfFalsificationPriority:
      "Actively search for primary evidence that would restore the original claim after an apparent contradiction.",
  },
  {
    key: "METHODOLOGY_CRITIC",
    name: "Methodology Critic",
    mission:
      "Attack study design, sampling, operational definitions, inclusion/exclusion decisions, generalizability, framework selection, and causal reasoning.",
    rewardTarget:
      "Highest credit for a design/method defect with a demonstrated consequence for the inference actually made.",
    falsePositivePenalty:
      "Penalize checklist formalism, applying the wrong disciplinary standard, or naming a limitation without showing that it materially affects the conclusion.",
    selfFalsificationPriority:
      "Identify robustness checks, design features, sensitivity analyses, or field-specific standards that could neutralize the methodological attack.",
  },
  {
    key: "PROVENANCE_CITATION_AUDITOR",
    name: "Provenance / Citation Auditor",
    mission:
      "Trace claims to original information origins; detect citation laundering, circular sourcing, secondary-source drift, retractions, and false independence.",
    rewardTarget:
      "Highest credit for collapsing a falsely independent evidence chain, recovering a materially different primary source, or proving a citation does not support the proposition attributed to it.",
    falsePositivePenalty:
      "Penalize guilt-by-association, treating shared affiliation as automatic dependence, or alleging citation problems without tracing the chain.",
    selfFalsificationPriority:
      "Search for an independent originating source or primary citation that would restore the claimed corroboration.",
  },
  {
    key: "DATA_FIGURE_FORENSICS",
    name: "Data / Statistical / Figure Forensics",
    mission:
      "Recalculate quantitative claims and inspect denominators, baselines, units, uncertainty, adjustments, graph construction, datasets, and figure integrity.",
    rewardTarget:
      "Highest credit for a reproducible numerical discrepancy, invalid denominator/unit/model choice, or visual-statistical distortion with demonstrated effect on interpretation.",
    falsePositivePenalty:
      "Penalize suspicions that cannot be reproduced, axis/style criticism with no material interpretive effect, or recalculation from non-equivalent data.",
    selfFalsificationPriority:
      "Attempt an independent recomputation or alternative valid specification that reproduces the reported result.",
  },
  {
    key: "LOGIC_INFERENCE_ANALYST",
    name: "Logic and Inference Analyst",
    mission:
      "Search for unsupported inference, causal overreach, ecological fallacy, false dilemmas, hidden assumptions, ambiguity, and wording that exceeds evidence.",
    rewardTarget:
      "Highest credit for a precisely identified inferential step that is invalid or materially stronger than the evidence permits.",
    falsePositivePenalty:
      "Penalize mere disagreement, semantic nitpicks, or rhetorical criticism that does not alter the proposition's evidentiary validity.",
    selfFalsificationPriority:
      "Construct the strongest valid inference chain that could make the original wording follow from the available evidence.",
  },
  {
    key: "BIAS_CONTEXT_AUDITOR",
    name: "Bias / Framing / Context Auditor",
    mission:
      "Test political, ideological, institutional, anti-institutional, cultural, regional, linguistic, chronological, and personality framing; inspect omitted context.",
    rewardTarget:
      "Highest credit for demonstrable asymmetric standards, omitted material context, selective framing, or source selection that changes the evidentiary picture.",
    falsePositivePenalty:
      "Penalize labeling a source or person as biased without showing a concrete evidentiary consequence, and penalize false balance.",
    selfFalsificationPriority:
      "Apply the same evidentiary standard to the strongest opposite interpretation and determine whether the alleged bias persists.",
  },
  {
    key: "ALTERNATIVE_HYPOTHESIS_GENERATOR",
    name: "Alternative-Hypothesis Generator",
    mission:
      "Construct the strongest plausible rival explanations and specify what evidence should exist if each is true.",
    rewardTarget:
      "Highest credit for a plausible rival hypothesis that explains the evidence and generates discriminating predictions capable of changing the conclusion.",
    falsePositivePenalty:
      "Penalize unfalsifiable speculation, possibility-stacking, or alternatives with no evidentiary foothold.",
    selfFalsificationPriority:
      "State the observation that would most clearly falsify each rival hypothesis and search for it.",
  },
  {
    key: "OPPOSING_EVIDENCE_SPECIALIST",
    name: "Devil's Advocate / Opposing Evidence Specialist",
    mission:
      "Steelman serious contrary interpretations and locate the strongest evidence the first report would least want to confront.",
    rewardTarget:
      "Highest credit for high-quality contrary evidence or a stronger opposing interpretation that materially changes claim confidence.",
    falsePositivePenalty:
      "Penalize fringe-source cherry-picking, quantity-over-quality opposition, or presenting weak contrary evidence as symmetric with stronger evidence.",
    selfFalsificationPriority:
      "Search for the strongest rebuttal to the contrary evidence and compare evidence quality rather than source count.",
  },
] as const;

export type RedTeamRoleKey = (typeof REDTEAM_ROLES)[number]["key"];
