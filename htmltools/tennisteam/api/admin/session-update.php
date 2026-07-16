<?php

declare(strict_types=1);

require_once __DIR__ . '/../../lib/auth.php';

$body = readJsonBody();

if (empty($body['token'])) {
    jsonResponse([
        'success' => false,
        'error' => 'Missing admin token.',
    ], 400);
}

$token = trim((string) $body['token']);
$dateProvided = array_key_exists('session_date', $body);
$statusProvided = array_key_exists('status', $body);
$noteProvided = array_key_exists('admin_note', $body);
$locationProvided = array_key_exists('location', $body);
$startTimeProvided = array_key_exists('start_time', $body);
$durationProvided = array_key_exists('duration_minutes', $body);
$descriptionProvided = array_key_exists('description', $body);

if (!$dateProvided && !$statusProvided && !$noteProvided && !$locationProvided && !$startTimeProvided && !$durationProvided && !$descriptionProvided) {
    jsonResponse([
        'success' => false,
        'error' => 'At least one session field is required.',
    ], 400);
}

$sessionDate = $dateProvided ? trim((string) $body['session_date']) : null;
$status = $statusProvided ? trim((string) $body['status']) : null;
if ($status !== null && !isValidSessionStatus($status)) {
    jsonResponse([
        'success' => false,
        'error' => 'Invalid session status.',
    ], 400);
}

$adminNote = $noteProvided ? (string) $body['admin_note'] : null;
$location = $locationProvided ? (string) $body['location'] : null;
$startTime = $startTimeProvided ? trim((string) $body['start_time']) : null;
$durationMinutes = $durationProvided && $body['duration_minutes'] !== null && $body['duration_minutes'] !== ''
    ? (int) $body['duration_minutes']
    : null;
$description = $descriptionProvided ? (string) $body['description'] : null;
$sessionId = array_key_exists('session_id', $body) ? (int) $body['session_id'] : null;

if ($startTimeProvided && $startTime !== null && $startTime !== '' && !preg_match('/^\d{2}:\d{2}$/', $startTime)) {
    jsonResponse([
        'success' => false,
        'error' => 'Invalid session start time.',
    ], 400);
}

if ($durationProvided && $durationMinutes !== null && $durationMinutes < 0) {
    jsonResponse([
        'success' => false,
        'error' => 'Invalid session duration.',
    ], 400);
}

if ($dateProvided && ($sessionDate === null || !isValidIsoDate($sessionDate))) {
    jsonResponse([
        'success' => false,
        'error' => 'Invalid session date.',
    ], 400);
}

try {
    $pdo = db();
    $context = requireAdminContextFromJsonBody($pdo, $body);

    $session = $sessionId === null
        ? fetchNextSessionForTeam($pdo, (int) $context['team_id'])
        : fetchSessionForTeam($pdo, (int) $context['team_id'], $sessionId);

    if ($session === null) {
        jsonResponse([
            'success' => false,
            'error' => 'Session not found.',
        ], 404);
    }

    $nextSessionDate = $dateProvided ? $sessionDate : $session['session_date'];
    $nextStatus = $status ?? $session['status'];
    $nextAdminNote = $noteProvided ? $adminNote : $session['admin_note'];
    $nextLocation = $locationProvided ? $location : $session['location'];
    $nextStartTime = $startTimeProvided
        ? ($startTime === '' ? null : $startTime . ':00')
        : $session['start_time'];
    $nextDuration = $durationProvided ? $durationMinutes : ($session['duration_minutes'] !== null ? (int) $session['duration_minutes'] : null);
    $nextDescription = $descriptionProvided ? $description : $session['description'];

    updateSessionFields(
        $pdo,
        (int) $session['id'],
        $nextSessionDate,
        $nextStatus,
        $nextAdminNote,
        $nextLocation,
        $nextStartTime,
        $nextDuration,
        $nextDescription
    );

    $updatedSession = fetchSessionForTeam($pdo, (int) $context['team_id'], (int) $session['id']);
    $season = ($updatedSession !== null && isset($updatedSession['season_id']) && (int) $updatedSession['season_id'] > 0)
        ? fetchSeasonForTeam($pdo, (int) $context['team_id'], (int) $updatedSession['season_id'])
        : null;
    $playerRows = $updatedSession === null
        ? []
        : fetchResponsesForSession($pdo, (int) $context['team_id'], (int) $updatedSession['id']);

    jsonResponse([
        'success' => true,
        'data' => array_merge(
            buildSessionPayload($context, $season, $updatedSession, $playerRows),
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
        debugErrorPayload($exception, 'Unable to update session.'),
        500
    );
}
