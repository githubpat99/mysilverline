<?php

declare(strict_types=1);

require_once __DIR__ . '/../../lib/bootstrap.php';
require_once __DIR__ . '/../../lib/json.php';
require_once __DIR__ . '/../../lib/team_data.php';

$body = readJsonBody();
$token = isset($body['token']) ? trim((string) $body['token']) : '';
$seasonId = isset($body['season_id']) ? (int) $body['season_id'] : 0;

if ($token === '') {
    jsonResponse([
        'success' => false,
        'error' => 'Missing admin token.',
    ], 400);
}

if ($seasonId <= 0) {
    jsonResponse([
        'success' => false,
        'error' => 'season_id is required.',
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
    $season = fetchSeasonForTeam($pdo, $teamId, $seasonId);
    if ($season === null) {
        jsonResponse([
            'success' => false,
            'error' => 'Season not found.',
        ], 404);
    }

    $pdo->beginTransaction();
    $deleteResult = deleteSeasonWithSessions($pdo, $teamId, $seasonId);
    $pdo->commit();

    jsonResponse([
        'success' => true,
        'data' => $deleteResult,
    ]);
} catch (Throwable $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    jsonResponse(
        debugErrorPayload($exception, 'Unable to delete season.'),
        500
    );
}
