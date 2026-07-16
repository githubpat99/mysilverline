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
$sessionId = array_key_exists('session_id', $body) ? (int) $body['session_id'] : 0;
$playerId = array_key_exists('player_id', $body) ? (int) $body['player_id'] : 0;
$status = array_key_exists('status', $body) && $body['status'] !== null
    ? trim((string) $body['status'])
    : null;
$commentProvided = array_key_exists('comment', $body);
$comment = $commentProvided ? (string) $body['comment'] : null;

if ($sessionId <= 0 || $playerId <= 0) {
    jsonResponse([
        'success' => false,
        'error' => 'session_id and player_id are required.',
    ], 400);
}

if ($status !== null && $status !== '' && !isValidAttendanceStatus($status)) {
    jsonResponse([
        'success' => false,
        'error' => 'Invalid attendance status.',
    ], 400);
}

try {
    $pdo = db();
    $context = requireAdminContextFromJsonBody($pdo, $body);

    $teamId = (int) $context['team_id'];
    $session = fetchSessionForTeam($pdo, $teamId, $sessionId);
    $player = fetchPlayerForTeam($pdo, $teamId, $playerId);

    if ($session === null) {
        jsonResponse([
            'success' => false,
            'error' => 'Session not found.',
        ], 404);
    }

    if ($player === null) {
        jsonResponse([
            'success' => false,
            'error' => 'Player not found.',
        ], 404);
    }

    if ($status === null || $status === '') {
        deleteResponse($pdo, $sessionId, $playerId);
    } else {
        if (!$commentProvided) {
            $existingRows = fetchResponsesForSession($pdo, $teamId, $sessionId);
            foreach ($existingRows as $row) {
                if ((int) $row['player_id'] === $playerId && !empty($row['comment'])) {
                    $comment = (string) $row['comment'];
                    break;
                }
            }
        }
        upsertResponse($pdo, $sessionId, $playerId, $status, $comment);
    }

    $selectedPlayerRows = fetchResponsesForSession($pdo, $teamId, $sessionId);
    $selectedPlayers = serializePlayerRows($selectedPlayerRows);
    $selectedSummary = summarizeResponses($selectedPlayers);

    jsonResponse([
        'success' => true,
        'data' => [
            'selected_players' => $selectedPlayers,
            'selected_summary' => $selectedSummary,
        ],
    ]);
} catch (Throwable $exception) {
    jsonResponse(
        debugErrorPayload($exception, 'Unable to update player response.'),
        500
    );
}
