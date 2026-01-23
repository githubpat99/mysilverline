import { loadProfileV2 } from "@/lib/profileApiV2";
import { loadPositions } from "@/lib/load/types";
import type { LoadedDto } from "@/lib/load/types";

export async function loadAllDto(): Promise<LoadedDto> {
  const [profileRes, positions] = await Promise.all([
    loadProfileV2(),
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
