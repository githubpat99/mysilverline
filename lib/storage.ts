import type { FormState, CompletionState } from "./types";

export const STORAGE_KEY = "silverline-form:v2";

export type Persisted = {
  schemaVersion: 2;
  form: FormState;
  completed: CompletionState;
  currentStep: number;
};

export function loadPersisted(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (parsed?.schemaVersion !== 2) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePersisted(data: Persisted): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
