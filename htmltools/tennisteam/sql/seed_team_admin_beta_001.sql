-- Neues leeres Team + Admin-Token (Label admin-beta-001)
-- Nach dem Lauf: admin.html?token=<admin_token> oeffnen, Teamname/Ort anpassen, Saison & Spieler anlegen.
-- Tabellenprefix muss zu config/database.php -> table_prefix passen (hier: wp_1340630_tt_).

START TRANSACTION;

INSERT INTO wp_1340630_tt_teams (name, location, weekday, start_time, duration_minutes, is_active)
VALUES ('Neues Team (Beta)', NULL, 3, '19:00:00', 90, 1);

SET @team_id := LAST_INSERT_ID();

INSERT INTO wp_1340630_tt_admin_tokens (team_id, admin_token, label, is_active)
VALUES (
    @team_id,
    '8a732f82f7cdb6065d005cfe38684db570038a5e3b4b7331274ec57733f6d465',
    'admin-beta-001',
    1
);

COMMIT;

SELECT
    @team_id AS team_id,
    'Neues Team (Beta)' AS team_name,
    'admin-beta-001' AS admin_label,
    '8a732f82f7cdb6065d005cfe38684db570038a5e3b4b7331274ec57733f6d465' AS admin_token;
