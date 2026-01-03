# Silverline – Architekturübersicht

## Zielbild
- **FinWF (Finance-Workflow)** ist die Single Source of Truth für persönliche Finanzdaten.
- **Lotto** ist ein Szenario-Overlay (optional, lokal persistiert).
- **Forecast** ist eine reine Rechen- und Visualisierungsschicht (keine Persistenz).

---

## Systemüberblick (End-to-End)

```mermaid
flowchart LR
  U["User"] --> FE["Next.js Frontend"]
  FE --> API["WP REST API"]
  API --> DB["MariaDB sl_finance_profile"]
  FE --> LS["Lotto Draft localStorage"]
  FE --> MAP["financeMapping.ts"]
  MAP --> ENG["computeForecast.ts"]
  ENG --> CH["Forecast Chart"]
```

## Frontend – Verantwortlichkeiten

```mermaid
flowchart TD
  P["Pages"]
  F["Step Forms"]
  S["FormState"]
  V["validateStep"]
  A["profileApi.ts"]
  M["financeMapping.ts"]
  E["computeForecast.ts"]

  P --> F
  F --> S
  S --> V
  S --> A
  S --> M
  M --> E

```

## Backend – Verantwortlichkeiten

```mermaid
flowchart TD
  R["REST Routes"]
  AU["Auth + Nonce"]
  N["Normalization"]
  D["MariaDB"]

  R --> AU
  AU --> N
  N --> D
```

## Neues Feld einführen (Checkliste)

1) Types (StepXData + INITIAL_FORM)
2) UI (StepXForm)
3) Validation (validateStep)
4) DB (ALTER TABLE)
5) PHP Plugin (GET / POST / RESET + Normalizer)
6) Mapping (falls Forecast-relevant)
7) Forecast / Charts
