ALTER TABLE wp_1340630_tt_sessions
    MODIFY COLUMN status ENUM('scheduled', 'provisional', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled';
