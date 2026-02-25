import type { FormState, AssetPosition, DebtPosition } from "@/lib/types";
import type { AnnualIncomeV2, AnnualExpenseV2 } from "@/lib/types/v2/annualsV2";
import type { ProfileEvent } from "@/lib/types/v2/events";

export type LifeTemplate = {
  id: string;
  label: string;
  description: string;
  icon: string;
  formState: FormState;
};

function rid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function forecastYearsUntilAge80(birthDate: string): number {
  const birthYear = Number(String(birthDate).slice(0, 4));
  if (!Number.isFinite(birthYear)) return 1;
  const years = 80 - (new Date().getFullYear() - birthYear);
  return Math.max(1, years);
}

function liquidityAsset(amountChf: number): AssetPosition {
  return {
    id: "liquidity",
    label: "Liquidität",
    amountChf,
    currency: "CHF",
    availability: "instant",
    assetClass: "bank",
    cashflowPa: 0,
    goal: "liq",
    isSystem: true,
  };
}

function asset(
  label: string,
  amountChf: number,
  assetClass: AssetPosition["assetClass"],
  availability: AssetPosition["availability"],
  goal: AssetPosition["goal"] = "reinvest",
): AssetPosition {
  return {
    id: rid(),
    label,
    amountChf,
    currency: "CHF",
    availability,
    assetClass,
    cashflowPa: 0,
    goal,
  };
}

function mortgage(
  balanceChf: number,
  interestRatePct: number,
): DebtPosition {
  return {
    id: rid(),
    label: "Hypothek",
    balanceChf,
    currency: "CHF",
    availability: "gt_3y",
    debtType: "mortgage",
    interestRatePct,
  };
}

function income(label: string, amountCHF: number): AnnualIncomeV2 {
  return { id: rid(), label, amountCHF, destination: "liquidity" };
}

function expense(label: string, amountCHF: number): AnnualExpenseV2 {
  return {
    id: rid(),
    label,
    amountCHF,
    fundingStrategy: "waterfall",
    fundingSources: [{ source: "liquidity" }],
  };
}

function oneOffSpendingEvent(title: string, amountCHF: number, startDate: string): ProfileEvent {
  return {
    client_id: `tpl_evt_${rid()}`,
    title,
    start_date: startDate,
    end_date: null,
    recurrence: "none",
    active: 1,
    meta_json: { notes: "" },
    line: {
      line_type: "spending",
      amount_chf: Math.trunc(amountCHF),
      indexation: null,
      category: null,
      meta_json: null,
      funding: {
        fundingStrategy: "waterfall",
        fundingSources: [{ source: "liquidity" }, { source: "short" }],
        minLiquidityCHF: 10000,
        allowLoanAsLastResort: true,
      },
    },
  };
}

export function getLifeTemplates(): LifeTemplate[] {
  const y = new Date().getFullYear();
  const singleJungBirthDate = `${y - 25}-06-15`;
  const single45BirthDate = `${y - 45}-03-20`;
  const familie30BirthDate = `${y - 32}-08-10`;
  const familie50BirthDate = `${y - 50}-11-05`;
  const pensionaerBirthDate = `${y - 67}-02-28`;

  return [
    {
      id: "single-jung",
      label: "Single jung (25)",
      description: "Berufseinstieg, erste Ersparnisse, keine grossen Verpflichtungen.",
      icon: "🎓",
      formState: {
        base: {
          birthDate: singleJungBirthDate,
          forecastHorizonYears: forecastYearsUntilAge80(singleJungBirthDate),
          retireAtAge: 65,
        },
        step1: {
          positions: [
            liquidityAsset(15_000),
            asset("Säule 3a", 8_000, "pension", "locked"),
          ],
        },
        step2: { positions: [] },
        step3: {
          annualsV2: {
            income: [income("Erwerbseinkommen", 72_000)],
            expense: [expense("Lebenshaltung", 54_000)],
          },
          events: [],
        },
      },
    },
    {
      id: "single-45",
      label: "Single 45+",
      description: "Etabliert, Eigentumswohnung, solides Wertschriften-Portfolio.",
      icon: "💼",
      formState: {
        base: {
          birthDate: single45BirthDate,
          forecastHorizonYears: forecastYearsUntilAge80(single45BirthDate),
          retireAtAge: 65,
        },
        step1: {
          positions: [
            liquidityAsset(45_000),
            asset("Wertschriften", 120_000, "securities", "gt_3y"),
            asset("Eigentumswohnung", 650_000, "real_estate", "locked"),
          ],
        },
        step2: { positions: [mortgage(450_000, 1.8)] },
        step3: {
          annualsV2: {
            income: [income("Erwerbseinkommen", 115_000)],
            expense: [expense("Lebenshaltung", 80_000)],
          },
          events: [],
        },
      },
    },
    {
      id: "familie-30",
      label: "Familie 30+",
      description: "Junge Familie, Eigenheim, wachsende Ausgaben.",
      icon: "👨‍👩‍👧",
      formState: {
        base: {
          birthDate: familie30BirthDate,
          forecastHorizonYears: forecastYearsUntilAge80(familie30BirthDate),
          retireAtAge: 65,
        },
        step1: {
          positions: [
            liquidityAsset(35_000),
            asset("Wertschriften", 25_000, "securities", "gt_3y"),
            asset("Eigenheim", 850_000, "real_estate", "locked"),
          ],
        },
        step2: { positions: [mortgage(680_000, 1.6)] },
        step3: {
          annualsV2: {
            income: [income("Haushaltseinkommen", 140_000)],
            expense: [expense("Lebenshaltung", 110_000)],
          },
          events: [
            oneOffSpendingEvent("Unerwartete Familienausgabe", 130_000, "2029-01-01"),
          ],
        },
      },
    },
    {
      id: "familie-50",
      label: "Familie 50+",
      description: "Kinder aus dem Haus, Hypothek reduziert, Vorsorge im Fokus.",
      icon: "🏠",
      formState: {
        base: {
          birthDate: familie50BirthDate,
          forecastHorizonYears: forecastYearsUntilAge80(familie50BirthDate),
          retireAtAge: 65,
        },
        step1: {
          positions: [
            liquidityAsset(75_000),
            asset("Wertschriften", 250_000, "securities", "gt_3y"),
            asset("Eigenheim", 950_000, "real_estate", "locked"),
          ],
        },
        step2: { positions: [mortgage(350_000, 1.5)] },
        step3: {
          annualsV2: {
            income: [income("Haushaltseinkommen", 170_000)],
            expense: [expense("Lebenshaltung", 115_000)],
          },
          events: [],
        },
      },
    },
    {
      id: "pensionaer",
      label: "Pensionär (67)",
      description: "Im Ruhestand, AHV + Pensionskasse, Eigenheim abbezahlt bis auf Rest.",
      icon: "🌅",
      formState: {
        base: {
          birthDate: pensionaerBirthDate,
          forecastHorizonYears: forecastYearsUntilAge80(pensionaerBirthDate),
          retireAtAge: 65,
        },
        step1: {
          positions: [
            liquidityAsset(120_000),
            asset("Wertschriften", 350_000, "securities", "gt_3y"),
            asset("Eigenheim", 800_000, "real_estate", "locked"),
          ],
        },
        step2: { positions: [mortgage(200_000, 1.4)] },
        step3: {
          annualsV2: {
            income: [income("AHV + Pensionskasse", 78_000)],
            expense: [expense("Lebenshaltung", 62_000)],
          },
          events: [],
        },
      },
    },
  ];
}
