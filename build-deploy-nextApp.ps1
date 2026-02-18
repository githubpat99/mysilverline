# --- Build + Deploy with timestamp + git verification (WARN on dirty)
# --- plus: automatic RSC alias creation for ALL routes in /out ---

$ErrorActionPreference = "Stop"

$project   = "C:\Users\patri\next-app"
$localOut  = Join-Path $project "out"

$remoteDir = "/home/clients/cd018176a9efb9d6ecf8a0ae8be5e651/sites/mysilverline.it-pin.ch/app-static"

$winscp     = "C:\Program Files (x86)\WinSCP\WinSCP.com"
$session    = "mysilverline-deploy"
$logFile    = Join-Path $env:TEMP "winscp-deploy.log"
$scriptFile = Join-Path $env:TEMP "winscp-deploy.txt"

function Try-GetGitInfo {
  param([string]$repoPath)

  $info = [ordered]@{
    Commit = $null
    Branch = $null
    Dirty  = $null
  }

  try {
    Push-Location $repoPath
    $commit = (& git rev-parse --short HEAD 2>$null).Trim()
    $branch = (& git rev-parse --abbrev-ref HEAD 2>$null).Trim()
    $dirty  = (& git status --porcelain 2>$null)

    if ($commit) { $info.Commit = $commit }
    if ($branch) { $info.Branch = $branch }
    $info.Dirty = [bool]($dirty -and $dirty.Trim().Length -gt 0)
  } catch {
    # ignore – no git available or not a repo
  } finally {
    Pop-Location
  }

  return $info
}

function Ensure-RscPageAliasAuto {
  param([string]$outRoot)

  # We scan ALL immediate route directories in out/
  # Example route dir: out\finance
  # If it contains: out\finance\__next.finance\__PAGE__.txt
  # we create:       out\finance\__next.finance.__PAGE__.txt

  if (-not (Test-Path -LiteralPath $outRoot)) { throw "outRoot fehlt: $outRoot" }

  $routeDirs = Get-ChildItem -LiteralPath $outRoot -Directory -ErrorAction Stop

  foreach ($rd in $routeDirs) {
    $routeName = $rd.Name
    $routePath = $rd.FullName

    # Skip internal folders if any ever show up
    if ($routeName -in @("__next", "_next", "api")) { continue }

    $src = Join-Path (Join-Path $routePath "__next.$routeName") "__PAGE__.txt"
    $dst = Join-Path $routePath "__next.$routeName.__PAGE__.txt"

    if (Test-Path -LiteralPath $src) {
      Copy-Item -LiteralPath $src -Destination $dst -Force
      Write-Host "RSC alias created: $dst  (from $src)"
    }
  }
}

# ---------- BUILD ----------
Write-Host "== Build =="
if (-not (Test-Path -LiteralPath $project)) { throw "Project folder fehlt: $project" }

$git = Try-GetGitInfo -repoPath $project
if ($git.Commit) {
  Write-Host ("Git: {0} ({1}) Dirty={2}" -f $git.Commit, ($git.Branch ?? "?"), $git.Dirty)
  if ($git.Dirty) { Write-Warning "Working tree is DIRTY (uncommitted changes). Deploy will continue." }
} else {
  Write-Warning "Git info not available (git missing or not a repo)."
}

Push-Location $project
try {
  # Clean build artifacts
  $nextDir = Join-Path $project ".next"
  $outDir  = Join-Path $project "out"
  if (Test-Path -LiteralPath $nextDir) { Remove-Item $nextDir -Recurse -Force }
  if (Test-Path -LiteralPath $outDir)  { Remove-Item $outDir  -Recurse -Force }

  & npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
}
finally {
  Pop-Location
}

# ---------- POST-BUILD PATCH ----------
Write-Host "== Post-build patch (auto RSC aliases) =="
if (-not (Test-Path -LiteralPath $localOut)) { throw "/out fehlt: $localOut" }

# Auto-create aliases for all routes found in out/
Ensure-RscPageAliasAuto -outRoot $localOut

# ---------- DEPLOY ----------
Write-Host "== Deploy =="
if (-not (Test-Path -LiteralPath $localOut)) { throw "/out fehlt: $localOut" }
if (Test-Path -LiteralPath $logFile) { Remove-Item $logFile -Force }

# Timestamp marker (after build) + git info
$deployTsLocal = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$deployTsUtc   = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss 'UTC'")
$commitText    = if ($git.Commit) { $git.Commit } else { "n/a" }
$branchText    = if ($git.Branch) { $git.Branch } else { "n/a" }
$dirtyText     = if ($git.Dirty -eq $true) { "true" } elseif ($git.Dirty -eq $false) { "false" } else { "n/a" }

$deployMarker = @"
Deployed at (local): $deployTsLocal
Deployed at (UTC):   $deployTsUtc
Git commit:          $commitText
Git branch:          $branchText
Git dirty:           $dirtyText
"@

Set-Content -LiteralPath (Join-Path $localOut "__deploy.txt") -Value $deployMarker -Encoding UTF8

@"
option batch abort
option confirm off
open "$session"
lcd "$localOut"
cd "$remoteDir"
synchronize remote "." "." -delete
exit
"@ | Set-Content -LiteralPath $scriptFile -Encoding ASCII

& $winscp "/log=$logFile" "/script=$scriptFile"
if ($LASTEXITCODE -ne 0) { throw "Deploy failed – siehe Log: $logFile" }

Write-Host "Build+Deploy OK – $deployTsLocal"
Write-Host "Check: https://mysilverline.it-pin.ch/app-static/__deploy.txt"
