param(
    [Parameter(Mandatory = $true)]
    [string]$TeamName,

    [string]$AdminLabel = "hauptadmin",
    [string]$RecipientName = "",
    [string]$RecipientEmail = "",
    [string]$Location = "Clubanlage",
    [ValidateRange(1, 7)]
    [int]$Weekday = 3,
    [string]$StartTime = "19:00:00",
    [ValidateRange(1, 1440)]
    [int]$DurationMinutes = 90,
    [string]$BaseUrl = "https://mysilverline.it-pin.ch/htmltools/tennisteam",
    [string]$TablePrefix = "wp_1340630_tt_",
    [string]$SenderName = "Patrik",
    [string]$SupportText = "Falls Fragen auftauchen oder Hilfe beim Einrichten gewuenscht ist, melde dich einfach."
)

$ErrorActionPreference = "Stop"

function New-HexToken([int]$ByteCount = 32) {
    $bytes = New-Object byte[] $ByteCount
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
}

function Escape-Sql([string]$Value) {
    if ($null -eq $Value) {
        return ""
    }

    return $Value.Replace("'", "''")
}

function New-Slug([string]$Value) {
    $slug = $Value.ToLowerInvariant()
    $slug = [regex]::Replace($slug, "[^a-z0-9]+", "-")
    $slug = $slug.Trim("-")
    if ([string]::IsNullOrWhiteSpace($slug)) {
        return "team"
    }

    return $slug
}

if ($StartTime -notmatch "^\d{2}:\d{2}:\d{2}$") {
    throw "StartTime muss im Format HH:mm:ss angegeben werden."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outDir = Join-Path $scriptDir "out"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$slug = New-Slug $TeamName
$adminToken = New-HexToken
$adminUrl = ($BaseUrl.TrimEnd("/") + "/admin.html?token=" + $adminToken)

$teamsTable = "${TablePrefix}teams"
$adminTokensTable = "${TablePrefix}admin_tokens"

$safeTeamName = Escape-Sql $TeamName
$safeAdminLabel = Escape-Sql $AdminLabel
$safeLocation = Escape-Sql $Location

$sql = @"
START TRANSACTION;

INSERT INTO $teamsTable (name, location, weekday, start_time, duration_minutes)
VALUES ('$safeTeamName', '$safeLocation', $Weekday, '$StartTime', $DurationMinutes);

SET @team_id := LAST_INSERT_ID();

INSERT INTO $adminTokensTable (team_id, admin_token, label)
VALUES (@team_id, '$adminToken', '$safeAdminLabel');

COMMIT;

SELECT @team_id AS team_id, '$safeTeamName' AS team_name, '$adminToken' AS admin_token;
"@

$recipientLine = if ([string]::IsNullOrWhiteSpace($RecipientName)) {
    "Hallo,"
} else {
    "Hallo $RecipientName,"
}

$mail = @"
$recipientLine

dein Zugang fuer Tennisteam ist eingerichtet.

Admin-Link:
$adminUrl

Bitte den Link vertraulich behandeln und nur intern verwenden.

Empfohlener Einstieg:
1. Teamdaten kurz pruefen
2. Spieler anlegen
3. erste Saison anlegen
4. persoenliche Spieler-Links direkt im Admin verteilen

$SupportText

Viele Gruesse
$SenderName
"@

$notes = @"
Interner Hinweis:

- Teamname: $TeamName
- Empfaenger: $RecipientEmail
- AdminLabel: $AdminLabel
- Admin-Link: $adminUrl

Nach Versand:
1. SQL in phpMyAdmin ausfuehren
2. Link im Browser testen
3. Mailtext versenden
4. Versand intern abhaken
"@

$sqlPath = Join-Path $outDir "${timestamp}_${slug}_live_setup.sql"
$mailPath = Join-Path $outDir "${timestamp}_${slug}_live_admin_mail.txt"
$notesPath = Join-Path $outDir "${timestamp}_${slug}_live_checklist.txt"

Set-Content -Path $sqlPath -Value $sql -Encoding utf8
Set-Content -Path $mailPath -Value $mail -Encoding utf8
Set-Content -Path $notesPath -Value $notes -Encoding utf8

Write-Host ""
Write-Host "== Neues Live-Kundenteam vorbereitet ==" -ForegroundColor Cyan
Write-Host "Team:       $TeamName"
Write-Host "AdminLabel: $AdminLabel"
if (-not [string]::IsNullOrWhiteSpace($RecipientEmail)) {
    Write-Host "Empfaenger: $RecipientEmail"
}
Write-Host ""
Write-Host "Admin-Link:" -ForegroundColor Yellow
Write-Host $adminUrl
Write-Host ""
Write-Host "Dateien:" -ForegroundColor Yellow
Write-Host "SQL :       $sqlPath"
Write-Host "Mail:       $mailPath"
Write-Host "Checklist:  $notesPath"
Write-Host ""
Write-Host "Naechster Schritt:" -ForegroundColor Green
Write-Host "1. SQL-Datei in phpMyAdmin ausfuehren"
Write-Host "2. Admin-Link testen"
Write-Host "3. Mailtext an den Kunden senden"
