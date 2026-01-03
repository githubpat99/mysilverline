# --- Deploy with timestamp verification ---

$ErrorActionPreference = "Stop"

$project   = "C:\Users\patri\next-app"
$localOut  = Join-Path $project "out"

$remoteDir = "/home/clients/cd018176a9efb9d6ecf8a0ae8be5e651/sites/mysilverline.it-pin.ch/app-static"

$winscp     = "C:\Program Files (x86)\WinSCP\WinSCP.com"
$session    = "mysilverline-deploy"
$logFile    = Join-Path $env:TEMP "winscp-deploy.log"
$scriptFile = Join-Path $env:TEMP "winscp-deploy.txt"

if (-not (Test-Path -LiteralPath $localOut)) { throw "/out fehlt: $localOut" }
if (Test-Path -LiteralPath $logFile) { Remove-Item $logFile -Force }

# Timestamp-Marker
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

Write-Host "Deploy OK – $deployTs"
