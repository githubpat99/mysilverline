$ErrorActionPreference = "Stop"

$session   = "mysilverline"
$project   = "C:\Users\patri\next-app"
$localOut  = Join-Path $project "out"
$remoteDir = "/home/clients/cd018176a9efb9d6ecf8a0ae8be5e651/sites/mysilverline.it-pin.ch/app-static"

# Build (stellt sicher, dass /out aktuell ist)
Set-Location $project
npm ci
npm run build

# Deploy: Spiegeln (inkl. delete -> keine Altlasten)
& "C:\Program Files (x86)\WinSCP\WinSCP.com" `
  "/command" `
  "open storedsession:$session" `
  "synchronize remote `"$remoteDir`" `"$localOut`" -delete" `
  "exit"
