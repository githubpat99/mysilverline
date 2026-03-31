CREATE TABLE IF NOT EXISTS wp_1340630_tt_seasons (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    team_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    season_type ENUM('summer', 'winter') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_seasons_team
        FOREIGN KEY (team_id) REFERENCES wp_1340630_tt_teams(id)
        ON DELETE CASCADE
);

ALTER TABLE wp_1340630_tt_sessions
    ADD COLUMN season_id INT UNSIGNED DEFAULT NULL AFTER team_id;

ALTER TABLE wp_1340630_tt_sessions
    ADD CONSTRAINT fk_sessions_season
    FOREIGN KEY (season_id) REFERENCES wp_1340630_tt_seasons(id)
    ON DELETE SET NULL;

INSERT INTO wp_1340630_tt_seasons (team_id, name, season_type, start_date, end_date, is_active)
VALUES
    (1, 'Winter 2025/26', 'winter', '2025-10-01', '2026-04-30', 1),
    (1, 'Sommer 2026', 'summer', '2026-05-01', '2026-09-30', 1),
    (1, 'Winter 2026/27', 'winter', '2026-10-01', '2027-04-30', 1);

UPDATE wp_1340630_tt_sessions
SET season_id = (
    SELECT id
    FROM wp_1340630_tt_seasons
    WHERE wp_1340630_tt_seasons.team_id = wp_1340630_tt_sessions.team_id
      AND wp_1340630_tt_sessions.session_date BETWEEN wp_1340630_tt_seasons.start_date AND wp_1340630_tt_seasons.end_date
    LIMIT 1
)
WHERE season_id IS NULL;
