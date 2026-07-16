-- Spieler die fuer eine Saison ausgeschlossen sind (kein Zugriff, nicht im Kader)
-- WICHTIG: Tabellenname muss exakt zu config/database.php -> table_prefix passen
-- (Standard: wp_1340630_tt_ + season_player_exclusions). Pruefen: api/health.php -> tables
CREATE TABLE IF NOT EXISTS wp_1340630_tt_season_player_exclusions (
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
