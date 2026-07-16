# Tennisteam — AI Entry Point

Mobile Web-App für Tennisteam-Anwesenheit: Spieler-UI (`index.html`), Admin-UI (`admin.html`), PHP-JSON-API, MariaDB.

## Pflichtlektüre vor Änderungen

1. [doc/ARCHITECTURE.md](doc/ARCHITECTURE.md) — Schichten, Endpoints, Datenfluss
2. [domain.ts](domain.ts) — portable Domain-Regeln (Single Source of Truth für neue Regeln)
3. [sql/schema.sql](sql/schema.sql) — Datenmodell
4. [V1_SPEC.md](V1_SPEC.md) — Produktscope (teilweise historisch, siehe ARCHITECTURE für Ist-Stand)

Cursor Rules (automatisch in diesem Workspace): `.cursor/rules/*.mdc`

## Workspace öffnen

**Nur Tennisteam** (empfohlen):

1. **File → Open Workspace from File…** → `tennisteam.code-workspace` in diesem Ordner  
   **oder** **File → Open Folder…** → `c:\Users\patri\next-app\htmltools\tennisteam`

Nicht über Chat-Links — die funktionieren in Cursor nicht als Ordner-Öffnen.

## Architektur (Kurz)

```
index.html / admin.html  →  api/*.php  →  lib/team_data.php  →  MariaDB
                              ↑
                         lib/auth.php (Token → Kontext)
```

- **Auth:** Token-Links, kein Passwort. Helper: `requirePlayerContext*`, `requireAdminContext*` in [lib/auth.php](lib/auth.php).
- **JSON:** `{ success, data | error }` via [lib/json.php](lib/json.php).
- **SQL:** nur in [lib/team_data.php](lib/team_data.php).

## Domain-Regeln (Reihenfolge für neue Business-Logik)

1. Implementieren in [domain.ts](domain.ts)
2. Test in [domain.test.ts](domain.test.ts)
3. Vitest aus dem Parent-Repo (`next-app`):

```powershell
npm --prefix ../.. run test:run -- htmltools/tennisteam/domain.test.ts
```

4. Spiegeln in `team_data.php` (PHP)
5. UI ruft nur API — **keine** Regel-Duplikation in HTML/JS

## Einstiegspunkte

| Rolle | UI | API |
|-------|-----|-----|
| Spieler | `index.html?token=…` | `GET api/sessions.php` |
| Admin | `admin.html?token=…` | `GET api/admin/dashboard.php` |

## Tests

```powershell
# Unit (Domain) — Vitest liegt im Parent-Repo next-app
npm --prefix ../.. run test:run -- htmltools/tennisteam/domain.test.ts

# E2E (gemockte API)
npm --prefix ../.. run test:e2e -- tests/e2e/tennisteam.spec.ts tests/e2e/tennisteam-admin.spec.ts

# Manuell gegen Live/Staging (in diesem Ordner)
./test-api.ps1 -Action health
./test-api.ps1 -Action admin-dashboard
```

Siehe [doc/ARCHITECTURE.md#testing](doc/ARCHITECTURE.md) für Teststrategie.

## Verboten ohne explizite Anweisung

- Neue Endpoints ohne `api/README.md` + `test-api.ps1`
- Business-Logik in `index.html` / `admin.html`
- SQL außerhalb `team_data.php`
- Neue npm-Dependencies nur für Tennisteam

## Deploy

[deploy.ps1](deploy.ps1) / [deploy.sh](deploy.sh) — rsync/scp zu Infomaniak-Hosting.
