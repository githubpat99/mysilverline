// src/lib/lotto/persist.ts
import type { Model1DraftState } from "./types";

export const LOTTO_DRAFT_KEY = "sl_lotto_model1_draft_v1";

export function loadLottoDraft(): Model1DraftState | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(LOTTO_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Model1DraftState) : null;
  } catch {
    return null;
  }
}

export function saveLottoDraft(draft: Model1DraftState): void {
  try {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(LOTTO_DRAFT_KEY, JSON.stringify(draft));
  } catch {}
}

export function clearLottoDraft(): void {
  try {
    sessionStorage.removeItem(LOTTO_DRAFT_KEY);
  } catch {}
}
