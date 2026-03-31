#!/bin/bash

set -euo pipefail

SSH_USER="y12er_it-pin"
SSH_HOST="y12er.ftp.infomaniak.com"
REMOTE_DIR="/home/clients/cd018176a9efb9d6ecf8a0ae8be5e651/sites/mysilverline.it-pin.ch/htmltools/tennisteam"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_DIR="${SCRIPT_DIR}/"

SSH_KEY_PATH="${SSH_KEY_PATH:-}"
if [[ -z "$SSH_KEY_PATH" ]]; then
  for candidate in \
    "$HOME/.ssh/id_ed25519_infomaniak" \
    "$HOME/.ssh/id_rsa_infomaniak" \
    "$HOME/.ssh/id_ed25519" \
    "$HOME/.ssh/id_rsa"
  do
    if [[ -f "$candidate" ]]; then
      SSH_KEY_PATH="$candidate"
      break
    fi
  done
fi

TEMP_SSH_KEY=""
cleanup() {
  if [[ -n "$TEMP_SSH_KEY" && -f "$TEMP_SSH_KEY" ]]; then
    rm -f "$TEMP_SSH_KEY"
  fi
}
trap cleanup EXIT

prepare_ssh_key() {
  local key_path="$1"
  if [[ -z "$key_path" || ! -f "$key_path" ]]; then
    return
  fi

  case "$key_path" in
    /mnt/*|/c/*)
      mkdir -p "$HOME/.ssh"
      chmod 700 "$HOME/.ssh" 2>/dev/null || true
      TEMP_SSH_KEY="$HOME/.ssh/cursor_deploy_key_$$"
      cp "$key_path" "$TEMP_SSH_KEY"
      chmod 600 "$TEMP_SSH_KEY"
      SSH_KEY_PATH="$TEMP_SSH_KEY"
      ;;
  esac
}

prepare_ssh_key "$SSH_KEY_PATH"

DRY_RUN=""
if [[ "${1:-}" == "--dry" ]]; then
  DRY_RUN="--dry-run -v"
fi

if [[ ! -f "${LOCAL_DIR}config/database.php" ]]; then
  echo "Fehler: config/database.php fehlt. Ohne echte DB-Konfiguration macht das Deploy keinen Sinn." >&2
  exit 1
fi

echo "== Deploy Tennisteam =="
echo "Quelle:  $LOCAL_DIR"
echo "Ziel:    ${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}"
[[ -n "$DRY_RUN" ]] && echo "(Dry-Run - nichts wird geändert)"
if [[ -n "$SSH_KEY_PATH" ]]; then
  echo "SSH-Key: $SSH_KEY_PATH"
else
  echo "SSH-Key: keiner gefunden, Passwort-Login wird verwendet"
fi
echo "---"

SSH_CMD="ssh"
if [[ -n "$SSH_KEY_PATH" ]]; then
  SSH_CMD+=" -i \"$SSH_KEY_PATH\" -o IdentitiesOnly=yes"
fi

rsync -avz --progress $DRY_RUN \
  -e "$SSH_CMD" \
  --rsync-path="mkdir -p '${REMOTE_DIR}' && rsync" \
  --exclude '.git' \
  --exclude '.gitignore' \
  --exclude '.DS_Store' \
  --exclude 'Thumbs.db' \
  --exclude '.vscode' \
  --exclude 'README.md' \
  --exclude 'V1_SPEC.md' \
  --exclude 'sql/' \
  --exclude '*.test.ts' \
  --exclude 'config/database.example.php' \
  --delete \
  "${LOCAL_DIR}" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"

echo "---"
echo "Deploy fertig."
