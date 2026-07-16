<?php

declare(strict_types=1);

require_once __DIR__ . '/../../lib/auth.php';

$body = readJsonBody();
$seasonId = isset($body['season_id']) ? (int) $body['season_id'] : 0;

if ($seasonId <= 0) {
    jsonResponse([
        'success' => false,
        'error' => 'season_id is required.',
    ], 400);
}

try {
    $pdo = db();
    $context = requireAdminContextFromJsonBody($pdo, $body);

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
