# Silverline API – Backend-Kopie

Dieser Ordner enthält die Silverline API mit **Token-Auth für PWA** integriert.

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
