<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/json.php';
require_once __DIR__ . '/../lib/team_data.php';

$token = isset($_GET['token']) ? trim((string) $_GET['token']) : '';
$seasonId = isset($_GET['season_id']) ? (int) $_GET['season_id'] : 0;

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

    $teamId = (int) $context['team_id'];
    $playerId = (int) $context['player_id'];

    $allSeasons = fetchSeasonsForTeam($pdo, $teamId);
    if ($allSeasons === []) {
        jsonResponse([
            'success' => false,
            'error' => 'No seasons available for this team.',
        ], 404);
    }

    $visibleSeasons = filterSeasonsForPlayer($pdo, $teamId, $playerId, $allSeasons);
    if ($visibleSeasons === []) {
        jsonResponse([
            'success' => false,
            'error' => seasonAccessDeniedNoVisibleSeasonMessage(),
        ], 403);
    }

    $season = null;
    if ($seasonId > 0) {
        $season = fetchSeasonForTeam($pdo, $teamId, $seasonId);
        if ($season === null) {
            jsonResponse([
                'success' => false,
                'error' => 'Season not found.',
            ], 404);
        }
        if (isPlayerExcludedFromSeason($pdo, $teamId, $seasonId, $playerId)) {
            jsonResponse([
                'success' => false,
                'error' => seasonAccessDeniedForSeasonMessage(),
            ], 403);
        }
    } else {
        $season = pickDefaultSeasonFromCandidates($visibleSeasons);
    }

    if ($season === null) {
        jsonResponse([
            'success' => false,
            'error' => 'Season not found.',
        ], 404);
    }

    $sessions = fetchPublishedSessionsForSeason($pdo, $teamId, (int) $season['id']);

    jsonResponse([
        'success' => true,
        'data' => buildSeasonSessionsPayload(
            $context,
            $season,
            $visibleSeasons,
            $sessions,
            $playerId,
            $pdo
        ),
    ]);
} catch (Throwable $exception) {
    jsonResponse(
        debugErrorPayload($exception, 'Unable to load season sessions.'),
        500
    );
}
