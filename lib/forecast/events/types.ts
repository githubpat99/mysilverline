export type YearIndex = number; // 0 = heute, 1 = nächstes Jahr, ...

export type SegmentId = string;

export type Segment = {
  id: SegmentId;
  label: string;
  fromYear: YearIndex; // inkl.
  toYear: YearIndex;   // inkl.
};

export type ForecastEvent =
  | {
      id: string;
      kind: "one_time";
      label: string;
      year: YearIndex;
      amount: number; // + = income, - = expense
    }
  | {
      id: string;
      kind: "annual_delta";
      label: string;
      fromYear: YearIndex;
      deltaPerYear: number; // + = income up, - = expense up
      indexation?: "inflation" | "fixed_real" | "fixed_nominal";
    };
