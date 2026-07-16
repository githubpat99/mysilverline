$ErrorActionPreference = "Stop"

param(
    [ValidateSet(
        "health",
        "session",
        "sessions",
        "response",
        "admin-session",
        "admin-dashboard",
        "admin-update",
        "invalid-player-token",
        "invalid-admin-token"
    )]
    [string]$Action = "health",

    [string]$BaseUrl = "https://mysilverline.it-pin.ch/htmltools/tennisteam/api",

    [string]$PlayerToken = "294310927a442ea46ddabd53f7c9e5a95f28776498cacf64f0f9c856e1c4fab8",

    [string]$AdminToken = "2d06b8bb452bdcc9e95bbe4206f46097a835d2a747df1d1505a6a277da0dc38d",

    [ValidateSet("yes", "no", "maybe", "replacement", "scheduled", "cancelled")]
    [string]$Status = "yes",

    [string]$Comment = "Bin dabei",

    [string]$AdminNote = "Training findet wie geplant statt.",

    [int]$SessionId = 0,

    [int]$SeasonId = 0
)

function Write-Json($obj) {
    $obj | ConvertTo-Json -Depth 10
}

function Assert-SuccessFalse($result, [string]$label) {
    if ($result.success -ne $false) {
        throw "$label expected success=false, got: $(Write-Json $result)"
    }
    Write-Host "OK: $label -> error=$($result.error)" -ForegroundColor Green
}

switch ($Action) {
    "health" {
        $url = "$BaseUrl/health.php"
        Write-Host "GET $url" -ForegroundColor Cyan
        $result = Invoke-RestMethod -Uri $url -Method Get
        Write-Json $result
        break
    }

    "session" {
        $url = "$BaseUrl/session.php?token=$PlayerToken"
        if ($SessionId -gt 0) {
            $url += "&session_id=$SessionId"
        }
        Write-Host "GET $url" -ForegroundColor Cyan
        $result = Invoke-RestMethod -Uri $url -Method Get
        Write-Json $result
        break
    }

    "sessions" {
        $url = "$BaseUrl/sessions.php?token=$PlayerToken"
        if ($SeasonId -gt 0) {
            $url += "&season_id=$SeasonId"
        }
        Write-Host "GET $url" -ForegroundColor Cyan
        $result = Invoke-RestMethod -Uri $url -Method Get
        Write-Json $result
        break
    }

    "response" {
        $url = "$BaseUrl/response.php"
        $body = @{
            token = $PlayerToken
            status = $Status
            comment = $Comment
        }

        if ($SessionId -gt 0) {
            $body.session_id = $SessionId
        }

        $body = $body | ConvertTo-Json

        Write-Host "POST $url" -ForegroundColor Cyan
        Write-Host $body -ForegroundColor DarkGray
        $result = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -Body $body
        Write-Json $result
        break
    }

    "admin-session" {
        $url = "$BaseUrl/admin/session.php?token=$AdminToken"
        Write-Host "GET $url" -ForegroundColor Cyan
        $result = Invoke-RestMethod -Uri $url -Method Get
        Write-Json $result
        break
    }

    "admin-dashboard" {
        $url = "$BaseUrl/admin/dashboard.php?token=$AdminToken"
        if ($SeasonId -gt 0) {
            $url += "&season_id=$SeasonId"
        }
        if ($SessionId -gt 0) {
            $url += "&session_id=$SessionId"
        }
        Write-Host "GET $url" -ForegroundColor Cyan
        $result = Invoke-RestMethod -Uri $url -Method Get
        Write-Json $result
        break
    }

    "admin-update" {
        $url = "$BaseUrl/admin/session-update.php"
        $payload = @{
            token = $AdminToken
            status = $Status
            admin_note = $AdminNote
        }

        if ($SessionId -gt 0) {
            $payload.session_id = $SessionId
        }

        $body = $payload | ConvertTo-Json

        Write-Host "POST $url" -ForegroundColor Cyan
        Write-Host $body -ForegroundColor DarkGray
        $result = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -Body $body
        Write-Json $result
        break
    }

    "invalid-player-token" {
        $url = "$BaseUrl/sessions.php?token=invalid-token-smoke-test"
        Write-Host "GET $url (expect 403)" -ForegroundColor Cyan
        try {
            Invoke-RestMethod -Uri $url -Method Get
            throw "Expected HTTP error for invalid player token"
        }
        catch {
            $resp = $_.ErrorDetails.Message
            if (-not $resp) { throw $_ }
            $result = $resp | ConvertFrom-Json
            Assert-SuccessFalse $result "invalid-player-token"
            Write-Json $result
        }
        break
    }

    "invalid-admin-token" {
        $url = "$BaseUrl/admin/dashboard.php?token=invalid-token-smoke-test"
        Write-Host "GET $url (expect 403)" -ForegroundColor Cyan
        try {
            Invoke-RestMethod -Uri $url -Method Get
            throw "Expected HTTP error for invalid admin token"
        }
        catch {
            $resp = $_.ErrorDetails.Message
            if (-not $resp) { throw $_ }
            $result = $resp | ConvertFrom-Json
            Assert-SuccessFalse $result "invalid-admin-token"
            Write-Json $result
        }
        break
    }
}
