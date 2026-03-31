ALTER TABLE wp_1340630_tt_seasons
    MODIFY COLUMN season_type VARCHAR(40) NOT NULL DEFAULT 'custom',
    ADD COLUMN default_location VARCHAR(255) DEFAULT NULL AFTER end_date,
    ADD COLUMN default_weekday TINYINT UNSIGNED DEFAULT NULL AFTER default_location,
    ADD COLUMN default_start_time TIME DEFAULT NULL AFTER default_weekday,
    ADD COLUMN default_duration_minutes SMALLINT UNSIGNED DEFAULT NULL AFTER default_start_time,
    ADD COLUMN description VARCHAR(500) DEFAULT NULL AFTER default_duration_minutes;

ALTER TABLE wp_1340630_tt_sessions
    ADD COLUMN location VARCHAR(255) DEFAULT NULL AFTER session_date,
    ADD COLUMN start_time TIME DEFAULT NULL AFTER location,
    ADD COLUMN duration_minutes SMALLINT UNSIGNED DEFAULT NULL AFTER start_time,
    ADD COLUMN description VARCHAR(500) DEFAULT NULL AFTER duration_minutes;

UPDATE wp_1340630_tt_seasons s
INNER JOIN wp_1340630_tt_teams t ON t.id = s.team_id
SET
    s.default_location = t.location,
    s.default_weekday = t.weekday,
    s.default_start_time = t.start_time,
    s.default_duration_minutes = t.duration_minutes
WHERE s.default_location IS NULL
   OR s.default_weekday IS NULL
   OR s.default_start_time IS NULL
   OR s.default_duration_minutes IS NULL;
