<?php

declare(strict_types=1);

require_once __DIR__ . '/../../lib/bootstrap.php';
require_once __DIR__ . '/../../lib/json.php';
require_once __DIR__ . '/../../lib/team_data.php';

$body = readJsonBody();
$token = isset($body['token']) ? trim((string) $body['token']) : '';
$sessionId = isset($body['session_id']) ? (int) $body['session_id'] : 0;

if ($token === '') {
    jsonResponse([
        'success' => false,
        'error' => 'Missing admin token.',
    ], 400);
}

if ($sessionId <= 0) {
    jsonResponse([
        'success' => false,
        'error' => 'session_id is required.',
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
    deleteSessionForTeam($pdo, $teamId, $sessionId);

    jsonResponse([
        'success' => true,
        'data' => [
            'deleted_session_id' => $sessionId,
        ],
    ]);
} catch (RuntimeException $exception) {
    $message = $exception->getMessage();
    $code = stripos($message, 'not found') !== false ? 404 : 400;
    jsonResponse([
        'success' => false,
        'error' => $message,
    ], $code);
} catch (Throwable $exception) {
    jsonResponse(
        debugErrorPayload($exception, 'Unable to delete session.'),
        500
    );
}
