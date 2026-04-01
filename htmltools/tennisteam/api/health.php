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
        tnTable('seasons'),
        tnTable('sessions'),
        tnTable('responses'),
        tnTable('season_player_exclusions'),
    ];

    $found = [];
    foreach ($requiredTables as $tableName) {
        // Native prepared statements (PDO::ATTR_EMULATE_PREPARES => false) do not support
        // placeholders in SHOW TABLES LIKE on many MariaDB/MySQL builds (syntax error near '?').
        if (!preg_match('/^[A-Za-z0-9_]+$/', $tableName)) {
            throw new RuntimeException('Invalid table name in health check.');
        }
        $sql = 'SHOW TABLES LIKE ' . $pdo->quote($tableName);
        $stmt = $pdo->query($sql);
        $found[$tableName] = $stmt !== false && $stmt->fetchColumn() !== false;
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
