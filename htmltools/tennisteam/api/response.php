<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/json.php';
require_once __DIR__ . '/../lib/team_data.php';

$body = readJsonBody();

if (empty($body['token']) || empty($body['status'])) {
    jsonResponse([
        'success' => false,
        'error' => 'token and status are required.',
    ], 400);
}

$token = trim((string) $body['token']);
$status = trim((string) $body['status']);
$comment = array_key_exists('comment', $body) ? (string) $body['comment'] : null;
$sessionId = array_key_exists('session_id', $body) ? (int) $body['session_id'] : 0;

if (!isValidAttendanceStatus($status)) {
    jsonResponse([
        'success' => false,
        'error' => 'Invalid attendance status.',
    ], 400);
}

try {
    $pdo = db();
    $context = fetchPlayerContextByToken($pdo, $token);

    if ($context === null) {
        jsonResponse([
            'success' => false,
            'error' => 'Invalid player token.',
        ], 403);
    }

    $teamId = (int) $context['team_id'];
    $playerId = (int) $context['player_id'];

    $session = $sessionId > 0
        ? fetchPublishedSessionForTeam($pdo, $teamId, $sessionId)
        : fetchPublishedNextSessionForPlayer($pdo, $teamId, $playerId);

    if ($sessionId > 0 && $session === null) {
        jsonResponse([
            'success' => false,
            'error' => 'Session not found.',
        ], 404);
    }

    if ($session === null) {
        jsonResponse([
            'success' => false,
            'error' => 'No session available to update.',
        ], 404);
    }

    $sid = isset($session['season_id']) ? (int) $session['season_id'] : 0;
    if ($sid > 0 && isPlayerExcludedFromSeason($pdo, $teamId, $sid, $playerId)) {
        jsonResponse([
            'success' => false,
            'error' => seasonAccessDeniedForSeasonMessage(),
        ], 403);
    }

    upsertResponse(
        $pdo,
        (int) $session['id'],
        $playerId,
        $status,
        $comment
    );

    $playerRows = fetchResponsesForSession($pdo, $teamId, (int) $session['id']);
    $season = ($sid > 0)
        ? fetchSeasonForTeam($pdo, $teamId, $sid)
        : null;

    jsonResponse([
        'success' => true,
        'data' => buildSessionPayload(
            $context,
            $season,
            $session,
            $playerRows,
            $playerId
        ),
    ]);
} catch (Throwable $exception) {
    jsonResponse(
        debugErrorPayload($exception, 'Unable to update attendance response.'),
        500
    );
}
