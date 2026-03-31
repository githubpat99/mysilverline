# Neues Team Script

Die Scripts in diesem Ordner erzeugen lokal SQL-Dateien und Hilfstexte fuer neue Teams.

## Enthalten

- `neuesteam.ps1`: neues normales Team mit Admin-Link
- `neueslivekundenteam.ps1`: neues Live-Kundenteam mit formellerer Mailvorlage
- `neuedemoteam.ps1`: Demo-Team mit 4 Spielern
- `loeschteam.ps1`: SQL-Datei zum Loeschen eines Teams

## `neuesteam.ps1`

Das Script erzeugt lokal:

- einen neuen Admin-Token
- eine SQL-Datei fuer `Team + Admin-Zugang`
- einen fertigen Mailtext mit Admin-Link

## Beispiel

```powershell
.\neuesteam.ps1 `
  -TeamName "TC Beispiel Herren 1" `
  -AdminLabel "hauptadmin" `
  -RecipientName "Max Muster" `
  -RecipientEmail "max@example.com"
```

## Ausgabe

Die erzeugten Dateien landen in `out/`:

- `*_setup.sql`
- `*_admin_mail.txt`

Die SQL-Datei wird anschliessend manuell in der Datenbank ausgefuehrt.

## `neueslivekundenteam.ps1`

Gedacht fuer echte Interessenten oder Kunden.

Beispiel:

```powershell
.\neueslivekundenteam.ps1 `
  -TeamName "TC Beispiel Herren 1" `
  -RecipientName "Max Muster" `
  -RecipientEmail "max@example.com"
```

Ausgabe:

- `*_live_setup.sql`
- `*_live_admin_mail.txt`
- `*_live_checklist.txt`

Diese Variante ist fuer den externen Versand etwas sauberer formuliert.

## `neuedemoteam.ps1`

Beispiel:

```powershell
.\neuedemoteam.ps1 `
  -TeamName "Tennisteam Demo" `
  -RecipientName "Max Muster" `
  -RecipientEmail "max@example.com"
```

Ausgabe:

- `*_demo_setup.sql`
- `*_demo_admin_mail.txt`
- `*_demo_player_links.txt`

Das Demo-Team enthaelt direkt 4 Spieler.

## `loeschteam.ps1`

Beispiel:

```powershell
.\loeschteam.ps1 -TeamId 12 -ExpectedTeamName "Tennisteam Demo"
```

Ausgabe:

- `*_delete.sql`

Die SQL-Datei loescht das Team. Wegen `ON DELETE CASCADE` verschwinden damit auch:

- Admin-Tokens
- Spieler
- Saisons
- Termine
- Antworten
