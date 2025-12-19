import type { StepId } from "./types";

export const STEP_ORDER: StepId[] = [1, 2, 3, 4, 5, 6];

export const STEP_TITLES: Record<StepId, string> = {
  1: "Vermögen & Liquidität",
  2: "Schulden & Hypotheken",
  3: "Zukünftige Ein-/Ausgaben",
  4: "Anlageziel & Risiko",
  5: "Bevorzugt / vermeiden",
  6: "Mindestliquidität & Sparrate",
};
