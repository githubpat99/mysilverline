# Tennisteam V1 Spezifikation

## Dokumentationsstand

**Aktualisiert:** Saisonplanung, Session-Generierung, Spieler-Exclusions und erweiterte Admin-CRUD sind **implementiert** (nicht nur geplant). Technische Details und alle 15 API-Endpunkte: [doc/ARCHITECTURE.md](doc/ARCHITECTURE.md) und [api/README.md](api/README.md).

Historische Abschnitte unten (z. B. „Geplante Erweiterung: Saisonansicht“) beschreiben teils den ursprünglichen V1-Entwurf — bei Widersprüchen gilt ARCHITECTURE.md.

## 1. Zielbild

Die App soll einem kleinen Tennisteam helfen, die Anwesenheit fuer das woechentliche Training einfach und mobil zu pflegen. Alle sehen denselben aktuellen Stand. Jede Person kann den eigenen Status ohne komplizierten Login aendern.

## 2. Zielgruppe

- Ein kleines Tennisteam mit aktuell 8 Mitspielern
- Nutzung hauptsaechlich auf dem Smartphone
- Niedrige technische Huerde
- Fokus auf schnelle Statuspflege statt Verwaltungskomplexitaet

## 3. V1-Scope

### Enthalten

- Eine Trainingsgruppe
- Fester Trainingstermin pro Woche
- Naechste Trainingseinheit sichtbar
- Liste aller Spieler
- Status pro Spieler
- Optionaler Kurzkommentar pro Spieler
- Team-Uebersicht mit Anzahl Zusagen/Absagen
- Admin-Hinweis zum Termin
- Admin kann Termin als abgesagt markieren
- Zentral gespeicherte Daten in `MariaDB`
- Persoenliche Bearbeitungslinks fuer Spieler
- Separater Admin-Zugang per Token-Link
- **Saisonplanung:** Sommer-/Winter-/Interclub-Saisons, Session-Listen, Spieler-Exclusions pro Saison
- Admin-CRUD: Team, Saisons, Sessions, Spieler, Rückmeldungen

### Nicht enthalten (weiterhin)

- Registrierung mit Passwort
- Mehrere Teams in derselben App
- Rollenmodell ueber Admin/Spieler hinaus
- Push-Nachrichten
- E-Mail-Versand
- Kalender-Import
- automatische Ersatzspieler-Vermittlung
- historische Auswertungen

## 4. Kernablaeufe

### Spieler

1. Spieler oeffnet persoenlichen Link.
2. App zeigt naechstes Training mit Datum, Zeit und Ort.
3. Spieler sieht die aktuelle Teamliste.
4. Spieler setzt den eigenen Status.
5. Optional fuegt der Spieler einen kurzen Kommentar hinzu.
6. Alle sehen den aktualisierten Gesamtstand.

### Admin

1. Admin oeffnet Admin-Link.
2. Admin sieht den naechsten Termin.
3. Admin kann Hinweistext pflegen.
4. Admin kann Termin als abgesagt markieren.
5. Admin kann bei Bedarf Spielerstatus einsehen.

## 5. Statusmodell

Empfohlene Statuswerte fuer V1:

- `yes`: dabei
- `no`: abwesend
- `maybe`: unsicher
- `replacement`: Ersatz gesucht / Ersatz organisiert

Hinweis:
Falls `replacement` semantisch zu breit ist, spaeter aufteilen in:

- `replacement_needed`
- `replacement_found`

Fuer V1 ist ein einzelner Ersatz-Status einfacher.

## 6. Screens

### Screen A: Team-Uebersicht

Inhalt:

- Teamname
- Datum des naechsten Trainings
- Uhrzeit und Dauer
- Ort
- Admin-Hinweis oder Statusmeldung
- Zusammenfassung:
  - Anzahl dabei
  - Anzahl abwesend
  - Anzahl unsicher
  - Anzahl Ersatz

### Screen B: Spielerstatus

Inhalt:

- Eigener Name
- Aktueller Status
- Buttons fuer Statusauswahl
- Kommentarfeld
- Speichern-Bestaetigung

### Screen C: Admin-Ansicht

Inhalt:

- Termin aktiv / abgesagt
- Hinweis fuer alle
- Liste aller Antworten
- letzte Aenderungen

### Saisonansicht (implementiert)

Die App zeigt die Saisonansicht mit:

- aktuelle Saison oben (Auswahl mehrerer Saisons)
- Liste aller Trainingstermine der Saison
- Team-Zusammenfassung pro Termin
- eigener Status pro Termin
- Wechsel zwischen Saisons; Spieler können pro Saison ausgeschlossen sein (`season_player_exclusions`)

## 7. Rollen und Zugriff

### Spieler

- sieht den aktuellen Teamstatus
- kann nur den eigenen Status aendern
- kann den eigenen Kommentar aendern

### Admin

- sieht alles
- kann Termin-Hinweis pflegen
- kann Termin absagen oder wieder aktivieren
- kann Team-, Saison-, Session- und Spielerdaten verwalten
- kann Spieler pro Saison ausschliessen

## 8. Authentifizierung fuer V1

Keine klassische Registrierung.

Stattdessen:

- jeder Spieler erhaelt einen persoenlichen Token-Link
- der Link identifiziert den Spieler
- der Admin erhaelt einen separaten Admin-Token-Link

Warum dieser Ansatz:

- sehr kleine Reibung
- passend fuer kleine geschlossene Gruppe
- kein Passwort-Reset noetig
- auf einfachem Hosting gut umsetzbar

Wichtige Regel:

- Tokens muessen lang und zufaellig sein
- Tokens duerfen nicht erratbar sein

## 9. Technische Architektur

### Frontend

- HTML/CSS/JavaScript oder leichtes Frontend-Setup
- mobil optimierte Oberflaeche
- PWA optional bereits in V1, aber nicht zwingend zuerst

### Backend

- `PHP`-Endpunkte, die JSON liefern
- keine komplexe Serverlogik
- einfache CRUD-Operationen

### Datenbank

- `MariaDB`

## 10. Datenmodell

### Tabelle `teams`

- `id`
- `name`
- `location`
- `weekday`
- `start_time`
- `duration_minutes`
- `is_active`
- `created_at`
- `updated_at`

### Tabelle `players`

- `id`
- `team_id`
- `name`
- `sort_order`
- `player_token`
- `is_active`
- `created_at`
- `updated_at`

### Tabelle `sessions`

- `id`
- `team_id`
- `season_id` (optional, FK)
- `session_date`
- `location`, `start_time`, `duration_minutes`, `description` (Session-Overrides)
- `status`
- `admin_note`
- `created_at`
- `updated_at`

Empfohlene Werte fuer `status`:

- `scheduled`
- `provisional`
- `completed`
- `cancelled`

### Tabelle `responses`

- `id`
- `session_id`
- `player_id`
- `attendance_status`
- `comment`
- `updated_at`

### Tabelle `seasons` (implementiert)

- `id`
- `team_id`
- `name`
- `season_type` (`summer`, `winter`, `interclub`, `custom`)
- `start_date`, `end_date`
- Default-Overrides: `default_location`, `default_weekday`, `default_start_time`, `default_duration_minutes`, `description`
- `is_active`
- `created_at`, `updated_at`

### Tabelle `season_player_exclusions` (implementiert)

- `season_id`, `player_id` (Composite PK)

## 11. API (Ist-Stand)

Vollständige Tabelle: [api/README.md](api/README.md) und [doc/ARCHITECTURE.md](doc/ARCHITECTURE.md).

### Spieler

- `GET api/health.php` — DB-Check
- `GET api/sessions.php?token=...` — **Haupt-Einstieg:** Saison + alle Sessions
- `GET api/session.php?token=...` — Einzelne Session; optional `session_id`
- `POST api/response.php` — eigene Rückmeldung setzen/löschen

### Admin

- `GET api/admin/dashboard.php?token=...` — **Haupt-Einstieg:** Aggregat-Dashboard
- `GET api/admin/session.php?token=...` — Legacy (nächste Session)
- `POST api/admin/session-update.php`, `session-delete.php`
- `POST api/admin/response-save.php`
- `POST api/admin/team-save.php`, `season-save.php`, `season-delete.php`
- `POST api/admin/player-save.php`, `player-delete.php`

Auth zentral: `lib/auth.php`. Smoke-Tests: `test-api.ps1`.

## 12. API-Antworten

Alle Endpunkte sollen JSON liefern:

- `success`
- `data`
- `error`

Beispiel:

```json
{
  "success": true,
  "data": {
    "sessionDate": "2026-04-06",
    "status": "scheduled"
  }
}
```

## 13. Mobile UX-Prinzipien

- grosser Fokus auf einen einzigen Hauptscreen
- grosse Touch-Flaechen
- Status in 1 bis 2 Taps setzbar
- wenig Scrollen
- klare Farbgebung pro Status
- sehr reduzierte Formulare

## 14. Sicherheitsprinzipien

- nur vorbereitete SQL-Statements
- Tokens nur serverseitig validieren
- keine offenen Schreibzugriffe ohne Token
- Admin-Token strikt getrennt von Spieler-Tokens
- moeglichst keine unnoetigen personenbezogenen Daten speichern

## 15. Regressionstesting

Begleitendes Regressionstesting soll von Anfang an Teil des Projekts sein.

### Werkzeug

- `vitest` fuer testbare Domain-Regeln und spaetere Frontend-Utilities

### Erste Testziele

- gueltige Anwesenheitsstatus
- korrekte Team-Zusammenfassung
- Auswahl der relevanten Session fuer die Uebersicht

### Ziel pro Iteration

- neue Business-Regeln nicht nur implementieren, sondern mindestens auf Domain-Ebene absichern
- bestehende Kernablaeufe bei Erweiterungen nicht versehentlich brechen

## 16. Iterationsmodell

### Prototyp

Ziel:

- klickbarer und nutzbarer erster Stand
- Team sieht den Hauptablauf
- Daten koennen zentral gelesen und geschrieben werden

Enthalten:

- ein Team
- ein naechster Termin
- Status setzen
- Team-Uebersicht

### Iteration 1

Fokus:

- Bedienung vereinfachen
- Statuslogik schraenken oder verbessern
- Kommentare verbessern
- visuelle Uebersicht lesbarer machen

### Iteration 2

Fokus:

- Saisonansicht vorbereiten
- mehrere kommende Termine sichtbar machen
- Team-Summary pro Woche anzeigen
- Admin-Funktionen staerken

### Iteration 3 optional

Fokus:

- echte Sommer-/Winter-Saisonansicht
- Admin-Hinweise und Absagen je Termin
- PWA/Installierbarkeit verbessern
- Export oder kleine Historie

## 17. Offene Entscheidungen

Diese Punkte muessen vor dem Build abschliessend entschieden werden:

1. Soll `replacement` ein einziger Status bleiben oder aufgeteilt werden?
2. Braucht der Admin die Moeglichkeit, Spieler hinzuzufuegen oder reicht Pflege direkt in der Datenbank?
3. Soll die Saisonansicht sofort mit echter `seasons`-Tabelle gebaut werden oder zuerst ueber Datumslogik?
4. Soll die App sofort PWA werden oder erst nach Iteration 1?
5. Soll ein Spieler auch andere Spieler sehen duerfen oder nur den Gesamtstatus und die Namen?
6. Sollen ganze Saisons automatisch erzeugt werden?
7. Sollen Sommer- und Wintersaison als feste Geschaeftslogik gelten?

## 18. Empfehlung fuer den Start

Baue zuerst den Prototyp mit:

- einem Team
- acht Spielern
- einem naechsten Termin
- vier Statuswerten
- Kommentar pro Person
- Admin-Hinweis

Erst danach schrittweise zur Saisonansicht erweitern.

## 19. Zielbild Saisonansicht

Fachlich soll die App mittelfristig in Saisons denken statt nur in Einzelterminen:

### Sommer

- Mai bis September

### Winter

- Oktober bis April

### Gewuenschter Nutzwert

- Spieler koennen sich fuer mehrere Wochen im Voraus eintragen
- Team sieht pro Termin sofort die Teilnehmerlage
- Ferien, Abwesenheiten und Ausfaelle werden frueher sichtbar
- Admin kann die Saison als zusammenhaengenden Plan pflegen
