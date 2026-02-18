#!/bin/bash
#
# Deploy Silverline API (PHP) Plugin per rsync
# Ziel: wp-content/plugins/silverline-api/
# Voraussetzung: rsync + SSH (WSL, Git Bash, Cygwin)
#
# Infomaniak: SSH = gleicher Host wie FTP (y12er.ftp.infomaniak.com)
#
# Nutzung:
#   ./deploy.sh         = Deploy ausführen
#   ./deploy.sh --dry   = Dry-Run (zeigt nur, was übertragen würde)
#

set -e

SSH_USER="y12er_it-pin"
SSH_HOST="y12er.ftp.infomaniak.com"
REMOTE_DIR="/home/clients/cd018176a9efb9d6ecf8a0ae8be5e651/sites/mysilverline.it-pin.ch/wp-content/plugins/silverline-api"

DRY_RUN=""
[[ "$1" == "--dry" ]] && DRY_RUN="--dry-run -v"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_DIR="${SCRIPT_DIR}/"

if [[ ! -f "${LOCAL_DIR}silverline-api.php" ]]; then
  echo "Fehler: silverline-api.php nicht gefunden in $LOCAL_DIR" >&2
  exit 1
fi

echo "== Deploy Silverline API (PHP) =="
echo "Quelle:  $LOCAL_DIR"
echo "Ziel:    ${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}"
[[ -n "$DRY_RUN" ]] && echo "(Dry-Run - nichts wird geändert)"
echo "---"

rsync -avz --progress $DRY_RUN \
  --exclude '.git' \
  --exclude '.gitignore' \
  --exclude '.DS_Store' \
  --exclude 'Thumbs.db' \
  --exclude '*.Save.php' \
  --exclude '*.log' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude '.vscode' \
  --delete \
  "$LOCAL_DIR" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"

echo "---"
echo "Deploy fertig."
