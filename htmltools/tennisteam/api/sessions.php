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

    $seasons = fetchSeasonsForTeam($pdo, (int) $context['team_id']);
    if ($seasons === []) {
        jsonResponse([
            'success' => false,
            'error' => 'No seasons available for this team.',
        ], 404);
    }

    $season = null;
    if ($seasonId > 0) {
        $season = fetchSeasonForTeam($pdo, (int) $context['team_id'], $seasonId);
    }

    if ($season === null) {
        $season = fetchCurrentSeasonForTeam($pdo, (int) $context['team_id']);
    }

    if ($season === null && $seasons !== []) {
        $season = $seasons[0];
    }

    if ($season === null) {
        jsonResponse([
            'success' => false,
            'error' => 'Season not found.',
        ], 404);
    }

    $sessions = fetchPublishedSessionsForSeason($pdo, (int) $context['team_id'], (int) $season['id']);

    jsonResponse([
        'success' => true,
        'data' => buildSeasonSessionsPayload(
            $context,
            $season,
            $seasons,
            $sessions,
            (int) $context['player_id'],
            $pdo
        ),
    ]);
} catch (Throwable $exception) {
    jsonResponse(
        debugErrorPayload($exception, 'Unable to load season sessions.'),
        500
    );
}
