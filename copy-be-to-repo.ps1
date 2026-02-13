# Kopiert silverline-api.php ins BE-Repo für Deployment
$ErrorActionPreference = "Stop"

$source = "C:\Users\patri\next-app\BE_Copy\silverline-api.php"
$dest   = "C:\Users\patri\mysilverline.it-pin.ch\silverline-api\silverline-api.php"

if (-not (Test-Path $source)) { throw "Quelle fehlt: $source" }

$destDir = Split-Path -Parent $dest
if (-not (Test-Path $destDir)) { throw "Zielverzeichnis fehlt: $destDir" }

Copy-Item -LiteralPath $source -Destination $dest -Force
Write-Host "Kopiert: $source -> $dest"
Write-Host "Wechsle ins BE-Repo und deploye: cd C:\Users\patri\mysilverline.it-pin.ch"