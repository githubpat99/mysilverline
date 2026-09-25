# Tennisteam API

Leichtgewichtige `PHP`-JSON-API für klassisches Hosting. Vollständige Architektur: [doc/ARCHITECTURE.md](../doc/ARCHITECTURE.md).

## Prinzipien

- Keine Passwort-Logins — Identifikation über Token-Links
- JSON rein, JSON raus: `{ "success": true, "data": … }` oder `{ "success": false, "error": "…" }`
- Auth zentral über [lib/auth.php](../lib/auth.php)
- SQL nur in [lib/team_data.php](../lib/team_data.php)
- Vorbereitete Statements

## Endpunkte (15)

### Spieler (`api/`)

| Endpoint | Methode | Auth | Zweck |
|----------|---------|------|-------|
| `health.php` | GET | — | DB-Verbindung und Tabellen-Check |
| `sessions.php` | GET | `?token=` | Saison + alle Sessions (Haupt-Einstieg Spieler); optional `season_id` |
| `session.php` | GET | `?token=` | Einzelne Session; optional `session_id` |
| `response.php` | POST | JSON `token`, `status` | Eigene Rückmeldung setzen/löschen; optional `comment`, `session_id`. Ein `comment` ohne `status` wird als „offen, aber Bemerkung" gespeichert (`attendance_status = NULL`, siehe `sql/migrate_responses_comment_without_status.sql`) |

### Admin (`api/admin/`)

| Endpoint | Methode | Auth | Zweck |
|----------|---------|------|-------|
| `dashboard.php` | GET | `?token=` | Aggregat-Dashboard (Haupt-Einstieg Admin); optional `season_id`, `session_id` |
| `session.php` | GET | `?token=` | Legacy: nächste Session; UI nutzt `dashboard.php` |
| `session-update.php` | POST | JSON `token` | Session-Felder partial update |
| `session-delete.php` | POST | JSON `token`, `session_id` | Session löschen |
| `response-save.php` | POST | JSON `token`, `session_id`, `player_id` | Admin setzt Spieler-Rückmeldung |
| `team-save.php` | POST | JSON `token`, `name` | Team name/location |
| `season-save.php` | POST | JSON `token` | Saison create/update; optional `generate_sessions`, `excluded_player_ids` |
| `season-delete.php` | POST | JSON `token`, `season_id` | Saison + Sessions löschen |
| `player-save.php` | POST | JSON `token`, `name` | Spieler create/update |
| `player-delete.php` | POST | JSON `token`, `player_id` | Spieler löschen |

## Smoke-Tests

```powershell
cd htmltools/tennisteam
./test-api.ps1 -Action health
./test-api.ps1 -Action sessions
./test-api.ps1 -Action admin-dashboard
./test-api.ps1 -Action invalid-player-token
```

## Attendance-Status

`yes`, `no`, `maybe`, `replacement`

## Session-Status

`scheduled`, `provisional`, `completed`, `cancelled`

## Saison-Typen

`summer`, `winter`, `interclub`, `custom`
