param(
    [string]$TeamName = "Tennisteam Demo",
    [string]$AdminLabel = "demo-admin",
    [string]$RecipientName = "",
    [string]$RecipientEmail = "",
    [string]$Location = "Clubanlage Demo",
    [ValidateRange(1, 7)]
    [int]$Weekday = 3,
    [string]$StartTime = "19:00:00",
    [ValidateRange(1, 1440)]
    [int]$DurationMinutes = 90,
    [string]$BaseUrl = "https://mysilverline.it-pin.ch/htmltools/tennisteam",
    [string]$TablePrefix = "wp_1340630_tt_",
    [string[]]$PlayerNames = @("Luca", "Jonas", "Marco", "Simon")
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

function Format-IsoDate([datetime]$Value) {
    return $Value.ToString("yyyy-MM-dd")
}

if ($StartTime -notmatch "^\d{2}:\d{2}:\d{2}$") {
    throw "StartTime muss im Format HH:mm:ss angegeben werden."
}

if ($PlayerNames.Count -ne 4) {
    throw "Bitte genau 4 Spielernamen angeben."
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
$playersTable = "${TablePrefix}players"

$safeTeamName = Escape-Sql $TeamName
$safeAdminLabel = Escape-Sql $AdminLabel
$safeLocation = Escape-Sql $Location
$playerLinkLines = @()
$playerSqlBlocks = @()

for ($i = 0; $i -lt $PlayerNames.Count; $i++) {
    $playerName = $PlayerNames[$i]
    $playerToken = New-HexToken
    $sortOrder = $i + 1
    $safePlayerName = Escape-Sql $playerName
    $playerVar = "@player_id_$sortOrder"

    $playerSqlBlocks += @"
INSERT INTO $playersTable (team_id, name, sort_order, player_token)
VALUES (@team_id, '$safePlayerName', $sortOrder, '$playerToken');
SET $playerVar := LAST_INSERT_ID();
"@
    $playerLinkLines += ($playerName + ": " + $BaseUrl.TrimEnd("/") + "/index.html?token=" + $playerToken)
}
$playerLinksText = $playerLinkLines -join [Environment]::NewLine

# Feste Demosaison (Vorfuehrung): von Dienstag 24.3. bis Dienstag 21.4.2026.
# Trainings jeweils mittwochs; letzter Termin-Mittwoch innerhalb der Saison = 15.4.2026.
# Weekday-Parameter = ISO 1=Mo .. 7=So, Standard 3 = Mittwoch.
$seasonStart = Get-Date -Year 2026 -Month 3 -Day 24
$seasonEnd = Get-Date -Year 2026 -Month 4 -Day 21
$sessionDate1 = Get-Date -Year 2026 -Month 3 -Day 25
$sessionDate2 = Get-Date -Year 2026 -Month 4 -Day 1
$sessionDate3 = Get-Date -Year 2026 -Month 4 -Day 8
$sessionDate4 = Get-Date -Year 2026 -Month 4 -Day 15

$seasonType = "custom"
$seasonName = "Demosaison"
$seasonDescription = "Demo-Team fuer Vorfuehrung, Screenshots und sichere Tests."
$safeSeasonName = Escape-Sql $seasonName
$safeSeasonDescription = Escape-Sql $seasonDescription
$responsesTable = "${TablePrefix}responses"
$seasonsTable = "${TablePrefix}seasons"
$sessionsTable = "${TablePrefix}sessions"

$playerInsertSql = $playerSqlBlocks -join "`n"

$sql = @"
START TRANSACTION;

INSERT INTO $teamsTable (name, location, weekday, start_time, duration_minutes)
VALUES ('$safeTeamName', '$safeLocation', $Weekday, '$StartTime', $DurationMinutes);

SET @team_id := LAST_INSERT_ID();

INSERT INTO $adminTokensTable (team_id, admin_token, label)
VALUES (@team_id, '$adminToken', '$safeAdminLabel');

$playerInsertSql

INSERT INTO $seasonsTable (
    team_id,
    name,
    season_type,
    start_date,
    end_date,
    default_location,
    default_weekday,
    default_start_time,
    default_duration_minutes,
    description,
    is_active
)
VALUES (
    @team_id,
    '$safeSeasonName',
    '$seasonType',
    '$(Format-IsoDate $seasonStart)',
    '$(Format-IsoDate $seasonEnd)',
    '$safeLocation',
    $Weekday,
    '$StartTime',
    $DurationMinutes,
    '$safeSeasonDescription',
    1
);
SET @season_id := LAST_INSERT_ID();

INSERT INTO $sessionsTable (team_id, season_id, session_date, location, start_time, duration_minutes, description, status, admin_note)
VALUES (@team_id, @season_id, '$(Format-IsoDate $sessionDate1)', '$safeLocation', '$StartTime', $DurationMinutes, 'Erstes Demo-Training (Demosaison).', 'scheduled', 'Start der festen Demo-Zeitraeume 24.3. bis 21.4.2026.');
SET @session_id_1 := LAST_INSERT_ID();

INSERT INTO $sessionsTable (team_id, season_id, session_date, location, start_time, duration_minutes, description, status, admin_note)
VALUES (@team_id, @season_id, '$(Format-IsoDate $sessionDate2)', '$safeLocation', '$StartTime', $DurationMinutes, 'Regulaeres Demo-Training.', 'scheduled', 'Bitte Status bis zum Vorabend setzen.');
SET @session_id_2 := LAST_INSERT_ID();

INSERT INTO $sessionsTable (team_id, season_id, session_date, location, start_time, duration_minutes, description, status, admin_note)
VALUES (@team_id, @season_id, '$(Format-IsoDate $sessionDate3)', '$safeLocation', '$StartTime', 0, 'Plausch und Matchtraining.', 'scheduled', 'Dauer absichtlich auf unbestimmt gesetzt.');
SET @session_id_3 := LAST_INSERT_ID();

INSERT INTO $sessionsTable (team_id, season_id, session_date, location, start_time, duration_minutes, description, status, admin_note)
VALUES (@team_id, @season_id, '$(Format-IsoDate $sessionDate4)', '$safeLocation', '$StartTime', $DurationMinutes, 'Reserve-Termin (letzter Mi in der Demosaison).', 'cancelled', 'Beispiel Absage am 15.4.2026; Saison endet am Di 21.4.2026.');
SET @session_id_4 := LAST_INSERT_ID();

INSERT INTO $responsesTable (session_id, player_id, attendance_status, comment)
VALUES
    (@session_id_1, @player_id_1, 'yes', 'War dabei.'),
    (@session_id_1, @player_id_2, 'yes', NULL),
    (@session_id_1, @player_id_3, 'no', 'Verhindert.'),
    (@session_id_1, @player_id_4, 'replacement', 'Bei Bedarf moeglich.'),
    (@session_id_2, @player_id_1, 'yes', NULL),
    (@session_id_2, @player_id_2, 'maybe', 'Gebe morgen Bescheid.'),
    (@session_id_2, @player_id_3, 'no', NULL),
    (@session_id_3, @player_id_4, 'replacement', 'Koennte einspringen.');

COMMIT;

SELECT
    @team_id AS team_id,
    '$safeTeamName' AS team_name,
    '$adminToken' AS admin_token,
    @season_id AS season_id;
"@

$recipientLine = if ([string]::IsNullOrWhiteSpace($RecipientName)) {
    "Hallo,"
} else {
    "Hallo $RecipientName,"
}

$mail = @"
$recipientLine

dein Demo-Zugang fuer Tennisteam ist bereit.

Admin-Link:
$adminUrl

Der Link ist vertraulich und sollte nicht oeffentlich weitergegeben werden.

Das Demo-Team enthaelt bereits 4 Beispielspieler und kann direkt fuer Tests, Screenshots oder Vorfuehrungen genutzt werden.

Viele Gruesse
"@

$sqlPath = Join-Path $outDir "${timestamp}_${slug}_demo_setup.sql"
$mailPath = Join-Path $outDir "${timestamp}_${slug}_demo_admin_mail.txt"
$playerLinksPath = Join-Path $outDir "${timestamp}_${slug}_demo_player_links.txt"

Set-Content -Path $sqlPath -Value $sql -Encoding utf8
Set-Content -Path $mailPath -Value $mail -Encoding utf8
Set-Content -Path $playerLinksPath -Value $playerLinksText -Encoding utf8

Write-Host ""
Write-Host "== Demo-Team vorbereitet ==" -ForegroundColor Cyan
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
Write-Host "SQL :        $sqlPath"
Write-Host "Mail:        $mailPath"
Write-Host "Spieler:     $playerLinksPath"
Write-Host ""
Write-Host "Naechster Schritt:" -ForegroundColor Green
Write-Host "1. SQL-Datei in phpMyAdmin ausfuehren"
Write-Host "2. Admin-Link testen"
Write-Host "3. Demo-Spielerlinks bei Bedarf intern nutzen"
