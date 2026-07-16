<?php

declare(strict_types=1);

function attendanceStatuses(): array
{
    return ['yes', 'no', 'maybe', 'replacement'];
}

function sessionStatuses(): array
{
    return ['scheduled', 'provisional', 'completed', 'cancelled'];
}

function isValidAttendanceStatus(string $status): bool
{
    return in_array($status, attendanceStatuses(), true);
}

function isValidSessionStatus(string $status): bool
{
    return in_array($status, sessionStatuses(), true);
}

/** Spieler-API: alle gueltigen Status sichtbar (inkl. provisorisch, mit Kennzeichnung in der App). */
function isPublishedSessionStatus(string $status): bool
{
    return isValidSessionStatus($status);
}

function trimComment(?string $comment, int $maxLength = 255): ?string
{
    if ($comment === null) {
        return null;
    }

    $comment = trim($comment);
    if ($comment === '') {
        return null;
    }

    if (function_exists('mb_substr')) {
        return mb_substr($comment, 0, $maxLength);
    }

    return substr($comment, 0, $maxLength);
}

function serializeTeamContext(array $context): array
{
    return [
        'id' => (int) $context['team_id'],
        'name' => $context['team_name'],
        'location' => $context['location'],
        'weekday' => (int) $context['weekday'],
        'start_time' => $context['start_time'],
        'duration_minutes' => (int) $context['duration_minutes'],
    ];
}

function resolveSessionSchedule(array $context, ?array $season, array $session): array
{
    $resolvedLocation = $session['location'] ?? null;
    if (!is_string($resolvedLocation) || trim($resolvedLocation) === '') {
        $resolvedLocation = $season['default_location'] ?? $context['location'] ?? null;
    }

    $resolvedStartTime = $session['start_time'] ?? null;
    if (!is_string($resolvedStartTime) || trim($resolvedStartTime) === '') {
        $resolvedStartTime = $season['default_start_time'] ?? $context['start_time'] ?? null;
    }

    $resolvedDuration = $session['duration_minutes'] ?? null;
    if ($resolvedDuration === null || $resolvedDuration === '') {
        $resolvedDuration = $season['default_duration_minutes'] ?? $context['duration_minutes'] ?? null;
    }

    $resolvedDescription = $session['description'] ?? null;
    if (!is_string($resolvedDescription) || trim($resolvedDescription) === '') {
        $resolvedDescription = $season['description'] ?? null;
    }

    return [
        'location' => is_string($resolvedLocation) && trim($resolvedLocation) !== '' ? $resolvedLocation : null,
        'start_time' => is_string($resolvedStartTime) && trim($resolvedStartTime) !== '' ? $resolvedStartTime : null,
        'duration_minutes' => $resolvedDuration === null ? null : (int) $resolvedDuration,
        'description' => is_string($resolvedDescription) && trim($resolvedDescription) !== '' ? $resolvedDescription : null,
    ];
}

function resolveSessionStatus(
    string $status,
    string $sessionDate,
    ?string $startTime,
    ?int $durationMinutes
): string {
    if ($status === 'cancelled' || $status === 'completed') {
        return $status;
    }

    if ($status !== 'scheduled' && $status !== 'provisional') {
        return $status;
    }

    if (!isValidIsoDate($sessionDate)) {
        return $status;
    }

    $now = new DateTimeImmutable('now');
    $timeValue = is_string($startTime) ? substr(trim($startTime), 0, 5) : '';

    if ($timeValue === '') {
        $sessionDay = new DateTimeImmutable($sessionDate);
        $today = new DateTimeImmutable('today');
        return $sessionDay < $today ? 'completed' : $status;
    }

    if (!preg_match('/^\d{2}:\d{2}$/', $timeValue)) {
        return $status;
    }

    $sessionStart = DateTimeImmutable::createFromFormat('Y-m-d H:i', $sessionDate . ' ' . $timeValue);
    if (!$sessionStart instanceof DateTimeImmutable) {
        return $status;
    }

    $sessionEnd = $durationMinutes !== null && $durationMinutes > 0
        ? $sessionStart->modify('+' . $durationMinutes . ' minutes')
        : $sessionStart;

    return $sessionEnd < $now ? 'completed' : $status;
}

function serializeSession(array $context, ?array $season, array $session): array
{
    $resolved = resolveSessionSchedule($context, $season, $session);
    $resolvedStatus = resolveSessionStatus(
        (string) $session['status'],
        (string) $session['session_date'],
        $resolved['start_time'],
        $resolved['duration_minutes']
    );

    return [
        'id' => (int) $session['id'],
        'season_id' => isset($session['season_id']) && $session['season_id'] !== null ? (int) $session['season_id'] : null,
        'session_date' => $session['session_date'],
        'status' => $resolvedStatus,
        'location' => $resolved['location'],
        'start_time' => $resolved['start_time'],
        'duration_minutes' => $resolved['duration_minutes'],
        'description' => $resolved['description'],
        'admin_note' => $session['admin_note'] ?: null,
    ];
}

function fetchPlayerContextByToken(PDO $pdo, string $token): ?array
{
    $playersTable = tnTable('players');
    $teamsTable = tnTable('teams');

    $stmt = $pdo->prepare(
        "SELECT
            p.id AS player_id,
            p.name AS player_name,
            p.team_id,
            t.name AS team_name,
            t.location,
            t.weekday,
            t.start_time,
            t.duration_minutes
        FROM {$playersTable} p
        INNER JOIN {$teamsTable} t ON t.id = p.team_id
        WHERE p.player_token = :token
          AND p.is_active = 1
          AND t.is_active = 1
        LIMIT 1"
    );
    $stmt->execute(['token' => $token]);

    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

function fetchAdminContextByToken(PDO $pdo, string $token): ?array
{
    $adminTokensTable = tnTable('admin_tokens');
    $teamsTable = tnTable('teams');

    $stmt = $pdo->prepare(
        "SELECT
            a.id AS admin_id,
            a.team_id,
            a.label AS admin_label,
            t.name AS team_name,
            t.location,
            t.weekday,
            t.start_time,
            t.duration_minutes
        FROM {$adminTokensTable} a
        INNER JOIN {$teamsTable} t ON t.id = a.team_id
        WHERE a.admin_token = :token
          AND a.is_active = 1
          AND t.is_active = 1
        LIMIT 1"
    );
    $stmt->execute(['token' => $token]);

    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

function fetchNextSessionForTeam(PDO $pdo, int $teamId): ?array
{
    $sessionsTable = tnTable('sessions');

    $stmt = $pdo->prepare(
        "SELECT id, team_id, season_id, session_date, location, start_time, duration_minutes, description, status, admin_note
        FROM {$sessionsTable}
        WHERE team_id = :team_id
          AND session_date >= CURDATE()
        ORDER BY session_date ASC
        LIMIT 1"
    );
    $stmt->execute(['team_id' => $teamId]);
    $session = $stmt->fetch();

    if ($session !== false) {
        return $session;
    }

    $fallbackStmt = $pdo->prepare(
        "SELECT id, team_id, season_id, session_date, location, start_time, duration_minutes, description, status, admin_note
        FROM {$sessionsTable}
        WHERE team_id = :team_id
        ORDER BY session_date DESC
        LIMIT 1"
    );
    $fallbackStmt->execute(['team_id' => $teamId]);
    $fallback = $fallbackStmt->fetch();

    return $fallback === false ? null : $fallback;
}

function fetchPublishedNextSessionForTeam(PDO $pdo, int $teamId): ?array
{
    $sessionsTable = tnTable('sessions');

    $stmt = $pdo->prepare(
        "SELECT id, team_id, season_id, session_date, location, start_time, duration_minutes, description, status, admin_note
        FROM {$sessionsTable}
        WHERE team_id = :team_id
          AND session_date >= CURDATE()
        ORDER BY session_date ASC
        LIMIT 1"
    );
    $stmt->execute(['team_id' => $teamId]);
    $session = $stmt->fetch();

    if ($session !== false) {
        return $session;
    }

    $fallbackStmt = $pdo->prepare(
        "SELECT id, team_id, season_id, session_date, location, start_time, duration_minutes, description, status, admin_note
        FROM {$sessionsTable}
        WHERE team_id = :team_id
        ORDER BY session_date DESC
        LIMIT 1"
    );
    $fallbackStmt->execute(['team_id' => $teamId]);
    $fallback = $fallbackStmt->fetch();

    return $fallback === false ? null : $fallback;
}

function fetchSessionForTeam(PDO $pdo, int $teamId, int $sessionId): ?array
{
    $sessionsTable = tnTable('sessions');

    $stmt = $pdo->prepare(
        "SELECT id, team_id, season_id, session_date, location, start_time, duration_minutes, description, status, admin_note
        FROM {$sessionsTable}
        WHERE id = :session_id
          AND team_id = :team_id
        LIMIT 1"
    );
    $stmt->execute([
        'session_id' => $sessionId,
        'team_id' => $teamId,
    ]);

    $session = $stmt->fetch();
    return $session === false ? null : $session;
}

function fetchPublishedSessionForTeam(PDO $pdo, int $teamId, int $sessionId): ?array
{
    $session = fetchSessionForTeam($pdo, $teamId, $sessionId);
    if ($session === null) {
        return null;
    }

    return isPublishedSessionStatus((string) $session['status']) ? $session : null;
}

function fetchSeasonsForTeam(PDO $pdo, int $teamId): array
{
    $seasonsTable = tnTable('seasons');

    $stmt = $pdo->prepare(
        "SELECT id, team_id, name, season_type, start_date, end_date, default_location, default_weekday, default_start_time, default_duration_minutes, description, is_active, display_priority
        FROM {$seasonsTable}
        WHERE team_id = :team_id
        ORDER BY COALESCE(display_priority, 9999) ASC, start_date DESC"
    );
    $stmt->execute(['team_id' => $teamId]);

    return $stmt->fetchAll();
}

function fetchSeasonForTeam(PDO $pdo, int $teamId, int $seasonId): ?array
{
    $seasonsTable = tnTable('seasons');

    $stmt = $pdo->prepare(
        "SELECT id, team_id, name, season_type, start_date, end_date, default_location, default_weekday, default_start_time, default_duration_minutes, description, is_active, display_priority
        FROM {$seasonsTable}
        WHERE id = :season_id
          AND team_id = :team_id
        LIMIT 1"
    );
    $stmt->execute([
        'season_id' => $seasonId,
        'team_id' => $teamId,
    ]);

    $season = $stmt->fetch();
    return $season === false ? null : $season;
}

function fetchCurrentSeasonForTeam(PDO $pdo, int $teamId): ?array
{
    $seasonsTable = tnTable('seasons');

    $stmt = $pdo->prepare(
        "SELECT id, team_id, name, season_type, start_date, end_date, default_location, default_weekday, default_start_time, default_duration_minutes, description, is_active, display_priority
        FROM {$seasonsTable}
        WHERE team_id = :team_id
          AND is_active = 1
          AND CURDATE() BETWEEN start_date AND end_date
        ORDER BY COALESCE(display_priority, 9999) ASC, start_date DESC
        LIMIT 1"
    );
    $stmt->execute(['team_id' => $teamId]);
    $season = $stmt->fetch();

    if ($season !== false) {
        return $season;
    }

    $futureStmt = $pdo->prepare(
        "SELECT id, team_id, name, season_type, start_date, end_date, default_location, default_weekday, default_start_time, default_duration_minutes, description, is_active, display_priority
        FROM {$seasonsTable}
        WHERE team_id = :team_id
          AND is_active = 1
          AND start_date > CURDATE()
        ORDER BY COALESCE(display_priority, 9999) ASC, start_date ASC
        LIMIT 1"
    );
    $futureStmt->execute(['team_id' => $teamId]);
    $futureSeason = $futureStmt->fetch();

    if ($futureSeason !== false) {
        return $futureSeason;
    }

    $pastStmt = $pdo->prepare(
        "SELECT id, team_id, name, season_type, start_date, end_date, default_location, default_weekday, default_start_time, default_duration_minutes, description, is_active, display_priority
        FROM {$seasonsTable}
        WHERE team_id = :team_id
        ORDER BY COALESCE(display_priority, 9999) ASC, end_date DESC
        LIMIT 1"
    );
    $pastStmt->execute(['team_id' => $teamId]);
    $pastSeason = $pastStmt->fetch();

    return $pastSeason === false ? null : $pastSeason;
}

function fetchSessionsForSeason(PDO $pdo, int $teamId, int $seasonId): array
{
    $sessionsTable = tnTable('sessions');

    $stmt = $pdo->prepare(
        "SELECT id, team_id, season_id, session_date, location, start_time, duration_minutes, description, status, admin_note
        FROM {$sessionsTable}
        WHERE team_id = :team_id
          AND season_id = :season_id
        ORDER BY session_date ASC"
    );
    $stmt->execute([
        'team_id' => $teamId,
        'season_id' => $seasonId,
    ]);

    return $stmt->fetchAll();
}

function fetchPublishedSessionsForSeason(PDO $pdo, int $teamId, int $seasonId): array
{
    $sessionsTable = tnTable('sessions');

    $stmt = $pdo->prepare(
        "SELECT id, team_id, season_id, session_date, location, start_time, duration_minutes, description, status, admin_note
        FROM {$sessionsTable}
        WHERE team_id = :team_id
          AND season_id = :season_id
        ORDER BY session_date ASC"
    );
    $stmt->execute([
        'team_id' => $teamId,
        'season_id' => $seasonId,
    ]);

    return $stmt->fetchAll();
}

function seasonAccessDeniedForSeasonMessage(): string
{
    return 'Du hast fuer diese Saison keinen Zugang.';
}

function seasonAccessDeniedNoVisibleSeasonMessage(): string
{
    return 'Du hast fuer keine Saison Zugang.';
}

function isPlayerExcludedFromSeason(PDO $pdo, int $teamId, int $seasonId, int $playerId): bool
{
    if ($seasonId <= 0) {
        return false;
    }

    $season = fetchSeasonForTeam($pdo, $teamId, $seasonId);
    if ($season === null) {
        return false;
    }

    $table = tnTable('season_player_exclusions');
    $stmt = $pdo->prepare(
        "SELECT 1 FROM {$table} WHERE season_id = :season_id AND player_id = :player_id LIMIT 1"
    );
    $stmt->execute([
        'season_id' => $seasonId,
        'player_id' => $playerId,
    ]);

    return $stmt->fetch() !== false;
}

function filterSeasonsForPlayer(PDO $pdo, int $teamId, int $playerId, array $seasons): array
{
    $visible = [];
    foreach ($seasons as $season) {
        if (!isPlayerExcludedFromSeason($pdo, $teamId, (int) $season['id'], $playerId)) {
            $visible[] = $season;
        }
    }

    return $visible;
}

function pickDefaultSeasonFromCandidates(array $seasons): ?array
{
    if ($seasons === []) {
        return null;
    }

    $ranked = [];
    foreach ($seasons as $s) {
        if (!(int) ($s['is_active'] ?? 0)) {
            continue;
        }
        $priority = isset($s['display_priority']) && $s['display_priority'] !== null ? (int) $s['display_priority'] : 0;
        if ($priority > 0) {
            $ranked[] = $s;
        }
    }
    if ($ranked !== []) {
        usort($ranked, static function (array $a, array $b): int {
            $pa = (int) ($a['display_priority'] ?? 9999);
            $pb = (int) ($b['display_priority'] ?? 9999);
            if ($pa !== $pb) {
                return $pa <=> $pb;
            }
            return strcmp((string) ($b['start_date'] ?? ''), (string) ($a['start_date'] ?? ''));
        });
        return $ranked[0];
    }

    $today = (new DateTimeImmutable('today'))->format('Y-m-d');

    $activeInRange = null;
    foreach ($seasons as $s) {
        if (!(int) $s['is_active']) {
            continue;
        }
        if ($today >= $s['start_date'] && $today <= $s['end_date']) {
            if ($activeInRange === null || $s['start_date'] > $activeInRange['start_date']) {
                $activeInRange = $s;
            }
        }
    }
    if ($activeInRange !== null) {
        return $activeInRange;
    }

    $future = null;
    foreach ($seasons as $s) {
        if (!(int) $s['is_active']) {
            continue;
        }
        if ($s['start_date'] > $today) {
            if ($future === null || $s['start_date'] < $future['start_date']) {
                $future = $s;
            }
        }
    }
    if ($future !== null) {
        return $future;
    }

    $past = null;
    foreach ($seasons as $s) {
        if ($past === null || $s['end_date'] > $past['end_date']) {
            $past = $s;
        }
    }

    return $past;
}

function fetchSeasonExcludedPlayerIds(PDO $pdo, int $teamId, int $seasonId): array
{
    $season = fetchSeasonForTeam($pdo, $teamId, $seasonId);
    if ($season === null) {
        return [];
    }

    $table = tnTable('season_player_exclusions');
    $playersTable = tnTable('players');
    $stmt = $pdo->prepare(
        "SELECT e.player_id
        FROM {$table} e
        INNER JOIN {$playersTable} p ON p.id = e.player_id AND p.team_id = :team_id
        WHERE e.season_id = :season_id
        ORDER BY e.player_id ASC"
    );
    $stmt->execute(['team_id' => $teamId, 'season_id' => $seasonId]);

    return array_map(static function (array $row): int {
        return (int) $row['player_id'];
    }, $stmt->fetchAll());
}

function validatePlayerIdsBelongToTeam(PDO $pdo, int $teamId, array $playerIds): void
{
    $clean = [];
    foreach ($playerIds as $id) {
        $i = (int) $id;
        if ($i > 0) {
            $clean[] = $i;
        }
    }
    $clean = array_values(array_unique($clean));

    if ($clean === []) {
        return;
    }

    $playersTable = tnTable('players');
    $placeholders = implode(',', array_fill(0, count($clean), '?'));
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) FROM {$playersTable} WHERE team_id = ? AND id IN ({$placeholders})"
    );
    $stmt->execute(array_merge([$teamId], $clean));
    if ((int) $stmt->fetchColumn() !== count($clean)) {
        throw new InvalidArgumentException('Invalid player selection for this team.');
    }
}

function setSeasonExcludedPlayerIds(PDO $pdo, int $teamId, int $seasonId, array $playerIds): void
{
    $season = fetchSeasonForTeam($pdo, $teamId, $seasonId);
    if ($season === null) {
        throw new InvalidArgumentException('Season not found.');
    }

    $normalized = [];
    foreach ($playerIds as $id) {
        $i = (int) $id;
        if ($i > 0) {
            $normalized[] = $i;
        }
    }
    $normalized = array_values(array_unique($normalized));

    validatePlayerIdsBelongToTeam($pdo, $teamId, $normalized);

    $table = tnTable('season_player_exclusions');
    $del = $pdo->prepare("DELETE FROM {$table} WHERE season_id = :season_id");
    $del->execute(['season_id' => $seasonId]);

    if ($normalized === []) {
        return;
    }

    $ins = $pdo->prepare(
        "INSERT INTO {$table} (season_id, player_id) VALUES (:season_id, :player_id)"
    );
    foreach ($normalized as $pid) {
        $ins->execute(['season_id' => $seasonId, 'player_id' => $pid]);
    }
}

function fetchPublishedNextSessionForPlayer(PDO $pdo, int $teamId, int $playerId): ?array
{
    $sessionsTable = tnTable('sessions');
    $exclusionsTable = tnTable('season_player_exclusions');

    $stmt = $pdo->prepare(
        "SELECT s.id, s.team_id, s.season_id, s.session_date, s.location, s.start_time, s.duration_minutes, s.description, s.status, s.admin_note
        FROM {$sessionsTable} s
        LEFT JOIN {$exclusionsTable} ex
            ON ex.season_id = s.season_id
           AND ex.player_id = :player_id
        WHERE s.team_id = :team_id
          AND s.session_date >= CURDATE()
          AND (s.season_id IS NULL OR ex.player_id IS NULL)
        ORDER BY s.session_date ASC
        LIMIT 1"
    );
    $stmt->execute([
        'team_id' => $teamId,
        'player_id' => $playerId,
    ]);
    $session = $stmt->fetch();

    if ($session !== false) {
        return $session;
    }

    $fallbackStmt = $pdo->prepare(
        "SELECT s.id, s.team_id, s.season_id, s.session_date, s.location, s.start_time, s.duration_minutes, s.description, s.status, s.admin_note
        FROM {$sessionsTable} s
        LEFT JOIN {$exclusionsTable} ex
            ON ex.season_id = s.season_id
           AND ex.player_id = :player_id
        WHERE s.team_id = :team_id
          AND (s.season_id IS NULL OR ex.player_id IS NULL)
        ORDER BY s.session_date DESC
        LIMIT 1"
    );
    $fallbackStmt->execute([
        'team_id' => $teamId,
        'player_id' => $playerId,
    ]);
    $fallback = $fallbackStmt->fetch();

    return $fallback === false ? null : $fallback;
}

function fetchResponsesForSession(PDO $pdo, int $teamId, int $sessionId): array
{
    $playersTable = tnTable('players');
    $responsesTable = tnTable('responses');
    $sessionsTable = tnTable('sessions');
    $exclusionsTable = tnTable('season_player_exclusions');

    $stmt = $pdo->prepare(
        "SELECT
            p.id AS player_id,
            p.name AS player_name,
            p.license_number,
            p.classification,
            p.sort_order,
            r.attendance_status,
            r.comment,
            r.updated_at
        FROM {$playersTable} p
        INNER JOIN {$sessionsTable} s
            ON s.id = :session_id
           AND s.team_id = p.team_id
        LEFT JOIN {$responsesTable} r
            ON r.player_id = p.id
           AND r.session_id = s.id
        LEFT JOIN {$exclusionsTable} ex
            ON ex.season_id = s.season_id
           AND ex.player_id = p.id
        WHERE p.team_id = :team_id
          AND p.is_active = 1
          AND (s.season_id IS NULL OR ex.player_id IS NULL)
        ORDER BY p.sort_order ASC, p.name ASC"
    );
    $stmt->execute([
        'session_id' => $sessionId,
        'team_id' => $teamId,
    ]);

    return $stmt->fetchAll();
}

function summarizeResponses(array $players): array
{
    $summary = [
        'total_players' => count($players),
        'responded' => 0,
        'missing' => 0,
        'yes' => 0,
        'no' => 0,
        'maybe' => 0,
        'replacement' => 0,
    ];

    foreach ($players as $player) {
        $status = $player['attendance_status'] ?? null;
        if (!is_string($status) || $status === '') {
            $summary['missing']++;
            continue;
        }

        $summary['responded']++;
        if (array_key_exists($status, $summary)) {
            $summary[$status]++;
        }
    }

    return $summary;
}

function serializePlayerRows(array $rows, ?int $currentPlayerId = null): array
{
    return array_map(static function (array $row) use ($currentPlayerId): array {
        $playerId = (int) $row['player_id'];

        return [
            'id' => $playerId,
            'name' => $row['player_name'],
            'license_number' => isset($row['license_number']) && $row['license_number'] !== '' && $row['license_number'] !== null
                ? (string) $row['license_number']
                : null,
            'classification' => isset($row['classification']) && $row['classification'] !== '' && $row['classification'] !== null
                ? (string) $row['classification']
                : null,
            'sort_order' => (int) $row['sort_order'],
            'attendance_status' => $row['attendance_status'] ?: null,
            'comment' => $row['comment'] ?: null,
            'updated_at' => $row['updated_at'] ?: null,
            'is_current_player' => $currentPlayerId !== null && $currentPlayerId === $playerId,
        ];
    }, $rows);
}

function buildSessionPayload(array $context, ?array $season, ?array $session, array $playerRows, ?int $currentPlayerId = null): array
{
    $players = serializePlayerRows($playerRows, $currentPlayerId);
    $ownResponse = null;

    if ($currentPlayerId !== null) {
        foreach ($players as $player) {
            if ($player['id'] === $currentPlayerId) {
                $ownResponse = $player;
                break;
            }
        }
    }

    return [
        'team' => serializeTeamContext($context),
        'season' => $season === null ? null : serializeSeason($season),
        'session' => $session === null ? null : serializeSession($context, $season, $session),
        'players' => $players,
        'summary' => summarizeResponses($players),
        'own_response' => $ownResponse,
    ];
}

function serializeSeason(array $season): array
{
    return [
        'id' => (int) $season['id'],
        'name' => $season['name'],
        'season_type' => $season['season_type'],
        'start_date' => $season['start_date'],
        'end_date' => $season['end_date'],
        'default_location' => $season['default_location'] ?: null,
        'default_weekday' => isset($season['default_weekday']) && $season['default_weekday'] !== null ? (int) $season['default_weekday'] : null,
        'default_start_time' => $season['default_start_time'] ?: null,
        'default_duration_minutes' => isset($season['default_duration_minutes']) && $season['default_duration_minutes'] !== null ? (int) $season['default_duration_minutes'] : null,
        'description' => $season['description'] ?: null,
        'is_active' => (bool) $season['is_active'],
        'display_priority' => isset($season['display_priority']) && $season['display_priority'] !== null ? (int) $season['display_priority'] : null,
    ];
}

function serializeOwnResponse(?array $playerRows, int $currentPlayerId): ?array
{
    if ($playerRows === null) {
        return null;
    }

    $players = serializePlayerRows($playerRows, $currentPlayerId);
    foreach ($players as $player) {
        if ($player['id'] === $currentPlayerId) {
            return $player;
        }
    }

    return null;
}

function buildSeasonSessionsPayload(array $context, array $season, array $seasons, array $sessions, int $currentPlayerId, PDO $pdo): array
{
    $sessionItems = [];

    foreach ($sessions as $session) {
        $playerRows = fetchResponsesForSession($pdo, (int) $context['team_id'], (int) $session['id']);
        $players = serializePlayerRows($playerRows, $currentPlayerId);

        $sessionItems[] = array_merge(
            serializeSession($context, $season, $session),
            [
                'summary' => summarizeResponses($players),
                'own_response' => serializeOwnResponse($playerRows, $currentPlayerId),
            ]
        );
    }

    return [
        'team' => serializeTeamContext($context),
        'season' => serializeSeason($season),
        'seasons' => array_map('serializeSeason', $seasons),
        'sessions' => $sessionItems,
    ];
}

function upsertResponse(PDO $pdo, int $sessionId, int $playerId, string $status, ?string $comment): void
{
    $responsesTable = tnTable('responses');

    $stmt = $pdo->prepare(
        "INSERT INTO {$responsesTable} (session_id, player_id, attendance_status, comment)
        VALUES (:session_id, :player_id, :attendance_status, :comment)
        ON DUPLICATE KEY UPDATE
            attendance_status = VALUES(attendance_status),
            comment = VALUES(comment),
            updated_at = CURRENT_TIMESTAMP"
    );
    $stmt->execute([
        'session_id' => $sessionId,
        'player_id' => $playerId,
        'attendance_status' => $status,
        'comment' => trimComment($comment, 255),
    ]);
}

function deleteResponse(PDO $pdo, int $sessionId, int $playerId): void
{
    $responsesTable = tnTable('responses');

    $stmt = $pdo->prepare(
        "DELETE FROM {$responsesTable}
        WHERE session_id = :session_id
          AND player_id = :player_id"
    );
    $stmt->execute([
        'session_id' => $sessionId,
        'player_id' => $playerId,
    ]);
}

function updateSessionFields(
    PDO $pdo,
    int $sessionId,
    string $sessionDate,
    string $status,
    ?string $adminNote,
    ?string $location,
    ?string $startTime,
    ?int $durationMinutes,
    ?string $description
): void
{
    $sessionsTable = tnTable('sessions');

    $stmt = $pdo->prepare(
        "UPDATE {$sessionsTable}
        SET session_date = :session_date,
            status = :status,
            admin_note = :admin_note,
            location = :location,
            start_time = :start_time,
            duration_minutes = :duration_minutes,
            description = :description,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = :session_id"
    );
    $stmt->execute([
        'session_date' => $sessionDate,
        'status' => $status,
        'admin_note' => trimComment($adminNote, 500),
        'location' => trimComment($location, 255),
        'start_time' => $startTime,
        'duration_minutes' => $durationMinutes,
        'description' => trimComment($description, 500),
        'session_id' => $sessionId,
    ]);
}

function seasonTypes(): array
{
    return ['summer', 'winter', 'interclub', 'custom'];
}

function isValidSeasonType(string $seasonType): bool
{
    return in_array($seasonType, seasonTypes(), true);
}

function isValidIsoDate(string $value): bool
{
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        return false;
    }

    $date = DateTimeImmutable::createFromFormat('Y-m-d', $value);
    return $date instanceof DateTimeImmutable && $date->format('Y-m-d') === $value;
}

function trimName(string $value, int $maxLength = 120): string
{
    $value = trim($value);
    if ($value === '') {
        throw new InvalidArgumentException('Name must not be empty.');
    }

    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $maxLength);
    }

    return substr($value, 0, $maxLength);
}

/** Schweizer Tennis: genau `999.99.999.9` oder leer. */
function normalizePlayerLicenseNumber(?string $value): ?string
{
    if ($value === null) {
        return null;
    }

    $v = trim($value);
    if ($v === '') {
        return null;
    }

    if (!preg_match('/^\d{3}\.\d{2}\.\d{3}\.\d{1}$/', $v)) {
        throw new InvalidArgumentException('Lizenz-Nr. im Format 999.99.999.9 (z. B. 123.45.678.9).');
    }

    return $v;
}

/** N1–N4 oder R1–R9, oder leer. */
function normalizePlayerClassification(?string $value): ?string
{
    if ($value === null) {
        return null;
    }

    $v = strtoupper(trim($value));
    if ($v === '') {
        return null;
    }

    static $allowed = ['N1', 'N2', 'N3', 'N4', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9'];
    if (!in_array($v, $allowed, true)) {
        throw new InvalidArgumentException('Klassierung: N1–N4 oder R1–R9.');
    }

    return $v;
}

function generateSecureToken(int $bytes = 32): string
{
    return bin2hex(random_bytes($bytes));
}

function fetchPlayersForTeamRoster(PDO $pdo, int $teamId): array
{
    $playersTable = tnTable('players');

    $stmt = $pdo->prepare(
        "SELECT id, team_id, name, license_number, classification, sort_order, player_token, is_active
        FROM {$playersTable}
        WHERE team_id = :team_id
        ORDER BY sort_order ASC, name ASC"
    );
    $stmt->execute(['team_id' => $teamId]);

    return $stmt->fetchAll();
}

function fetchPlayerForTeam(PDO $pdo, int $teamId, int $playerId): ?array
{
    $playersTable = tnTable('players');

    $stmt = $pdo->prepare(
        "SELECT id, team_id, name, license_number, classification, sort_order, player_token, is_active
        FROM {$playersTable}
        WHERE id = :player_id
          AND team_id = :team_id
        LIMIT 1"
    );
    $stmt->execute([
        'player_id' => $playerId,
        'team_id' => $teamId,
    ]);

    $player = $stmt->fetch();
    return $player === false ? null : $player;
}

function serializeAdminPlayers(array $rows): array
{
    return array_map(static function (array $row): array {
        return [
            'id' => (int) $row['id'],
            'team_id' => (int) $row['team_id'],
            'name' => $row['name'],
            'license_number' => isset($row['license_number']) && $row['license_number'] !== '' && $row['license_number'] !== null
                ? (string) $row['license_number']
                : null,
            'classification' => isset($row['classification']) && $row['classification'] !== '' && $row['classification'] !== null
                ? (string) $row['classification']
                : null,
            'sort_order' => (int) $row['sort_order'],
            'player_token' => $row['player_token'],
            'is_active' => (bool) $row['is_active'],
        ];
    }, $rows);
}

function getRelevantSessionId(array $sessions): ?int
{
    if ($sessions === []) {
        return null;
    }

    $today = (new DateTimeImmutable('today'))->format('Y-m-d');
    foreach ($sessions as $session) {
        if (($session['session_date'] ?? '') >= $today) {
            return (int) $session['id'];
        }
    }

    return (int) $sessions[0]['id'];
}

function buildAdminSeasonSessionItems(PDO $pdo, int $teamId, array $context, ?array $season, array $sessions): array
{
    $items = [];

    foreach ($sessions as $session) {
        $playerRows = fetchResponsesForSession($pdo, $teamId, (int) $session['id']);
        $players = serializePlayerRows($playerRows);

        $items[] = array_merge(
            serializeSession($context, $season, $session),
            [
                'summary' => summarizeResponses($players),
            ]
        );
    }

    return $items;
}

function setActiveSeason(PDO $pdo, int $teamId, int $seasonId): void
{
    $seasonsTable = tnTable('seasons');

    $stmt = $pdo->prepare(
        "UPDATE {$seasonsTable}
        SET is_active = CASE WHEN id = :season_id THEN 1 ELSE 0 END,
            updated_at = CURRENT_TIMESTAMP
        WHERE team_id = :team_id"
    );
    $stmt->execute([
        'season_id' => $seasonId,
        'team_id' => $teamId,
    ]);
}

function createSeason(
    PDO $pdo,
    int $teamId,
    string $name,
    string $seasonType,
    string $startDate,
    string $endDate,
    ?string $defaultLocation,
    ?int $defaultWeekday,
    ?string $defaultStartTime,
    ?int $defaultDurationMinutes,
    ?string $description,
    ?int $displayPriority,
    bool $isActive
): int {
    $seasonsTable = tnTable('seasons');

    $stmt = $pdo->prepare(
        "INSERT INTO {$seasonsTable} (
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
            display_priority,
            is_active
        )
        VALUES (
            :team_id,
            :name,
            :season_type,
            :start_date,
            :end_date,
            :default_location,
            :default_weekday,
            :default_start_time,
            :default_duration_minutes,
            :description,
            :display_priority,
            :is_active
        )"
    );
    $stmt->execute([
        'team_id' => $teamId,
        'name' => trimName($name, 120),
        'season_type' => $seasonType,
        'start_date' => $startDate,
        'end_date' => $endDate,
        'default_location' => trimComment($defaultLocation, 255),
        'default_weekday' => $defaultWeekday,
        'default_start_time' => $defaultStartTime,
        'default_duration_minutes' => $defaultDurationMinutes,
        'description' => trimComment($description, 500),
        'display_priority' => $displayPriority,
        'is_active' => $isActive ? 1 : 0,
    ]);

    $seasonId = (int) $pdo->lastInsertId();
    if ($isActive) {
        setActiveSeason($pdo, $teamId, $seasonId);
    }

    return $seasonId;
}

function updateSeason(
    PDO $pdo,
    int $teamId,
    int $seasonId,
    string $name,
    string $seasonType,
    string $startDate,
    string $endDate,
    ?string $defaultLocation,
    ?int $defaultWeekday,
    ?string $defaultStartTime,
    ?int $defaultDurationMinutes,
    ?string $description,
    ?int $displayPriority,
    bool $isActive
): void {
    $seasonsTable = tnTable('seasons');

    $stmt = $pdo->prepare(
        "UPDATE {$seasonsTable}
        SET name = :name,
            season_type = :season_type,
            start_date = :start_date,
            end_date = :end_date,
            default_location = :default_location,
            default_weekday = :default_weekday,
            default_start_time = :default_start_time,
            default_duration_minutes = :default_duration_minutes,
            description = :description,
            display_priority = :display_priority,
            is_active = :is_active,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = :season_id
          AND team_id = :team_id"
    );
    $stmt->execute([
        'season_id' => $seasonId,
        'team_id' => $teamId,
        'name' => trimName($name, 120),
        'season_type' => $seasonType,
        'start_date' => $startDate,
        'end_date' => $endDate,
        'default_location' => trimComment($defaultLocation, 255),
        'default_weekday' => $defaultWeekday,
        'default_start_time' => $defaultStartTime,
        'default_duration_minutes' => $defaultDurationMinutes,
        'description' => trimComment($description, 500),
        'display_priority' => $displayPriority,
        'is_active' => $isActive ? 1 : 0,
    ]);

    if ($isActive) {
        setActiveSeason($pdo, $teamId, $seasonId);
    }
}

function syncFutureSeasonSessionsToWeekday(
    PDO $pdo,
    int $teamId,
    int $seasonId,
    string $seasonStartDate,
    string $seasonEndDate,
    int $oldWeekday,
    int $newWeekday
): array {
    if ($oldWeekday === $newWeekday || $oldWeekday < 1 || $oldWeekday > 7 || $newWeekday < 1 || $newWeekday > 7) {
        return [
            'shifted' => 0,
            'skipped_conflicts' => 0,
            'out_of_range' => 0,
        ];
    }

    $delta = calculateWeekdayShift($oldWeekday, $newWeekday);
    $sessionsTable = tnTable('sessions');

    $fetchStmt = $pdo->prepare(
        "SELECT id, session_date
        FROM {$sessionsTable}
        WHERE team_id = :team_id
          AND season_id = :season_id
          AND session_date >= CURDATE()
        ORDER BY session_date ASC"
    );
    $fetchStmt->execute([
        'team_id' => $teamId,
        'season_id' => $seasonId,
    ]);
    $sessions = $fetchStmt->fetchAll();

    $checkStmt = $pdo->prepare(
        "SELECT id
        FROM {$sessionsTable}
        WHERE team_id = :team_id
          AND session_date = :session_date
          AND id <> :session_id
        LIMIT 1"
    );
    $updateStmt = $pdo->prepare(
        "UPDATE {$sessionsTable}
        SET session_date = :session_date,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = :session_id"
    );

    $shifted = 0;
    $skippedConflicts = 0;
    $outOfRange = 0;

    foreach ($sessions as $session) {
        $targetDate = (new DateTimeImmutable($session['session_date']))
            ->modify(($delta >= 0 ? '+' : '') . $delta . ' day')
            ->format('Y-m-d');

        if ($targetDate < $seasonStartDate || $targetDate > $seasonEndDate) {
            $outOfRange++;
            continue;
        }

        $checkStmt->execute([
            'team_id' => $teamId,
            'session_date' => $targetDate,
            'session_id' => (int) $session['id'],
        ]);

        if ($checkStmt->fetch() !== false) {
            $skippedConflicts++;
            continue;
        }

        $updateStmt->execute([
            'session_id' => (int) $session['id'],
            'session_date' => $targetDate,
        ]);
        $shifted++;
    }

    return [
        'shifted' => $shifted,
        'skipped_conflicts' => $skippedConflicts,
        'out_of_range' => $outOfRange,
    ];
}

function ensureOneActiveSeason(PDO $pdo, int $teamId): void
{
    $seasonsTable = tnTable('seasons');

    $activeStmt = $pdo->prepare(
        "SELECT id
        FROM {$seasonsTable}
        WHERE team_id = :team_id
          AND is_active = 1
        LIMIT 1"
    );
    $activeStmt->execute(['team_id' => $teamId]);
    if ($activeStmt->fetch() !== false) {
        return;
    }

    $fallbackStmt = $pdo->prepare(
        "SELECT id
        FROM {$seasonsTable}
        WHERE team_id = :team_id
        ORDER BY start_date DESC
        LIMIT 1"
    );
    $fallbackStmt->execute(['team_id' => $teamId]);
    $fallback = $fallbackStmt->fetch();
    if ($fallback === false) {
        return;
    }

    setActiveSeason($pdo, $teamId, (int) $fallback['id']);
}

function deleteSeasonWithSessions(PDO $pdo, int $teamId, int $seasonId): array
{
    $sessionsTable = tnTable('sessions');
    $seasonsTable = tnTable('seasons');

    $countStmt = $pdo->prepare(
        "SELECT COUNT(*) AS total
        FROM {$sessionsTable}
        WHERE team_id = :team_id
          AND season_id = :season_id"
    );
    $countStmt->execute([
        'team_id' => $teamId,
        'season_id' => $seasonId,
    ]);
    $sessionCount = (int) ($countStmt->fetch()['total'] ?? 0);

    $deleteSessionsStmt = $pdo->prepare(
        "DELETE FROM {$sessionsTable}
        WHERE team_id = :team_id
          AND season_id = :season_id"
    );
    $deleteSessionsStmt->execute([
        'team_id' => $teamId,
        'season_id' => $seasonId,
    ]);

    $deleteSeasonStmt = $pdo->prepare(
        "DELETE FROM {$seasonsTable}
        WHERE id = :season_id
          AND team_id = :team_id"
    );
    $deleteSeasonStmt->execute([
        'season_id' => $seasonId,
        'team_id' => $teamId,
    ]);

    ensureOneActiveSeason($pdo, $teamId);

    return [
        'deleted_sessions' => $sessionCount,
    ];
}

function generateSessionsForSeason(PDO $pdo, int $teamId, int $seasonId): int
{
    $season = fetchSeasonForTeam($pdo, $teamId, $seasonId);
    if ($season === null) {
        throw new RuntimeException('Season not found.');
    }

    $teamsTable = tnTable('teams');
    $sessionsTable = tnTable('sessions');

    $teamStmt = $pdo->prepare(
        "SELECT weekday
        FROM {$teamsTable}
        WHERE id = :team_id
        LIMIT 1"
    );
    $teamStmt->execute(['team_id' => $teamId]);
    $team = $teamStmt->fetch();

    if ($team === false) {
        throw new RuntimeException('Team not found.');
    }

    $weekday = $season['default_weekday'] !== null
        ? (int) $season['default_weekday']
        : (int) $team['weekday'];

    if ($weekday < 1 || $weekday > 7) {
        return 0;
    }

    $existingStmt = $pdo->prepare(
        "SELECT id
        FROM {$sessionsTable}
        WHERE team_id = :team_id
          AND session_date = :session_date
        LIMIT 1"
    );
    $insertStmt = $pdo->prepare(
        "INSERT INTO {$sessionsTable} (
            team_id,
            season_id,
            session_date,
            location,
            start_time,
            duration_minutes,
            description,
            status,
            admin_note
        )
        VALUES (
            :team_id,
            :season_id,
            :session_date,
            :location,
            :start_time,
            :duration_minutes,
            :description,
            'scheduled',
            NULL
        )"
    );

    $created = 0;
    $cursor = new DateTimeImmutable($season['start_date']);
    $endDate = new DateTimeImmutable($season['end_date']);

    while ($cursor <= $endDate) {
        if ((int) $cursor->format('N') === $weekday) {
            $sessionDate = $cursor->format('Y-m-d');
            $existingStmt->execute([
                'team_id' => $teamId,
                'session_date' => $sessionDate,
            ]);

            if ($existingStmt->fetch() === false) {
                $insertStmt->execute([
                    'team_id' => $teamId,
                    'season_id' => $seasonId,
                    'session_date' => $sessionDate,
                    'location' => trimComment($season['default_location'] ?? null, 255),
                    'start_time' => $season['default_start_time'] ?: null,
                    'duration_minutes' => $season['default_duration_minutes'] !== null ? (int) $season['default_duration_minutes'] : null,
                    'description' => trimComment($season['description'] ?? null, 500),
                ]);
                $created++;
            }
        }

        $cursor = $cursor->modify('+1 day');
    }

    return $created;
}

function fetchNextPlayerSortOrderForTeam(PDO $pdo, int $teamId): int
{
    $playersTable = tnTable('players');
    $stmt = $pdo->prepare(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_n
        FROM {$playersTable}
        WHERE team_id = :team_id"
    );
    $stmt->execute(['team_id' => $teamId]);
    $next = (int) $stmt->fetchColumn();
    return $next >= 1 ? $next : 1;
}

function fetchPlayerSortOrderForTeam(PDO $pdo, int $teamId, int $playerId): ?int
{
    $playersTable = tnTable('players');
    $stmt = $pdo->prepare(
        "SELECT sort_order
        FROM {$playersTable}
        WHERE id = :player_id
          AND team_id = :team_id
        LIMIT 1"
    );
    $stmt->execute([
        'player_id' => $playerId,
        'team_id' => $teamId,
    ]);
    $row = $stmt->fetch();
    if ($row === false) {
        return null;
    }

    return (int) $row['sort_order'];
}

function savePlayer(
    PDO $pdo,
    int $teamId,
    ?int $playerId,
    string $name,
    int $sortOrder,
    bool $isActive,
    bool $regenerateToken = false,
    ?string $licenseNumber = null,
    ?string $classification = null
): int {
    $playersTable = tnTable('players');
    $token = generateSecureToken();
    $licenseNorm = normalizePlayerLicenseNumber($licenseNumber);
    $classNorm = normalizePlayerClassification($classification);

    if ($playerId === null) {
        $stmt = $pdo->prepare(
            "INSERT INTO {$playersTable} (team_id, name, license_number, classification, sort_order, player_token, is_active)
            VALUES (:team_id, :name, :license_number, :classification, :sort_order, :player_token, :is_active)"
        );
        $stmt->execute([
            'team_id' => $teamId,
            'name' => trimName($name, 120),
            'license_number' => $licenseNorm,
            'classification' => $classNorm,
            'sort_order' => $sortOrder,
            'player_token' => $token,
            'is_active' => $isActive ? 1 : 0,
        ]);

        return (int) $pdo->lastInsertId();
    }

    $sql = "UPDATE {$playersTable}
        SET name = :name,
            license_number = :license_number,
            classification = :classification,
            sort_order = :sort_order,
            is_active = :is_active";

    $params = [
        'player_id' => $playerId,
        'team_id' => $teamId,
        'name' => trimName($name, 120),
        'license_number' => $licenseNorm,
        'classification' => $classNorm,
        'sort_order' => $sortOrder,
        'is_active' => $isActive ? 1 : 0,
    ];

    if ($regenerateToken) {
        $sql .= ",
            player_token = :player_token";
        $params['player_token'] = $token;
    }

    $sql .= "
        WHERE id = :player_id
          AND team_id = :team_id";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    return $playerId;
}

function deletePlayer(PDO $pdo, int $teamId, int $playerId): void
{
    $playersTable = tnTable('players');

    $stmt = $pdo->prepare(
        "DELETE FROM {$playersTable}
        WHERE id = :player_id
          AND team_id = :team_id"
    );
    $stmt->execute([
        'player_id' => $playerId,
        'team_id' => $teamId,
    ]);

    if ($stmt->rowCount() < 1) {
        throw new RuntimeException('Player not found.');
    }
}

function deleteSessionForTeam(PDO $pdo, int $teamId, int $sessionId): void
{
    $session = fetchSessionForTeam($pdo, $teamId, $sessionId);
    if ($session === null) {
        throw new RuntimeException('Session not found.');
    }

    $sessionsTable = tnTable('sessions');

    $stmt = $pdo->prepare(
        "DELETE FROM {$sessionsTable}
        WHERE id = :session_id
          AND team_id = :team_id"
    );
    $stmt->execute([
        'session_id' => $sessionId,
        'team_id' => $teamId,
    ]);

    if ($stmt->rowCount() < 1) {
        throw new RuntimeException('Session not found.');
    }
}

function updateTeamSettings(
    PDO $pdo,
    int $teamId,
    string $name,
    ?string $location
): void {
    $teamsTable = tnTable('teams');

    $stmt = $pdo->prepare(
        "UPDATE {$teamsTable}
        SET name = :name,
            location = :location,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = :team_id"
    );
    $stmt->execute([
        'team_id' => $teamId,
        'name' => trimName($name, 120),
        'location' => trimComment($location, 150),
    ]);
}

function calculateWeekdayShift(int $oldWeekday, int $newWeekday): int
{
    $delta = $newWeekday - $oldWeekday;
    if ($delta <= -4) {
        $delta += 7;
    } elseif ($delta >= 4) {
        $delta -= 7;
    }

    return $delta;
}

function shiftFutureSessionsToWeekday(PDO $pdo, int $teamId, int $oldWeekday, int $newWeekday): array
{
    if ($oldWeekday === $newWeekday) {
        return [
            'shifted' => 0,
            'skipped_conflicts' => 0,
        ];
    }

    $delta = calculateWeekdayShift($oldWeekday, $newWeekday);
    $sessionsTable = tnTable('sessions');

    $fetchStmt = $pdo->prepare(
        "SELECT id, session_date
        FROM {$sessionsTable}
        WHERE team_id = :team_id
          AND session_date >= CURDATE()
        ORDER BY session_date ASC"
    );
    $fetchStmt->execute(['team_id' => $teamId]);
    $sessions = $fetchStmt->fetchAll();

    $checkStmt = $pdo->prepare(
        "SELECT id
        FROM {$sessionsTable}
        WHERE team_id = :team_id
          AND session_date = :session_date
          AND id <> :session_id
        LIMIT 1"
    );
    $updateStmt = $pdo->prepare(
        "UPDATE {$sessionsTable}
        SET session_date = :session_date,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = :session_id"
    );

    $shifted = 0;
    $skippedConflicts = 0;

    foreach ($sessions as $session) {
        $targetDate = (new DateTimeImmutable($session['session_date']))
            ->modify(($delta >= 0 ? '+' : '') . $delta . ' day')
            ->format('Y-m-d');

        $checkStmt->execute([
            'team_id' => $teamId,
            'session_date' => $targetDate,
            'session_id' => (int) $session['id'],
        ]);

        if ($checkStmt->fetch() !== false) {
            $skippedConflicts++;
            continue;
        }

        $updateStmt->execute([
            'session_id' => (int) $session['id'],
            'session_date' => $targetDate,
        ]);
        $shifted++;
    }

    return [
        'shifted' => $shifted,
        'skipped_conflicts' => $skippedConflicts,
    ];
}
