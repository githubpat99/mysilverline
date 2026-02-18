# Silverline – Business Rules

This document defines domain invariants and rules that MUST NOT be broken.

---

## 1. Single Source of Truth

- ProfileV2 (server) is the canonical source of truth.
- The Finance Workflow operates on a local in-memory copy of ProfileV2.
- After successful save, serverProfile replaces local profile.

---

## 2. Liquidity Rules

- End-of-year liquidity (liq) must NEVER be negative.
- If liquidity would drop below 0:
  - A new short-term debt position must be created (if enabled).
  - OR execution must prevent negative state.
- Forecast must never silently allow negative liquidity.

---

## 3. Debt Servicing

- Each debt position may define:
  - interestRatePct
  - amortization { type, amountAnnualCHF, sourceInstrumentId }
- Interest and amortization may have a defined source instrument.
- Source instrument must exist.
- If source liquidity is insufficient, fallback logic must follow liquidity rules.

---

## 4. Forecast Engine

- computeForecast() must be PURE.
- No IO.
- No direct API calls.
- Same input must always produce same output.
- No mutation of input objects.

---

## 5. Money Handling

- All CHF values stored as integers.
- No floating-point persistence.
- Mapping functions must normalize monetary values.
- Rounding/truncation must be consistent.

---

## 6. Workflow Navigation

- "Next" is best-effort:
  - Step may advance even if save fails.
  - saveError must be set when save fails.
- "Save" must not advance step.
- Validation must block navigation when invalid.

---

## 7. Authentication

- Persistence only allowed for logged-in users.
- Nonce (wp_rest) must be validated for write operations.
- No write endpoint may allow anonymous access.

---

## 8. Deprecated Concepts

- instruments (v1 transport) are deprecated.
- Positions are handled via /positions endpoint.
- ProfileV2 no longer transports instruments array.

---

If a refactor touches any of these areas,
these rules MUST still hold.
