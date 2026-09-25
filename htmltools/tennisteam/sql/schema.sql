CREATE TABLE wp_1340630_tt_teams (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    location VARCHAR(255) DEFAULT NULL,
    weekday TINYINT UNSIGNED NOT NULL,
    start_time TIME NOT NULL,
    duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 90,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE wp_1340630_tt_players (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    team_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    license_number VARCHAR(12) DEFAULT NULL,
    classification VARCHAR(2) DEFAULT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    player_token CHAR(64) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_players_team
        FOREIGN KEY (team_id) REFERENCES wp_1340630_tt_teams(id)
        ON DELETE CASCADE,
    CONSTRAINT uq_players_token UNIQUE (player_token)
);

CREATE TABLE wp_1340630_tt_admin_tokens (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    team_id INT UNSIGNED NOT NULL,
    admin_token CHAR(64) NOT NULL,
    label VARCHAR(80) DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_admin_tokens_team
        FOREIGN KEY (team_id) REFERENCES wp_1340630_tt_teams(id)
        ON DELETE CASCADE,
    CONSTRAINT uq_admin_token UNIQUE (admin_token)
);

CREATE TABLE wp_1340630_tt_seasons (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    team_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    season_type VARCHAR(40) NOT NULL DEFAULT 'custom',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    default_location VARCHAR(255) DEFAULT NULL,
    default_weekday TINYINT UNSIGNED DEFAULT NULL,
    default_start_time TIME DEFAULT NULL,
    default_duration_minutes SMALLINT UNSIGNED DEFAULT NULL,
    description VARCHAR(500) DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_seasons_team
        FOREIGN KEY (team_id) REFERENCES wp_1340630_tt_teams(id)
        ON DELETE CASCADE
);

CREATE TABLE wp_1340630_tt_sessions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    team_id INT UNSIGNED NOT NULL,
    season_id INT UNSIGNED DEFAULT NULL,
    session_date DATE NOT NULL,
    location VARCHAR(255) DEFAULT NULL,
    start_time TIME DEFAULT NULL,
    duration_minutes SMALLINT UNSIGNED DEFAULT NULL,
    description VARCHAR(500) DEFAULT NULL,
    status ENUM('scheduled', 'provisional', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
    admin_note VARCHAR(500) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_sessions_team
        FOREIGN KEY (team_id) REFERENCES wp_1340630_tt_teams(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_sessions_season
        FOREIGN KEY (season_id) REFERENCES wp_1340630_tt_seasons(id)
        ON DELETE SET NULL,
    CONSTRAINT uq_sessions_team_date UNIQUE (team_id, session_date)
);

CREATE TABLE wp_1340630_tt_responses (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id INT UNSIGNED NOT NULL,
    player_id INT UNSIGNED NOT NULL,
    attendance_status ENUM('yes', 'no', 'maybe', 'replacement') DEFAULT NULL,
    comment VARCHAR(255) DEFAULT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_responses_session
        FOREIGN KEY (session_id) REFERENCES wp_1340630_tt_sessions(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_responses_player
        FOREIGN KEY (player_id) REFERENCES wp_1340630_tt_players(id)
        ON DELETE CASCADE,
    CONSTRAINT uq_responses_session_player UNIQUE (session_id, player_id)
);

CREATE TABLE wp_1340630_tt_season_player_exclusions (
    season_id INT UNSIGNED NOT NULL,
    player_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (season_id, player_id),
    CONSTRAINT fk_tt_spe_season
        FOREIGN KEY (season_id) REFERENCES wp_1340630_tt_seasons(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_tt_spe_player
        FOREIGN KEY (player_id) REFERENCES wp_1340630_tt_players(id)
        ON DELETE CASCADE
);

