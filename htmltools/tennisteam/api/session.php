<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/json.php';
require_once __DIR__ . '/../lib/team_data.php';

$token = isset($_GET['token']) ? trim((string) $_GET['token']) : '';
$sessionId = isset($_GET['session_id']) ? (int) $_GET['session_id'] : 0;

if ($token === '') {
    jsonResponse([
        'success' => false,
        'error' => 'Missing player token.',
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

    $session = $sessionId > 0
        ? fetchPublishedSessionForTeam($pdo, (int) $context['team_id'], $sessionId)
        : fetchPublishedNextSessionForTeam($pdo, (int) $context['team_id']);
    $season = ($session !== null && isset($session['season_id']) && (int) $session['season_id'] > 0)
        ? fetchSeasonForTeam($pdo, (int) $context['team_id'], (int) $session['season_id'])
        : null;

    if ($sessionId > 0 && $session === null) {
        jsonResponse([
            'success' => false,
            'error' => 'Session not found.',
        ], 404);
    }

    $playerRows = $session === null
        ? []
        : fetchResponsesForSession($pdo, (int) $context['team_id'], (int) $session['id']);

    jsonResponse([
        'success' => true,
        'data' => buildSessionPayload(
            $context,
            $season,
            $session,
            $playerRows,
            (int) $context['player_id']
        ),
    ]);
} catch (Throwable $exception) {
    jsonResponse(
        debugErrorPayload($exception, 'Unable to load session data.'),
        500
    );
}
