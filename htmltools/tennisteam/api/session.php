<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/auth.php';

$token = isset($_GET['token']) ? trim((string) $_GET['token']) : '';
$sessionId = isset($_GET['session_id']) ? (int) $_GET['session_id'] : 0;

try {
    $pdo = db();
    $context = requirePlayerContextFromQuery($pdo);

    $teamId = (int) $context['team_id'];
    $playerId = (int) $context['player_id'];

    $session = $sessionId > 0
        ? fetchPublishedSessionForTeam($pdo, $teamId, $sessionId)
        : fetchPublishedNextSessionForPlayer($pdo, $teamId, $playerId);
    $season = ($session !== null && isset($session['season_id']) && (int) $session['season_id'] > 0)
        ? fetchSeasonForTeam($pdo, $teamId, (int) $session['season_id'])
        : null;

    if ($session !== null) {
        $sid = isset($session['season_id']) ? (int) $session['season_id'] : 0;
        if ($sid > 0 && isPlayerExcludedFromSeason($pdo, $teamId, $sid, $playerId)) {
            jsonResponse([
                'success' => false,
                'error' => seasonAccessDeniedForSeasonMessage(),
            ], 403);
        }
    }

    if ($sessionId > 0 && $session === null) {
        jsonResponse([
            'success' => false,
            'error' => 'Session not found.',
        ], 404);
    }

    $playerRows = $session === null
        ? []
        : fetchResponsesForSession($pdo, $teamId, (int) $session['id']);

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
        debugErrorPayload($exception, 'Unable to load session data.'),
        500
    );
}
