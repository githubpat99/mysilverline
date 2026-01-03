# --- Build + Deploy with timestamp verification ---

$ErrorActionPreference = "Stop"

$project   = "C:\Users\patri\next-app"
$localOut  = Join-Path $project "out"

$remoteDir = "/home/clients/cd018176a9efb9d6ecf8a0ae8be5e651/sites/mysilverline.it-pin.ch/app-static"

$winscp     = "C:\Program Files (x86)\WinSCP\WinSCP.com"
$session    = "mysilverline-deploy"
$logFile    = Join-Path $env:TEMP "winscp-deploy.log"
$scriptFile = Join-Path $env:TEMP "winscp-deploy.txt"

function Ensure-RscPageAlias {
  param(
    [string]$routeDir,   # e.g. out\finance
    [string]$routeName   # e.g. "finance" (used in "__next.finance.__PAGE__.txt")
  )

  # Source (wie du beschrieben hast): finance/__next.finance/__PAGE__.txt
  $src = Join-Path (Join-Path $routeDir "__next.$routeName") "__PAGE__.txt"

  # Destination (was der Browser anfragt): finance/__next.finance.__PAGE__.txt
  $dst = Join-Path $routeDir "__next.$routeName.__PAGE__.txt"

  if (Test-Path -LiteralPath $src) {
    Copy-Item -LiteralPath $src -Destination $dst -Force
    Write-Host "RSC alias created: $dst  (from $src)"
  } else {
    Write-Warning "Missing RSC source: $src (no alias created)"
  }
}

# ---------- BUILD ----------
Write-Host "== Build =="
if (-not (Test-Path -LiteralPath $project)) { throw "Project folder fehlt: $project" }

Push-Location $project
try {
  # Hard reset (hilft gegen alte Artefakte)
  if (Test-Path -LiteralPath (Join-Path $project ".next")) { Remove-Item (Join-Path $project ".next") -Recurse -Force }
  if (Test-Path -LiteralPath (Join-Path $project "out"))   { Remove-Item (Join-Path $project "out") -Recurse -Force }

  & npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
}
finally {
  Pop-Location
}

# ---------- POST-BUILD PATCH ----------
Write-Host "== Post-build patch =="
if (-not (Test-Path -LiteralPath $localOut)) { throw "/out fehlt: $localOut" }

# Fix für 404 auf: /finance/__next.finance.__PAGE__.txt?_rsc=...
Ensure-RscPageAlias -routeDir (Join-Path $localOut "finance") -routeName "finance"

# Falls summary ebenfalls betroffen ist:
Ensure-RscPageAlias -routeDir (Join-Path $localOut "summary") -routeName "summary"

# ---------- DEPLOY ----------
Write-Host "== Deploy =="
if (-not (Test-Path -LiteralPath $localOut)) { throw "/out fehlt: $localOut" }
if (Test-Path -LiteralPath $logFile) { Remove-Item $logFile -Force }

# Timestamp-Marker (nach Build)
$deployTs = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Set-Content -LiteralPath (Join-Path $localOut "__deploy.txt") `
  -Value "Deployed at $deployTs" -Encoding UTF8

@"
option batch abort
option confirm off
open "$session"
lcd "$localOut"
cd "$remoteDir"
synchronize remote "." "." -delete
put "__deploy.txt"
exit
"@ | Set-Content -LiteralPath $scriptFile -Encoding ASCII

& $winscp "/log=$logFile" "/script=$scriptFile"
if ($LASTEXITCODE -ne 0) { throw "Deploy failed – siehe Log: $logFile" }

Write-Host "Build+Deploy OK – $deployTs"
Write-Host "Check: https://mysilverline.it-pin.ch/app-static/__deploy.txt"
