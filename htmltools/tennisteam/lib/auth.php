<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/json.php';
require_once __DIR__ . '/team_data.php';

function extractPlayerTokenFromQuery(): string
{
    return isset($_GET['token']) ? trim((string) $_GET['token']) : '';
}

function extractAdminTokenFromQuery(): string
{
    return isset($_GET['token']) ? trim((string) $_GET['token']) : '';
}

function extractTokenFromJsonBody(array $body): string
{
    return isset($body['token']) ? trim((string) $body['token']) : '';
}

/**
 * @return array<string, mixed>
 */
function requirePlayerContext(PDO $pdo, string $token): array
{
    if ($token === '') {
        jsonResponse([
            'success' => false,
            'error' => 'Missing player token.',
        ], 400);
    }

    $context = fetchPlayerContextByToken($pdo, $token);

    if ($context === null) {
        jsonResponse([
            'success' => false,
            'error' => 'Invalid player token.',
        ], 403);
    }

    return $context;
}

/**
 * @return array<string, mixed>
 */
function requireAdminContext(PDO $pdo, string $token): array
{
    if ($token === '') {
        jsonResponse([
            'success' => false,
            'error' => 'Missing admin token.',
        ], 400);
    }

    $context = fetchAdminContextByToken($pdo, $token);

    if ($context === null) {
        jsonResponse([
            'success' => false,
            'error' => 'Invalid admin token.',
        ], 403);
    }

    return $context;
}

/**
 * @return array<string, mixed>
 */
function requirePlayerContextFromQuery(PDO $pdo): array
{
    return requirePlayerContext($pdo, extractPlayerTokenFromQuery());
}

/**
 * @return array<string, mixed>
 */
function requireAdminContextFromQuery(PDO $pdo): array
{
    return requireAdminContext($pdo, extractAdminTokenFromQuery());
}

/**
 * @return array<string, mixed>
 */
function requirePlayerContextFromJsonBody(PDO $pdo, array $body): array
{
    return requirePlayerContext($pdo, extractTokenFromJsonBody($body));
}

/**
 * @return array<string, mixed>
 */
function requireAdminContextFromJsonBody(PDO $pdo, array $body): array
{
    return requireAdminContext($pdo, extractTokenFromJsonBody($body));
}
