# Tennisteam App

Mobile-first Web-App fuer ein kleines Tennisteam mit zentraler Verfuegbarkeitsanzeige.

## Ziel

Die App ersetzt ein Google Sheet, in dem sich Teammitglieder fuer das woechentliche Training eintragen. Alle Beteiligten sehen dieselbe zentrale Information, koennen ihren Status aendern und erkennen sofort, ob genug Leute teilnehmen oder Ersatz gesucht wird.

## Produktidee

- Eine Trainingsgruppe
- Fester Wochentag, feste Uhrzeit, feste Dauer
- Zentrale Datenhaltung mit `MariaDB`
- Einfaches Backend, passend fuer klassisches Hosting
- Mobile first
- PWA-faehig
- So wenig Reibung wie moeglich
- Zielbild: Saisonplanung statt nur Einzeltermine

## Technischer Ansatz

- Frontend: kleine mobile Web-App / PWA
- Admin: eigene mobile Admin-Seite mit Token-Zugang
- Backend: leichtgewichtige JSON-API mit `PHP`
- Datenbank: `MariaDB`
- Zugriff: persoenliche Token-Links statt Passwort-Login in V1

## Datenbank-Empfehlung

- Bestehende DB auf dem Hosting: `y12er_WP1340630`
- Eigener Tabellenprefix fuer diese App: `wp_1340630_tt_`
- Dadurch bleiben WordPress- und Silverline-Tabellen sauber getrennt

## V1-Prinzipien

- Einfach vor vollstaendig
- Ein klarer Hauptfall statt viele Sonderfaelle
- So wenig Felder wie moeglich
- Kurze Interaktionswege auf dem Handy
- Gemeinsame Daten nur dort, wo noetig

## Kernnutzen

- Jede Person sieht sofort den aktuellen Stand
- Der eigene Status ist mit wenigen Taps gesetzt
- Keine chaotischen Tabellen mehr
- Besser lesbar und benutzbar auf dem Smartphone
- Perspektivisch: Planung fuer ganze Sommer- und Wintersaison

## Saisonlogik

Mittelfristig soll die App nicht nur den naechsten Termin zeigen, sondern die komplette Saisonansicht abbilden:

- `Sommer`: Mai bis September
- `Winter`: Oktober bis April

Ziel:

- Spieler tragen sich fruehzeitig fuer mehrere Wochen oder die ganze Saison ein
- Team sieht pro Termin sofort die Anzahl Zusagen und offene Rueckmeldungen
- Admin kann einzelne Wochen absagen oder mit Hinweisen versehen

Technische Richtung:

- eigene Tabelle `seasons`
- `sessions` werden einer Saison zugeordnet
- bestehende Live-DB wird ueber `sql/migrate_add_seasons.sql` erweitert
- Wochen-Termine koennen ueber `sql/generate_season_sessions.sql` automatisch erzeugt werden

## Dokumente

- `V1_SPEC.md`: Produktumfang, Rollen, Screens, API und Iterationen
- `admin.html`: erste Admin-Oberflaeche fuer Termine, Saisons, Event-Basis und Spieler-Tokens
- `doc/anleitung/neues-team.md`: interner Ablauf fuer Team- und Admin-Onboarding
- `doc/anleitung/website-tennisteam-snippet.html`: WordPress/HTML-Block fuer die oeffentliche Demo-Ansicht (Spieler-Link)
- `doc/anleitung/tools-silverline-snippet.html`: Tools-Uebersicht (Trainer + Tennisteam) fuer WordPress, Link zu `/tennisteam/`
- `sql/schema.sql`: Datenbankschema fuer `MariaDB`
- `sql/migrate_add_seasons.sql`: einmalige Migration fuer bestehende Live-Datenbank
- `sql/migrate_add_player_license_classification.sql`: Lizenz-Nr. und Klassierung auf `players`
- `sql/seed_example.sql`: Beispiel-Daten fuer lokalen Start
- `sql/generate_season_sessions.sql`: erzeugt Wochen-Termine fuer aktive Saisons
- `script/neuesteam/neuesteam.ps1`: erzeugt SQL + Mailtext fuer neue Teams
- `script/neuesteam/neueslivekundenteam.ps1`: erzeugt SQL + Mailtext fuer neue Live-Kundenteams
- `script/neuesteam/neuedemoteam.ps1`: erzeugt Demo-Team mit 4 Spielern
- `script/neuesteam/loeschteam.ps1`: erzeugt SQL zum sicheren Entfernen eines Teams
- `api/README.md`: geplanter API-Surface

## Qualitaet und Regression

- Fachlogik wird frueh in kleine testbare Regeln geschnitten
- Regressionstests laufen mit `vitest`
- Erste abgedeckte Regeln:
  - erlaubte Anwesenheitsstatus
  - Team-Zusammenfassung
  - Auswahl der relevanten Session
- Ziel: bei jeder Iteration bestehende Kernablaeufe absichern

## Deploy

Der Ordner enthaelt einfache Deploy-Skripte fuer das Hosting:

- `deploy.ps1`
- `deploy.sh`

Zielpfad:

- `/home/clients/cd018176a9efb9d6ecf8a0ae8be5e651/sites/mysilverline.it-pin.ch/htmltools/tennisteam`

Hinweise:

- einmalig auf der Datenbank `sql/migrate_season_player_exclusions.sql` ausfuehren, wenn Saison-Ausschluesse (Spieler ohne Saison-Zugang) genutzt werden sollen
- `config/database.php` wird mit deployed
- `README.md`, `V1_SPEC.md`, `sql/` und Testdateien werden nicht deployed
- Deploy nutzt bevorzugt vorhandene SSH-Keys wie `~/.ssh/id_ed25519_infomaniak` oder `~/.ssh/id_rsa_infomaniak`
- wenn kein passender Key gefunden wird, faellt das Script auf Passwort-Login zurueck
- Dry-Run:
  - `./deploy.ps1 --dry`
  - `./deploy.sh --dry`

## Debugging

- optional in `config/database.php`: `'debug' => true`
- Health-Check-Endpunkt:
  - `api/health.php`
- Admin-Dashboard:
  - `admin.html?token=...`
- Bei aktivem Debug liefern API-Fehler zusaetzlich:
  - Exception-Typ
  - Fehlermeldung
  - Datei
  - Zeile
- PowerShell-Testhelper:
  - `test-api.ps1`
  - Beispiele:
    - `./test-api.ps1 -Action health`
    - `./test-api.ps1 -Action session`
    - `./test-api.ps1 -Action sessions`
    - `./test-api.ps1 -Action response -Status yes -Comment "Bin dabei"`
    - `./test-api.ps1 -Action admin-session`

## Abgrenzung V1

Nicht Teil von V1:

- komplexes Benutzerkonto-System
- mehrere Teams in einer einzigen Oberflaeche
- Push-Benachrichtigungen
- Chat
- Kalender-Sync
- Statistik-Dashboard
- ausgefeilte Ersatzspieler-Boerse

## Erfolgskriterien

- Alle 8 Teammitglieder koennen ihren Status mobil setzen
- Der Gesamtstatus ist jederzeit eindeutig sichtbar
- Ein Admin kann Trainingsinfo oder Ausfall zentral pflegen
- Das Team kann das Google Sheet fuer den Hauptfall nicht mehr brauchen
