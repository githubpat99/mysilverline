param(
    [Parameter(Mandatory = $true)]
    [int]$TeamId,

    [string]$ExpectedTeamName = "",
    [string]$TablePrefix = "wp_1340630_tt_"
)

$ErrorActionPreference = "Stop"

function Escape-Sql([string]$Value) {
    if ($null -eq $Value) {
        return ""
    }

    return $Value.Replace("'", "''")
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outDir = Join-Path $scriptDir "out"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$teamsTable = "${TablePrefix}teams"
$safeExpectedTeamName = Escape-Sql $ExpectedTeamName

$deleteWhere = if ([string]::IsNullOrWhiteSpace($ExpectedTeamName)) {
    "id = $TeamId"
} else {
    "id = $TeamId AND name = '$safeExpectedTeamName'"
}

$sql = @"
START TRANSACTION;

SELECT id, name
FROM $teamsTable
WHERE id = $TeamId;

DELETE FROM $teamsTable
WHERE $deleteWhere;

SELECT ROW_COUNT() AS deleted_team_rows;

COMMIT;
"@

$sqlPath = Join-Path $outDir "${timestamp}_team-${TeamId}_delete.sql"
Set-Content -Path $sqlPath -Value $sql -Encoding utf8

Write-Host ""
Write-Host "== Team-Loeschung vorbereitet ==" -ForegroundColor Cyan
Write-Host "TeamId: $TeamId"
if (-not [string]::IsNullOrWhiteSpace($ExpectedTeamName)) {
    Write-Host "Name:   $ExpectedTeamName"
}
Write-Host ""
Write-Host "SQL-Datei:" -ForegroundColor Yellow
Write-Host $sqlPath
Write-Host ""
Write-Host "Hinweis:" -ForegroundColor Red
Write-Host "Das Loeschen des Teams entfernt per Cascade auch Admin-Tokens, Spieler, Saisons, Termine und Antworten."
Write-Host "Die SQL-Datei vor dem Ausfuehren bitte kurz pruefen."
