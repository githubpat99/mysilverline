import type { ProfileV2 } from "@/lib/types/v2/profile";
import type { PositionDTO } from "@/lib/types/v2/positions.dto"; // anpassen an deinen Pfad
import { getPositions } from "@/lib/api/positionsApi";
export type LoadedDto = {
  profile: ProfileV2;
  positions: PositionDTO[];
};

export async function loadPositions(): Promise<PositionDTO[]> {
  return await getPositions();
}