# Silverline API – Backend-Kopie

Dieser Ordner enthält die Silverline API mit **Token-Auth für PWA** integriert.

## Musterfall

Der Musterfall ist ein Beispiel-Szenario, das allen Nutzern angezeigt wird. Nur der konfigurierte Inhaber kann es ändern.

**Fallbeschreibung:** In der Basis kann eine optionale Fallbeschreibung hinterlegt werden. Beim Musterfall wird sie anstelle von „Beispiel-Szenario“ angezeigt. Dafür die Spalte `description` (VARCHAR/TEXT) in `wp_sl_finance_basic` anlegen:

```sql
ALTER TABLE wp_sl_finance_basic ADD COLUMN description TEXT NULL;
```

**Konfiguration:** In `wp-config.php` (vor dem Laden des Plugins):

```php
define('SL_MUSTERFALL_UID', 1);  // Ihre WordPress User-ID
```

Die Daten des angegebenen Users werden als Musterfall geladen. Nutzer können sie ansehen und mit „Als mein Profil übernehmen“ übernehmen. Nur Sie (User 1) können den Musterfall bearbeiten – dazu den Finanz-Workflow nutzen.

## Dateien

- **`silverline-api.php`** – Deploy-Version (vollständig, mit Token-Auth)
- **`silverline-api_Basis.php`** – Original mit Token-Auth eingearbeitet (Backup)

## Deploy

### Windows (PowerShell)

```powershell
.\deploy-Backend.ps1
```

Mit Dry-Run (nur Vorschau):

```powershell
.\deploy-Backend.ps1 --dry
```

### Linux / WSL / Git Bash

```bash
./deploy.sh
```

Mit Dry-Run:

```bash
./deploy.sh --dry
```

**Ziel:** `wp-content/plugins/silverline-api/` auf dem Server.

Voraussetzung: WSL, Git Bash oder OpenSSH (für rsync bzw. scp). SSH-Verbindung zu `y12er.ftp.infomaniak.com`.
