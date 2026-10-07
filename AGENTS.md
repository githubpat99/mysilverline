# next-app — AI Entry Point

## Einbindung in AI-Engineering-OS

Lies [globale AI-Basis](../../../AGENTS.md) und [Engineering-Ergänzungen](../../AGENTS.md) einmal, falls ihre Inhalte noch nicht geladen sind. Die Projektregeln und Teilprojektgrenzen in diesem Repository bleiben massgeblich für die konkrete technische Arbeit. Die [Engineering-Navigation](../../INDEX.md) nur bei unklarem Thema verwenden; bekannte Zieldateien direkt bearbeiten. Fachspezifikationen und aktuelle Projektstände bleiben hier, keine Parallelkopien in der Organisation pflegen.

Der kanonische Standort ist `C:\Users\patri\AI\AI-Engineering-OS\projects\next-app`. Bei Zugriff über den alten Verzeichnislink für die gemeinsame Basis die absoluten Pfade `C:\Users\patri\AI\AGENTS.md` und `C:\Users\patri\AI\AI-Engineering-OS\AGENTS.md` verwenden, falls relative Links nicht aufgelöst werden.

Fehlt der AI-Parent nach einem isolierten Clone, das kurz als fehlende OS-Einbindung kennzeichnen und mit den vorhandenen lokalen Projektregeln am beauftragten Ergebnis weiterarbeiten. Für die gemeinsame Basis AI/AGENTS.md und die Engineering-Ergänzungen auf dem Rechner bereitstellen. Keine Vollsuche anderer Projekte zum Start.

Monorepo mit mehreren unabhängigen Teilprojekten. **Vor jeder Änderung** das richtige Teilprojekt wählen.

| Teilprojekt | Pfad | AI-Doku |
|-------------|------|---------|
| **Tennisteam** (Spieler/Admin) | [htmltools/tennisteam/](htmltools/tennisteam/) | [htmltools/tennisteam/AGENTS.md](htmltools/tennisteam/AGENTS.md) |
| **Silverline** (Finanz-PWA) | `app/`, `lib/` | [app/docs/diagrams/SYSTEM_PROMPT.md](app/docs/diagrams/SYSTEM_PROMPT.md) + [OFFLINE_ANALYSIS.md](OFFLINE_ANALYSIS.md) |
| **Mediplan** | `htmltools/mediplan/` | [README.txt](htmltools/mediplan/README.txt) |
| **Trainer** | `htmltools/trainer/` | [Manifest](htmltools/trainer/manifest.webmanifest), [Anwendung](htmltools/trainer/index.html) |
| **Schulung** (offener Themenplatz) | `htmltools/schulung/` | Derzeit leer, kein Produktumfang definiert |
| **Silverline / WordPress API** | `BE_Copy/` | [Backend-Übersicht](BE_Copy/README.md), konkrete Plugin-Datei |

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
