export type ExerciseSuggestion = {
  id: string;
  name: string;
  usageCount: number;
  lastUsedAt: string;
  startingWeights: {
    value: string;
    unit: "LB" | "KG";
    variant: string;
    lastUsedAt: string;
  }[];
};
