<?php

declare(strict_types=1);

require_once __DIR__ . '/../../lib/bootstrap.php';
require_once __DIR__ . '/../../lib/json.php';
require_once __DIR__ . '/../../lib/team_data.php';

$body = readJsonBody();
$token = isset($body['token']) ? trim((string) $body['token']) : '';
$seasonId = isset($body['season_id']) ? (int) $body['season_id'] : 0;
$name = isset($body['name']) ? trim((string) $body['name']) : '';
$seasonType = isset($body['season_type']) ? trim((string) $body['season_type']) : '';
$startDate = isset($body['start_date']) ? trim((string) $body['start_date']) : '';
$endDate = isset($body['end_date']) ? trim((string) $body['end_date']) : '';
$defaultLocation = isset($body['default_location']) ? (string) $body['default_location'] : null;
$defaultWeekday = array_key_exists('default_weekday', $body) && $body['default_weekday'] !== null && $body['default_weekday'] !== ''
    ? (int) $body['default_weekday']
    : null;
$defaultStartTime = isset($body['default_start_time']) ? trim((string) $body['default_start_time']) : '';
$defaultDurationMinutes = array_key_exists('default_duration_minutes', $body) && $body['default_duration_minutes'] !== null && $body['default_duration_minutes'] !== ''
    ? (int) $body['default_duration_minutes']
    : null;
$description = isset($body['description']) ? (string) $body['description'] : null;
$isActive = (bool) ($body['is_active'] ?? false);
$generateSessions = (bool) ($body['generate_sessions'] ?? false);

if ($token === '') {
    jsonResponse([
        'success' => false,
        'error' => 'Missing admin token.',
    ], 400);
}

if ($name === '' || $seasonType === '' || $startDate === '' || $endDate === '') {
    jsonResponse([
        'success' => false,
        'error' => 'name, season_type, start_date and end_date are required.',
    ], 400);
}

if (!isValidSeasonType($seasonType)) {
    jsonResponse([
        'success' => false,
        'error' => 'Invalid season type.',
    ], 400);
}

if (!isValidIsoDate($startDate) || !isValidIsoDate($endDate) || $endDate < $startDate) {
    jsonResponse([
        'success' => false,
        'error' => 'Invalid season date range.',
    ], 400);
}

if ($defaultWeekday !== null && ($defaultWeekday < 1 || $defaultWeekday > 7)) {
    jsonResponse([
        'success' => false,
        'error' => 'Invalid default weekday.',
    ], 400);
}

if ($defaultStartTime !== '' && !preg_match('/^\d{2}:\d{2}$/', $defaultStartTime)) {
    jsonResponse([
        'success' => false,
        'error' => 'Invalid default start time.',
    ], 400);
}

if ($defaultDurationMinutes !== null && $defaultDurationMinutes <= 0) {
    jsonResponse([
        'success' => false,
        'error' => 'Invalid default duration.',
    ], 400);
}

try {
    $pdo = db();
    $context = fetchAdminContextByToken($pdo, $token);

    if ($context === null) {
        jsonResponse([
            'success' => false,
            'error' => 'Invalid admin token.',
        ], 403);
    }

    $teamId = (int) $context['team_id'];
    $pdo->beginTransaction();
    $syncResult = [
        'shifted' => 0,
        'skipped_conflicts' => 0,
        'out_of_range' => 0,
    ];

    if ($seasonId > 0) {
        $existingSeason = fetchSeasonForTeam($pdo, $teamId, $seasonId);
        if ($existingSeason === null) {
            jsonResponse([
                'success' => false,
                'error' => 'Season not found.',
            ], 404);
        }

        $previousWeekday = $existingSeason['default_weekday'] !== null
            ? (int) $existingSeason['default_weekday']
            : (int) $context['weekday'];
        $nextWeekday = $defaultWeekday !== null
            ? $defaultWeekday
            : (int) $context['weekday'];

        updateSeason(
            $pdo,
            $teamId,
            $seasonId,
            $name,
            $seasonType,
            $startDate,
            $endDate,
            $defaultLocation,
            $defaultWeekday,
            $defaultStartTime !== '' ? $defaultStartTime . ':00' : null,
            $defaultDurationMinutes,
            $description,
            $isActive
        );

        $syncResult = syncFutureSeasonSessionsToWeekday(
            $pdo,
            $teamId,
            $seasonId,
            $startDate,
            $endDate,
            $previousWeekday,
            $nextWeekday
        );
    } else {
        $seasonId = createSeason(
            $pdo,
            $teamId,
            $name,
            $seasonType,
            $startDate,
            $endDate,
            $defaultLocation,
            $defaultWeekday,
            $defaultStartTime !== '' ? $defaultStartTime . ':00' : null,
            $defaultDurationMinutes,
            $description,
            $isActive
        );
    }

    $generatedCount = 0;
    if ($generateSessions) {
        $generatedCount = generateSessionsForSeason($pdo, $teamId, $seasonId);
    }

    $pdo->commit();

    $season = fetchSeasonForTeam($pdo, $teamId, $seasonId);

    jsonResponse([
        'success' => true,
        'data' => [
            'season' => $season === null ? null : serializeSeason($season),
            'generated_sessions' => $generatedCount,
            'future_sessions' => $syncResult,
        ],
    ]);
} catch (Throwable $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    jsonResponse(
        debugErrorPayload($exception, 'Unable to save season.'),
        500
    );
}
