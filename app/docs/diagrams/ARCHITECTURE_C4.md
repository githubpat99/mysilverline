
---

## `ARCHITECTURE_C4.md`

```markdown
# Silverline – Architektur
```
---
### Related diagrams
- [Finance Init – UI ready](financeInit.md)
- [Finance Save](financeSave.md)
- [Finance Next (best-effort)](financeNext.md)
---

## Golden rules (must not be broken)

- Single Source of Truth: ProfileV2 (server) + local in-memory copy in /finance.
- Auth: WP cookies + X-WP-Nonce (wp_rest). Some endpoints allow cookie fallback (see API_CONTRACTS.md).
- Forecast engine is pure/deterministic: no IO, no date/time randomness, same input => same output.
- Money: store CHF as integers (no floats). Conversions use trunc/round rule consistently.
- Workflow: "Next" is best-effort (may advance step even if save fails), but must surface saveError.
- Invariants: liquidity must never be negative; debt servicing follows defined source instrument(s). See INVARIANTS.md.

## C4 – Context

```mermaid
C4Context
title Silverline – System Context

Person(user, "User", "Erfasst Finanzdaten, nutzt Forecast & Lotto")
System(silverline, "Silverline Web App", "FinWF (SoT), Forecast, Lotto Overlay")
System_Ext(wp, "WordPress + Silverline API", "REST, Auth, Persistenz")
System_Ext(db, "MariaDB", "sl_finance_profile")
System_Ext(local, "Browser Storage", "Lotto Draft (lokal)")

Rel(user, silverline, "Nutzt", "HTTPS")
Rel(silverline, wp, "Liest/schreibt Profil", "REST + credentials + X-WP-Nonce")
Rel(wp, db, "Persistiert Daten", "SQL")
Rel(silverline, local, "Speichert Lotto-Szenario", "localStorage")
```

```mermaid
C4Container
title Silverline – Container

Person(user, "User", "UI Nutzer")

System_Boundary(s1, "Silverline") {
  Container(ui, "Next.js Frontend", "TypeScript", "UI, Validation, Mapping, Forecast")
  Container(lotto, "Lotto Draft Store", "Browser Storage", "Szenario-Overlay (lokal)")
}

System_Boundary(s2, "WordPress") {
  Container(api, "Silverline WP REST API Plugin", "PHP", "Auth/Nonce, Normalisierung, /profile GET/POST")
}

ContainerDb(finDB, "MariaDB", "sl_finance_profile", "Persistierter FormState (FinWF)")

Rel(user, ui, "Bedient", "HTTPS")
Rel(ui, api, "loadProfile/saveProfile", "REST + credentials + X-WP-Nonce")
Rel(api, finDB, "SELECT/UPDATE", "SQL")
Rel(ui, lotto, "load/save draft", "localStorage")
```

```mermaid
C4Component
title Silverline – Components

System_Boundary(frontend, "Next.js Frontend") {
  Component(pages, "Pages", "React", "/finance /lotto /forecast /summary")
  Component(forms, "Step Forms", "React", "Bearbeiten FormState")
  Component(validation, "Validation", "TypeScript", "validateStep()")
  Component(apiClient, "profileApi.ts", "TypeScript", "Nonce, Retry, load/save")
  Component(mapping, "financeMapping.ts", "TypeScript", "FormState -> ForecastInput")
  Component(engine, "computeForecast.ts", "TypeScript", "ForecastInput -> ForecastPoint[] (pure)")
  Component(lottoPersist, "lotto/persist.ts", "TypeScript", "Local scenario persist")
}

System_Boundary(backend, "WP Plugin (silverline-api.php)") {
  Component(routes, "REST Routes", "PHP", "/nonce /whoami /profile /profile/reset")
  Component(auth, "Permission/Auth", "PHP", "login + wp_verify_nonce('wp_rest')")
  Component(norm, "Normalization", "PHP", "Ranges/Enums/Defaults/Money strings")
  Component(repo, "DB Access", "PHP", "$wpdb read/write sl_finance_profile")
}

ContainerDb(finDB, "MariaDB", "sl_finance_profile", "FinWF FormState")

Rel(pages, forms, "Komponiert")
Rel(forms, validation, "nutzt")
Rel(forms, apiClient, "saveProfile()", "HTTP")
Rel(apiClient, routes, "ruft auf", "REST")
Rel(routes, auth, "prüft")
Rel(routes, norm, "normalisiert")
Rel(norm, repo, "persistiert/liest")
Rel(repo, finDB, "SQL")

Rel(pages, apiClient, "loadProfile()", "REST")
Rel(pages, mapping, "baut ForecastInput", "in-memory")
Rel(mapping, engine, "computeForecast()", "in-memory")
Rel(pages, lottoPersist, "load/save draft", "localStorage")
```

### Core docs
- [BUSINESS_RULES](BUSINESS_RULES.md)
- [API Contracts](API_CONTRACTS.md)
- [Key files](KEY_FILES.md)
