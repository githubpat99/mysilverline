<?php

declare(strict_types=1);

require_once __DIR__ . '/../../lib/auth.php';

try {
    $pdo = db();
    $context = requireAdminContextFromQuery($pdo);

    $session = fetchNextSessionForTeam($pdo, (int) $context['team_id']);
    $playerRows = $session === null
        ? []
        : fetchResponsesForSession($pdo, (int) $context['team_id'], (int) $session['id']);
    $season = ($session !== null && isset($session['season_id']) && (int) $session['season_id'] > 0)
        ? fetchSeasonForTeam($pdo, (int) $context['team_id'], (int) $session['season_id'])
        : null;

    jsonResponse([
        'success' => true,
        'data' => array_merge(
            buildSessionPayload($context, $season, $session, $playerRows),
            [
                'admin' => [
                    'id' => (int) $context['admin_id'],
                    'label' => $context['admin_label'],
                ],
            ]
        ),
    ]);
} catch (Throwable $exception) {
    jsonResponse(
        debugErrorPayload($exception, 'Unable to load admin session data.'),
        500
    );
}
