# next-app — AI Entry Point

Monorepo mit mehreren unabhängigen Teilprojekten. **Vor jeder Änderung** das richtige Teilprojekt wählen.

| Teilprojekt | Pfad | AI-Doku |
|-------------|------|---------|
| **Tennisteam** (Spieler/Admin) | [htmltools/tennisteam/](htmltools/tennisteam/) | [htmltools/tennisteam/AGENTS.md](htmltools/tennisteam/AGENTS.md) |
| **Silverline** (Finanz-PWA) | `app/`, `lib/` | [app/docs/diagrams/SYSTEM_PROMPT.md](app/docs/diagrams/SYSTEM_PROMPT.md) + [OFFLINE_ANALYSIS.md](OFFLINE_ANALYSIS.md) |
| Mediplan / Trainer | `htmltools/mediplan/`, `htmltools/trainer/` | README im jeweiligen Ordner |
| WordPress API | `BE_Copy/` | Plugin-Quellcode |

## Regel

**Nie** Silverline-Patterns in Tennisteam anwenden (und umgekehrt).

## Cursor Rules

Projektweite Regeln liegen in [.cursor/rules/](.cursor/rules/):

- `00-monorepo-boundaries.mdc` — immer aktiv
- `tennisteam-architecture.mdc` — bei `htmltools/tennisteam/**`
- `tennisteam-no-growth.mdc` — Anti-Bloat bei Tennisteam

## Tests (Repo-Root)

```bash
npm run test:run          # Vitest (Silverline + tennisteam/domain.test.ts)
npm run test:e2e          # Playwright
```

## Workspace

Code-Arbeit in **`next-app`** öffnen — nicht `.cursor/plans` (nur Plan-Dateien).
