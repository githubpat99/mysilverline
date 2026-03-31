<?php

declare(strict_types=1);

require_once __DIR__ . '/../../lib/bootstrap.php';
require_once __DIR__ . '/../../lib/json.php';
require_once __DIR__ . '/../../lib/team_data.php';

$body = readJsonBody();
$token = isset($body['token']) ? trim((string) $body['token']) : '';
$playerId = isset($body['player_id']) ? (int) $body['player_id'] : 0;
$name = isset($body['name']) ? trim((string) $body['name']) : '';
$sortOrder = isset($body['sort_order']) ? (int) $body['sort_order'] : 0;
$isActive = (bool) ($body['is_active'] ?? true);
$regenerateToken = (bool) ($body['regenerate_token'] ?? false);

if ($token === '') {
    jsonResponse([
        'success' => false,
        'error' => 'Missing admin token.',
    ], 400);
}

if ($name === '' || $sortOrder <= 0) {
    jsonResponse([
        'success' => false,
        'error' => 'name and a positive sort_order are required.',
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
    $resolvedPlayerId = savePlayer(
        $pdo,
        $teamId,
        $playerId > 0 ? $playerId : null,
        $name,
        $sortOrder,
        $isActive,
        $regenerateToken
    );

    $roster = serializeAdminPlayers(fetchPlayersForTeamRoster($pdo, $teamId));
    $savedPlayer = null;
    foreach ($roster as $player) {
        if ($player['id'] === $resolvedPlayerId) {
            $savedPlayer = $player;
            break;
        }
    }

    jsonResponse([
        'success' => true,
        'data' => [
            'player' => $savedPlayer,
            'roster' => $roster,
        ],
    ]);
} catch (Throwable $exception) {
    jsonResponse(
        debugErrorPayload($exception, 'Unable to save player.'),
        500
    );
}
