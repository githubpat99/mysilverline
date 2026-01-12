import type { StepId } from "./types";

export const STEP_ORDER: StepId[] = [1, 2, 3];

export const STEP_TITLES: Record<StepId, string> = {
  1: "Vermögen & Liquidität",
  2: "Schulden & Hypotheken",
  3: "Zukünftige Ein-/Ausgaben",
};
