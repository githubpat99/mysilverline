# Neues Team anlegen

Diese Anleitung beschreibt den einfachsten Startprozess fuer ein neues Live- oder Demo-Team in derselben Datenbank.

## Ziel

Mit einem einzigen lokalen Script vorbereiten:

- neues Team
- neuer Admin-Token
- kompletter Admin-Link
- Mailtext fuer den Versand
- SQL-Datei fuer die manuelle Ausfuehrung in der Datenbank

## Empfohlener Ablauf

1. Lokal das passende Script aus `script/neuesteam/` ausfuehren.
2. Dadurch werden ein SQL-Snippet und ein Mailtext erzeugt.
3. SQL in `phpMyAdmin` oder einem anderen DB-Tool ausfuehren.
4. Admin-Link pruefen.
5. Mailtext an den neuen Admin senden.
6. Der neue Admin pflegt danach Spieler, Saisons und Termine selbst im Admin.

## Warum bewusst manuell?

Die Anlage bleibt absichtlich halbmanuell:

- kein Risiko durch versehentliche Live-Anlagen
- kein direkter Mailversand aus dem System noetig
- voller Kontrollpunkt vor der Aktivierung
- funktioniert auch ohne zusaetzliche Serverlogik

## Script-Aufruf

Beispiel:

```powershell
pwsh .\script\neuesteam\neuesteam.ps1 `
  -TeamName "TC Beispiel Herren 1" `
  -AdminLabel "hauptadmin" `
  -RecipientName "Max Muster" `
  -RecipientEmail "max@example.com"
```

Oder unter Windows PowerShell:

```powershell
.\script\neuesteam\neuesteam.ps1 `
  -TeamName "TC Beispiel Herren 1" `
  -AdminLabel "hauptadmin" `
  -RecipientName "Max Muster" `
  -RecipientEmail "max@example.com"
```

Demo-Team mit 4 Spielern:

```powershell
.\script\neuesteam\neuedemoteam.ps1 `
  -TeamName "Tennisteam Demo" `
  -RecipientName "Max Muster" `
  -RecipientEmail "max@example.com"
```

Live-Kundenteam mit externer Mailvorlage:

```powershell
.\script\neuesteam\neueslivekundenteam.ps1 `
  -TeamName "TC Beispiel Herren 1" `
  -RecipientName "Max Muster" `
  -RecipientEmail "max@example.com"
```

## Was erzeugt wird?

Die Scripts schreiben Dateien nach `script/neuesteam/out/`:

- `*_setup.sql`: legt Team und Admin-Token an
- `*_admin_mail.txt`: Mailvorlage mit dem Admin-Link
- `*_live_setup.sql`: Live-Kundenteam
- `*_live_admin_mail.txt`: formellere Mailvorlage fuer echte Interessenten
- `*_live_checklist.txt`: interne Versand-Checkliste
- `*_demo_setup.sql`: Demo-Team mit 4 Spielern
- `*_demo_player_links.txt`: Spieler-Links fuer Demo-Zwecke
- `*_delete.sql`: vorbereitetes SQL zum Loeschen eines Teams

Zusaetzlich zeigt das Script direkt im Terminal an:

- generierter Token
- Admin-Link
- Pfade zu den erzeugten Dateien

## Empfohlene Eingaben

- `TeamName`: klarer Teamname, z. B. `TC Beispiel Herren 1`
- `AdminLabel`: z. B. `hauptadmin` oder `demo-admin`
- `Location`: neutral oder reale Standardanlage
- `Weekday`: 1 bis 7 fuer Montag bis Sonntag
- `StartTime`: Standardzeit im Format `HH:mm:ss`
- `DurationMinutes`: Standarddauer in Minuten

## SQL ausfuehren

Die erzeugte SQL-Datei kann direkt in `phpMyAdmin` oder einem vergleichbaren DB-Tool ausgefuehrt werden.

Danach ist der Admin-Zugang live und der verschickte Link funktioniert sofort.

## Versand an den neuen Admin

Am Anfang reicht Versand per:

- Mail
- WhatsApp
- Signal

Empfehlung:

- immer den kompletten Admin-Link senden
- nicht nur den nackten Token
- Hinweis dazuschreiben, dass der Link vertraulich ist

## Demo-Team vs. Live-Team

Dasselbe Vorgehen funktioniert fuer beide Faelle:

- `Live-Team`: echter Kunde oder echtes Team
- `Demo-Team`: neutrale Vorfuehrung mit Fake-Daten

Wichtig:

- Demo-Team immer klar benennen
- Demo-Admin-Link nie mit Live-Link verwechseln
- fuer oeffentliche Screenshots nur Demo-Daten verwenden

## Team wieder loeschen

Zum Entfernen eines Test- oder Demo-Teams gibt es:

```powershell
.\script\neuesteam\loeschteam.ps1 -TeamId 12 -ExpectedTeamName "Tennisteam Demo"
```

Das Script erzeugt eine SQL-Datei, die das Team ueber die `team_id` loescht.

Wichtig:

- das Loeschen ist bewusst ebenfalls manuell
- ueber `ON DELETE CASCADE` verschwinden dabei auch zugehoerige Spieler, Tokens, Saisons, Termine und Antworten
- wenn moeglich immer `ExpectedTeamName` mit angeben, damit die SQL zusaetzlich abgesichert ist

## Nach dem ersten Login

Der neue Admin kann anschliessend selbst:

- Teamdaten pruefen
- Spieler anlegen
- Spieler-Links kopieren
- Saison anlegen
- Termine erzeugen oder anpassen

## Spaeterer Ausbau

Wenn der manuelle Prozess zu oft gebraucht wird, kann spaeter ein kleiner Self-Service folgen:

- Formular fuer neue Teams
- automatische Teamanlage
- automatischer Mailversand

Fuer jetzt ist der manuelle Ablauf die robusteste und einfachste Loesung.
