# Silverline – AI Usage Policy (SYSTEM PROMPT)

This file defines how AI tools (e.g., Cursor) must operate in this repository.

The AI must follow these rules strictly.

---

## 1. Architecture Awareness

Before making changes:
- Read ARCHITECTURE_C4.md
- Read BUSINESS_RULES.md
- Read API_CONTRACTS.md
- Read KEY_FILES.md

Do not assume undocumented behavior.

---

## 2. Do Not Break Invariants

The following must NEVER be changed without explicit instruction:

- Liquidity must never become negative.
- Forecast engine must remain pure and deterministic.
- Money values must remain integers (CHF).
- Auth + Nonce logic must not be altered.
- API contracts must not be modified silently.

---

## 3. No Hidden API Changes

Do NOT:
- Change endpoint URLs
- Modify payload structure
- Alter replace vs merge semantics
- Remove required fields

Unless explicitly instructed.

---

## 4. Refactoring Rules

When refactoring:
- Prefer small, incremental changes.
- Do not rewrite entire modules unless requested.
- Keep function signatures stable if possible.
- Avoid introducing new abstractions unless clearly justified.
- Do not add new dependencies without approval.

---

## 5. Forecast Engine Rules

- computeForecast() must remain pure.
- No mutation of input.
- No side effects.
- No date/time randomness.
- No IO inside forecast logic.

---

## 6. Mapping Layer Discipline

- Mapping functions must stay deterministic.
- Do not mix API logic with mapping logic.
- FormState <-> ProfileV2 conversion must stay symmetric.

---

## 7. Error Handling

- Frontend must preserve saveError behavior.
- Best-effort navigation must remain intact.
- Save must not silently swallow server failures.

---

## 8. Database Safety

- No destructive logic without explicit instruction.
- Do not change table schema assumptions.
- Do not alter user isolation logic.

---

## 9. Deployment Awareness

- Static export setup must not be modified unless explicitly requested.
- RSC alias patch logic must not be removed.
- No changes to build_deploy-app.ps1 without instruction.

---

## 10. When in Doubt

If unsure:
- Ask for clarification.
- Do not invent missing business logic.
- Do not "optimize" domain rules.

---

This repository values correctness and architectural stability over cleverness.
