<?php

declare(strict_types=1);

require_once __DIR__ . '/../../lib/bootstrap.php';
require_once __DIR__ . '/../../lib/json.php';
require_once __DIR__ . '/../../lib/team_data.php';

$body = readJsonBody();
$token = isset($body['token']) ? trim((string) $body['token']) : '';
$name = isset($body['name']) ? trim((string) $body['name']) : '';
$location = isset($body['location']) ? (string) $body['location'] : null;

if ($token === '') {
    jsonResponse([
        'success' => false,
        'error' => 'Missing admin token.',
    ], 400);
}

if ($name === '') {
    jsonResponse([
        'success' => false,
        'error' => 'Invalid team settings.',
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

    updateTeamSettings(
        $pdo,
        (int) $context['team_id'],
        $name,
        $location
    );

    jsonResponse([
        'success' => true,
        'data' => [
            'team' => [
                'id' => (int) $context['team_id'],
                'name' => trimName($name, 120),
                'location' => trimComment($location, 150),
                'weekday' => (int) $context['weekday'],
                'start_time' => $context['start_time'],
                'duration_minutes' => (int) $context['duration_minutes'],
            ],
        ],
    ]);
} catch (Throwable $exception) {
    jsonResponse(
        debugErrorPayload($exception, 'Unable to save team settings.'),
        500
    );
}
