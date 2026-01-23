import type { PositionDTO } from "@/lib/types/v2/positions.dto";

const NS = "/wp-json/silverline/v1";

type GetOut = { ok: true; positions: PositionDTO[] };
type ReplaceIn = { positions: PositionDTO[] };
type ReplaceOut = { ok: true; positions: PositionDTO[] };

export async function getPositions(): Promise<PositionDTO[]> {
  const res = await fetch(`${NS}/positions`, {
    method: "GET",
    credentials: "include",
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`positions_get_failed:${res.status}`);
  const json = (await res.json()) as GetOut;
  return Array.isArray(json.positions) ? json.positions : [];
}

export async function replacePositions(params: {
  positions: PositionDTO[];
  nonce: string;
}): Promise<PositionDTO[]> {
  const res = await fetch(`${NS}/positions/replace`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-WP-Nonce": params.nonce,
    },
    body: JSON.stringify({ positions: params.positions } satisfies ReplaceIn),
  });
  if (!res.ok) throw new Error(`positions_replace_failed:${res.status}`);
  const json = (await res.json()) as ReplaceOut;
  return Array.isArray(json.positions) ? json.positions : [];
}
