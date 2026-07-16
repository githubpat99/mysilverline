<?php

declare(strict_types=1);

require_once __DIR__ . '/../../lib/auth.php';

$body = readJsonBody();
$playerId = isset($body['player_id']) ? (int) $body['player_id'] : 0;

if ($playerId <= 0) {
    jsonResponse([
        'success' => false,
        'error' => 'player_id is required.',
    ], 400);
}

try {
    $pdo = db();
    $context = requireAdminContextFromJsonBody($pdo, $body);

    $teamId = (int) $context['team_id'];
    deletePlayer($pdo, $teamId, $playerId);

    jsonResponse([
        'success' => true,
        'data' => [
            'player_id' => $playerId,
            'roster' => serializeAdminPlayers(fetchPlayersForTeamRoster($pdo, $teamId)),
        ],
    ]);
} catch (Throwable $exception) {
    jsonResponse(
        debugErrorPayload($exception, 'Unable to delete player.'),
        500
    );
}
