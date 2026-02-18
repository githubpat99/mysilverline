// lib/types/v2/household.ts  (falls du die Types auch anpassen willst)
export type PersonRole = "self" | "partner" | "child";

export type Person = {
  id: string;
  role: PersonRole;
  firstName?: string;
  birthDate: string; // "YYYY-MM-DD"
  retireAtAge?: number;
};

export type Household = {
  persons: Person[];
  domicileCountry?: string;
};
