<?php

declare(strict_types=1);

require_once __DIR__ . '/../../lib/auth.php';

$body = readJsonBody();
$playerId = isset($body['player_id']) ? (int) $body['player_id'] : 0;
$name = isset($body['name']) ? trim((string) $body['name']) : '';
$sortOrder = isset($body['sort_order']) ? (int) $body['sort_order'] : 0;
$isActive = (bool) ($body['is_active'] ?? true);
$regenerateToken = (bool) ($body['regenerate_token'] ?? false);
$licenseNumber = isset($body['license_number']) && is_string($body['license_number']) ? $body['license_number'] : null;
$classification = isset($body['classification']) && is_string($body['classification']) ? $body['classification'] : null;

if ($name === '') {
    jsonResponse([
        'success' => false,
        'error' => 'name is required.',
    ], 400);
}

try {
    $pdo = db();
    $context = requireAdminContextFromJsonBody($pdo, $body);

    $teamId = (int) $context['team_id'];

    if ($playerId <= 0) {
        if ($sortOrder <= 0) {
            $sortOrder = fetchNextPlayerSortOrderForTeam($pdo, $teamId);
        }
    } elseif ($sortOrder <= 0) {
        $existingOrder = fetchPlayerSortOrderForTeam($pdo, $teamId, $playerId);
        if ($existingOrder === null) {
            jsonResponse([
                'success' => false,
                'error' => 'Unknown player_id for this team.',
            ], 400);
        }
        $sortOrder = $existingOrder;
    }

    $resolvedPlayerId = savePlayer(
        $pdo,
        $teamId,
        $playerId > 0 ? $playerId : null,
        $name,
        $sortOrder,
        $isActive,
        $regenerateToken,
        $licenseNumber,
        $classification
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
} catch (InvalidArgumentException $exception) {
    jsonResponse([
        'success' => false,
        'error' => $exception->getMessage(),
    ], 400);
} catch (Throwable $exception) {
    jsonResponse(
        debugErrorPayload($exception, 'Unable to save player.'),
        500
    );
}
