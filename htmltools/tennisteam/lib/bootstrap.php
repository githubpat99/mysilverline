<?php

declare(strict_types=1);

function loadDatabaseConfig(): array
{
    $configPath = __DIR__ . '/../config/database.php';
    if (!file_exists($configPath)) {
        throw new RuntimeException('Missing config/database.php');
    }

    $config = require $configPath;
    if (!is_array($config)) {
        throw new RuntimeException('Database config must return an array.');
    }

    return $config;
}

function isDebugEnabled(): bool
{
    $config = loadDatabaseConfig();
    return (bool) ($config['debug'] ?? false);
}

function debugErrorPayload(Throwable $exception, string $fallbackMessage): array
{
    $payload = [
        'success' => false,
        'error' => $fallbackMessage,
    ];

    if (isDebugEnabled()) {
        $payload['debug'] = [
            'type' => get_class($exception),
            'message' => $exception->getMessage(),
            'file' => basename($exception->getFile()),
            'line' => $exception->getLine(),
        ];
    }

    return $payload;
}

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = loadDatabaseConfig();
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $config['host'],
        $config['port'],
        $config['database'],
        $config['charset']
    );

    $pdo = new PDO($dsn, $config['username'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}

function tablePrefix(): string
{
    $config = loadDatabaseConfig();
    $prefix = $config['table_prefix'] ?? '';

    if (!is_string($prefix)) {
        throw new RuntimeException('table_prefix must be a string.');
    }

    if ($prefix !== '' && !preg_match('/^[A-Za-z0-9_]+$/', $prefix)) {
        throw new RuntimeException('Invalid table_prefix configured.');
    }

    return $prefix;
}

function tnTable(string $baseName): string
{
    if (!preg_match('/^[A-Za-z0-9_]+$/', $baseName)) {
        throw new RuntimeException('Invalid base table name.');
    }

    return tablePrefix() . $baseName;
}
