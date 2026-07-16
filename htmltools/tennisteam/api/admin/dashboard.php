<?php

declare(strict_types=1);

require_once __DIR__ . '/../../lib/auth.php';

$seasonId = isset($_GET['season_id']) ? (int) $_GET['season_id'] : 0;
$sessionId = isset($_GET['session_id']) ? (int) $_GET['session_id'] : 0;

try {
    $pdo = db();
    $context = requireAdminContextFromQuery($pdo);
    $token = extractAdminTokenFromQuery();

    $teamId = (int) $context['team_id'];
    $seasons = fetchSeasonsForTeam($pdo, $teamId);
    $season = null;
    if ($seasonId > 0) {
        $season = fetchSeasonForTeam($pdo, $teamId, $seasonId);
    }

    if ($season === null) {
        $season = fetchCurrentSeasonForTeam($pdo, $teamId);
    }

    if ($season === null && $seasons !== []) {
        $season = $seasons[0];
    }

    $sessions = $season === null
        ? []
        : fetchSessionsForSeason($pdo, $teamId, (int) $season['id']);
    $sessionItems = buildAdminSeasonSessionItems($pdo, $teamId, $context, $season, $sessions);

    $selectedSession = null;
    $selectedPlayers = [];
    $selectedSummary = summarizeResponses([]);

    $resolvedSessionId = $sessionId > 0 ? $sessionId : getRelevantSessionId($sessions);
    if ($resolvedSessionId !== null) {
        $selectedSession = fetchSessionForTeam($pdo, $teamId, $resolvedSessionId);
        if ($selectedSession !== null) {
            $selectedPlayerRows = fetchResponsesForSession($pdo, $teamId, (int) $selectedSession['id']);
            $selectedPlayers = serializePlayerRows($selectedPlayerRows);
            $selectedSummary = summarizeResponses($selectedPlayers);
        }
    }

    $roster = serializeAdminPlayers(fetchPlayersForTeamRoster($pdo, $teamId));

    jsonResponse([
        'success' => true,
        'data' => [
            'admin' => [
                'id' => (int) $context['admin_id'],
                'label' => $context['admin_label'],
                'token' => $token,
            ],
            'team' => [
                'id' => (int) $context['team_id'],
                'name' => $context['team_name'],
                'location' => $context['location'],
                'weekday' => (int) $context['weekday'],
                'start_time' => $context['start_time'],
                'duration_minutes' => (int) $context['duration_minutes'],
            ],
            'season' => $season === null ? null : serializeSeason($season),
            'seasons' => array_map('serializeSeason', $seasons),
            'sessions' => $sessionItems,
            'selected_session' => $selectedSession === null ? null : serializeSession($context, $season, $selectedSession),
            'selected_players' => $selectedPlayers,
            'selected_summary' => $selectedSummary,
            'roster' => $roster,
            'season_excluded_player_ids' => $season === null ? [] : fetchSeasonExcludedPlayerIds($pdo, $teamId, (int) $season['id']),
        ],
    ]);
} catch (Throwable $exception) {
    jsonResponse(
        debugErrorPayload($exception, 'Unable to load admin dashboard.'),
        500
    );
}
