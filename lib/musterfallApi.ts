import type { ProfileV2 } from "@/lib/types/v2";
import type { PositionDTO } from "@/lib/types/v2/positions.dto";
import { getApiHeaders } from "@/lib/profileApi";

const API_MUSTERFALL = "/wp-json/silverline/v1/musterfall";

export type MusterfallResponse = {
  ok: boolean;
  profile: ProfileV2;
  positions: PositionDTO[];
  can_edit: boolean;
};

export async function loadMusterfall(): Promise<MusterfallResponse> {
  const res = await fetch(API_MUSTERFALL, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json", ...getApiHeaders() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`musterfall_load_failed:${res.status}`);
  const json = (await res.json()) as MusterfallResponse;
  if (!json.ok || !json.profile || !Array.isArray(json.positions)) {
    throw new Error("musterfall_invalid_response");
  }
  return json;
}
