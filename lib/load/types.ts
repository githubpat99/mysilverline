import type { ProfileV2 } from "@/lib/types/v2/profile";
import type { PositionDTO } from "@/lib/types/v2/positions.dto";
import { loadPositions as dataLoadPositions } from "@/lib/services/dataService";

export type LoadedDto = {
  profile: ProfileV2;
  positions: PositionDTO[];
};

/** @deprecated Use loadPositions from dataService via loadAll */
export async function loadPositions(): Promise<PositionDTO[]> {
  return dataLoadPositions();
}