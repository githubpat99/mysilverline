<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/json.php';

try {
    $pdo = db();
    $requiredTables = [
        tnTable('teams'),
        tnTable('players'),
        tnTable('admin_tokens'),
        tnTable('sessions'),
        tnTable('responses'),
    ];

    $found = [];
    foreach ($requiredTables as $tableName) {
        $stmt = $pdo->prepare('SHOW TABLES LIKE :table_name');
        $stmt->execute(['table_name' => $tableName]);
        $found[$tableName] = $stmt->fetchColumn() !== false;
    }

    jsonResponse([
        'success' => true,
        'data' => [
            'database_connected' => true,
            'table_prefix' => tablePrefix(),
            'tables' => $found,
        ],
    ]);
} catch (Throwable $exception) {
    jsonResponse(
        debugErrorPayload($exception, 'Health check failed.'),
        500
    );
}
