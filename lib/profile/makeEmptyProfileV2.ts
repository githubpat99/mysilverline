// lib/profile/makeEmptyProfileV2.ts

import type { ProfileV2 } from "@/lib/types/v2";
import type { Person } from "@/lib/types/v2";

export function makeEmptyProfileV2(): ProfileV2 {
  const currentYear = new Date().getFullYear();

  const self: Person = {
    id: "self",
    role: "self",
    birthDate: `${currentYear - 40}-01-01`, // neutraler Platzhalter
    retireAtAge: 65,
  };

  return {
    household: {
      persons: [self],
      domicileCountry: "CH",
    },
    instruments: [],
   annualsV2: { income: [], expense: [] },
    events: [],
    meta: {
      startYear: currentYear,

      // NEW: Forecast-Horizont (Jahre ab Startjahr)
      // Default bewusst < "bis 95", damit auch <40-Jährige realistisch planen
      forecastHorizonYears: 55,
    },
  };
}
