import type { InvestigationPhase } from "./protocol/types";

export const demoInvestigation = {
  title: "Credibility of a disputed causal claim",
  subtitle:
    "Demonstration workspace showing how Credify separates claims, evidence chains, and adversarial review.",
  currentPhase: "REDTEAM" as InvestigationPhase,
  completed: [
    "INTAKE",
    "IDENTIFICATION",
    "SCREENING",
    "ELIGIBILITY",
    "ANALYSIS",
    "SYNTHESIS",
    "PRE_REDTEAM",
  ] as InvestigationPhase[],
  metrics: {
    claims: 17,
    sources: 42,
    independentChains: 19,
    primaryRecovered: "14 / 16",
    unresolved: 2,
    redTeamChallenges: "3 / 19",
  },
  claims: [
    {
      id: "C-014",
      claim: "The available evidence establishes that X directly caused Y.",
      status: "MODIFIED",
      confidence: 78,
      before: 94,
      note: "Causality weakened after the methodology reviewer identified residual confounding.",
    },
    {
      id: "C-006",
      claim: "The reported dataset contains the stated year-over-year increase.",
      status: "UPHELD",
      confidence: 99,
      before: 98,
      note: "Underlying table recovered and independently recalculated.",
    },
    {
      id: "C-011",
      claim: "Three news outlets independently corroborated the event.",
      status: "DISPROVEN",
      confidence: 99,
      before: 87,
      note: "Two outlets ultimately trace to the same Reuters information origin.",
    },
  ],
};
