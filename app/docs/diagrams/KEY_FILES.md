# Silverline – Key Files

This document helps navigation and refactoring.

---

## Frontend (Next.js)

### Finance Workflow
app/finance/page.tsx
- Controls currentStep
- Holds form + profileV2 state
- Handles Save / Next

app/finance/components/Step1..Step6
- Input forms
- Modify FormState

---

## Mapping

lib/mapping/mapV2ToFormState.ts
- ProfileV2 -> FormState

lib/mapping/mapFormStateToProfileV2.ts
- FormState -> ProfileV2

lib/mapping/positions/formStateToDtos.ts
- Mapping for positions endpoint

---

## Forecast

lib/forecast/engine/computeForecast.ts
- Pure function
- Input: ForecastInput
- Output: YearRow[]

lib/forecast/profileV2ToForecastInput.ts
- ProfileV2 -> ForecastInput

lib/forecast/buckets.ts
- Bucket definitions
- Availability mapping

---

## API Client

lib/profileApiV2.ts
- loadProfileV2()
- saveProfileV2()

---

## WordPress Plugin

wp-content/plugins/silverline-api/silverline-api.php
- Route registration
- Permission callbacks
- DB access

---

## Database

Table:
sl_finance_profile

Stores:
- Serialized ProfileV2
- User-linked

---

## Deployment

build_deploy-app.ps1
- Static export
- RSC alias patch
- WinSCP synchronize -delete

---

When refactoring:
- Always identify affected mapping layer
- Check BUSINESS_RULES.md
- Check API_CONTRACTS.md
