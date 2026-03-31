<?php

declare(strict_types=1);

require_once __DIR__ . '/../../lib/bootstrap.php';
require_once __DIR__ . '/../../lib/json.php';
require_once __DIR__ . '/../../lib/team_data.php';

$body = readJsonBody();
$token = isset($body['token']) ? trim((string) $body['token']) : '';
$playerId = isset($body['player_id']) ? (int) $body['player_id'] : 0;

if ($token === '') {
    jsonResponse([
        'success' => false,
        'error' => 'Missing admin token.',
    ], 400);
}

if ($playerId <= 0) {
    jsonResponse([
        'success' => false,
        'error' => 'player_id is required.',
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
