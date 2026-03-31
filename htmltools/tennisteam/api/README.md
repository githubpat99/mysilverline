# API Scaffold

Diese API ist als leichtgewichtige `PHP`-JSON-API fuer klassisches Hosting gedacht.

## Geplante Endpunkte

- `GET api/session.php?token=...`
- `GET api/sessions.php?token=...`
- `POST api/response.php`
- `GET api/admin/dashboard.php?token=...`
- `GET api/admin/session.php?token=...`
- `POST api/admin/session-update.php`
- `POST api/admin/session-delete.php`
- `POST api/admin/team-save.php`
- `POST api/admin/season-save.php`
- `POST api/admin/player-save.php`

## Prinzipien

- keine Passwort-Logins in V1
- Identifikation ueber sichere Token-Links
- JSON rein, JSON raus
- vorbereitete SQL-Statements
- moeglichst kleiner Surface-Bereich
