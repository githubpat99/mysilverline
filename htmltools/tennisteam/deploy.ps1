$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Tennisteam Deploy"

$localDir = if ($PSScriptRoot) { $PSScriptRoot.TrimEnd('\') + "\" } else { (Get-Location).Path + "\" }
$dryRun = $args -contains "--dry"
$sshDir = Join-Path $HOME ".ssh"
$keyCandidates = @(
    (Join-Path $sshDir "id_ed25519_infomaniak"),
    (Join-Path $sshDir "id_rsa_infomaniak"),
    (Join-Path $sshDir "id_ed25519"),
    (Join-Path $sshDir "id_rsa")
)
$sshKeyPath = $keyCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

function Convert-ToWslPath([string]$Path) {
    $resolved = [System.IO.Path]::GetFullPath($Path)
    $drive = $resolved.Substring(0, 1).ToLower()
    $rest = $resolved.Substring(2).Replace('\', '/').Trim('/')
    return "/mnt/$drive/$rest"
}

function Convert-ToGitBashPath([string]$Path) {
    $resolved = [System.IO.Path]::GetFullPath($Path)
    $drive = $resolved.Substring(0, 1).ToLower()
    $rest = $resolved.Substring(2).Replace('\', '/').Trim('/')
    return "/$drive/$rest"
}

Write-Host "== Deploy Tennisteam ==" -ForegroundColor Cyan
Write-Host $localDir -ForegroundColor Gray
if ($dryRun) { Write-Host "(Dry-Run)" -ForegroundColor Yellow }
if ($sshKeyPath) {
    Write-Host "SSH-Key: $sshKeyPath" -ForegroundColor Gray
} else {
    Write-Host "SSH-Key: keiner gefunden, Passwort-Login bleibt aktiv" -ForegroundColor Yellow
}
Write-Host ""

if (-not (Test-Path (Join-Path $localDir "config\database.php"))) {
    Write-Host "Fehler: config\database.php fehlt." -ForegroundColor Red
    exit 1
}

$wsl = Get-Command wsl -ErrorAction SilentlyContinue
if ($wsl) {
    Write-Host "Starte via WSL..." -ForegroundColor Gray
    $shPath = Join-Path $localDir "deploy.sh"
    if (Test-Path $shPath) {
        $content = [System.IO.File]::ReadAllText($shPath) -replace "`r`n", "`n"
        [System.IO.File]::WriteAllText($shPath, $content, [System.Text.UTF8Encoding]::new($false))
    }

    $drive = $localDir.Substring(0, 1).ToLower()
    $rest = $localDir.Substring(2).Replace('\', '/').Trim('/')
    $wslPath = "/mnt/$drive/$rest"
    $wslKeyPath = if ($sshKeyPath) { Convert-ToWslPath $sshKeyPath } else { "" }

    Push-Location $localDir
    try {
        $commandParts = @("cd '$wslPath'")
        if ($wslKeyPath) {
            $commandParts += "export SSH_KEY_PATH='$wslKeyPath'"
        }
        $commandParts += "bash deploy.sh $(if ($dryRun) { '--dry' })"
        wsl bash -c ($commandParts -join " && ")
    } finally {
        Pop-Location
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nDeploy fertig." -ForegroundColor Green
        exit 0
    }
}

$gitBash = "C:\Program Files\Git\bin\bash.exe"
if (Test-Path $gitBash) {
    Write-Host "Starte via Git Bash..." -ForegroundColor Gray
    $gitBashLocalDir = Convert-ToGitBashPath $localDir
    $gitBashKeyPath = if ($sshKeyPath) { Convert-ToGitBashPath $sshKeyPath } else { "" }
    $commandParts = @("cd '$gitBashLocalDir'")
    if ($gitBashKeyPath) {
        $commandParts += "export SSH_KEY_PATH='$gitBashKeyPath'"
    }
    $commandParts += "./deploy.sh $(if ($dryRun) { '--dry' })"
    $bashArgs = @("-c", ($commandParts -join " && "))
    & $gitBash $bashArgs
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nDeploy fertig." -ForegroundColor Green
        exit 0
    }
}

Write-Host "Fehler: Weder WSL noch Git Bash gefunden." -ForegroundColor Red
Write-Host ""
Write-Host "Optionen:" -ForegroundColor Yellow
Write-Host "  1. WSL installieren: wsl --install"
Write-Host "  2. Git fuer Windows installieren: https://git-scm.com"
Write-Host "  3. Alternativ den Ordner manuell per FileZilla hochladen"
exit 1
