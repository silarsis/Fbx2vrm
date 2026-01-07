export type ConfidenceLevel = "low" | "medium" | "high";

export type ConfidenceInputs = {
  name: number;
  structural: number;
  spatial: number;
  side: number;
};

const clampScore = (value: number) => Math.min(1, Math.max(0, value));

export const computeConfidence = (
  inputs: ConfidenceInputs,
): { score: number; level: ConfidenceLevel } => {
  const weights = {
    name: 0.6,
    structural: 0.2,
    spatial: 0.1,
    side: 0.1,
  } as const;

  const score = clampScore(
    inputs.name * weights.name +
      inputs.structural * weights.structural +
      inputs.spatial * weights.spatial +
      inputs.side * weights.side,
  );

  const level: ConfidenceLevel =
    score >= 0.75 ? "high" : score >= 0.5 ? "medium" : "low";

  return { score, level };
};
