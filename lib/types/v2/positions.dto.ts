export type Bucket = "instant" | "3m_3y" | "gt_3y" | "locked";

export type AssetDTO = {
  id: string;                 // instrument_id (stabil)
  kind: "asset";
  label: string;
  bucket?: Bucket | null;
  assetType: string;
  valueCHF: number;

  annualFlowCHF?: number | null;
  availability?: any;

  // NEW:
  source_account_key?: string | null;
  target_account_key?: string | null;

  note?: string | null;
};

export type DebtDTO = {
  id: string;
  kind: "debt";
  label: string;
  bucket?: Bucket | null;
  debtType: string;
  valueCHF: number;
  
  interestRatePct?: number | null;
  amortization?: any;
  availability?: any;

  // NEW:
  source_account_key?: string | null;
  target_account_key?: string | null;

  note?: string | null;
};

export type PositionDTO = AssetDTO | DebtDTO;

export type PositionsGet = { ok: true; positions: PositionDTO[] };
export type PositionsReplacePost = { ok: true; positions: PositionDTO[] };
