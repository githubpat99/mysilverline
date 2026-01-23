// lib/mapping/positions/index.ts
import type { PositionDTO } from "@/lib/types/v2/positions.dto";
import type { Instrument } from "@/lib/types/v2/instruments";

import { dtoAssetToInstrument } from "./asset.dtoToInstrument";
import { dtoDebtToInstrument } from "./debt.dtoToInstrument";

import { instrumentAssetToDto } from "./asset.instrumentToDto";
import { instrumentDebtToDto } from "./debt.instrumentToDto";

export function dtoToInstrument(p: PositionDTO): Instrument {
  return p.kind === "asset" ? dtoAssetToInstrument(p) : dtoDebtToInstrument(p);
}

export function dtosToInstruments(ps: PositionDTO[] | null | undefined): Instrument[] {
  if (!Array.isArray(ps)) return [];
  return ps
    .filter((x): x is PositionDTO => !!x && (x.kind === "asset" || x.kind === "debt"))
    .map(dtoToInstrument);
}

export function instrumentToDto(i: Instrument): PositionDTO {
  return i.kind === "asset" ? instrumentAssetToDto(i) : instrumentDebtToDto(i);
}

export function instrumentsToDtos(xs: Instrument[] | null | undefined): PositionDTO[] {
  if (!Array.isArray(xs)) return [];
  return xs
    .filter((x): x is Instrument => !!x && (x.kind === "asset" || x.kind === "debt"))
    .map(instrumentToDto);
}
