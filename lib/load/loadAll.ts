import { loadProfile, loadPositions } from "@/lib/services/dataService";
import type { LoadedDto } from "@/lib/load/types";

export async function loadAllDto(): Promise<LoadedDto> {
  const [profileRes, positions] = await Promise.all([
    loadProfile(),
    loadPositions(),
  ]);

  if (!profileRes.ok || !profileRes.profile) {
    throw new Error("ProfileV2 load failed");
  }

  return {
    profile: profileRes.profile,
    positions,
  };
}
