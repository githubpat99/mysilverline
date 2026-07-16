-- Acht identische Demo-Teams fuer Captain-Outreach (bekannte Kontakte).
-- Teamname "Meine Mannschaft", Mittwoch 19:00, 90 Min, Spieler 1-4, Sommer-Saison + 6 Termine.
--
-- VOR dem Lauf: Tabellenprefix wp_1340630_tt_ an config/database.php anpassen.
-- Nur EINMAL ausfuehren. Nach dem Lauf: SELECTs am Ende ausfuehren.

-- ========== Team 1 ==========
START TRANSACTION;
INSERT INTO wp_1340630_tt_teams (name, location, weekday, start_time, duration_minutes)
VALUES ('Meine Mannschaft', NULL, 3, '19:00:00', 90);
SET @tid = LAST_INSERT_ID();
INSERT INTO wp_1340630_tt_admin_tokens (team_id, admin_token, label)
VALUES (@tid, 'f9dc8a5063a3e70be3a84084957d310ffd10a029a716303eda54b24209ec3f78', 'captain-outreach-01');
INSERT INTO wp_1340630_tt_players (team_id, name, sort_order, player_token) VALUES
(@tid, 'Spieler 1', 1, 'de9d5c257bff689da1b1553439f990fa02868c0d466436b08a3d3d4180f5cfdd'),
(@tid, 'Spieler 2', 2, '9fc8b32c76db758b2432ebaba7d6c5bcfe6882940a29efd93e8ac10ad28405b2'),
(@tid, 'Spieler 3', 3, '83d4ee87bd427e3535b59e5b4a560644a195997420887a40a967e8a456a53885'),
(@tid, 'Spieler 4', 4, '7f25c90bed7cc627fdf4fd067728f9b5a2afa1adf6b8853dc540b3dc6f3f066d');
INSERT INTO wp_1340630_tt_seasons (
    team_id, name, season_type, start_date, end_date,
    default_location, default_weekday, default_start_time, default_duration_minutes, description, is_active
) VALUES (
    @tid, 'Saison 2026', 'summer', '2026-05-01', '2026-09-30',
    NULL, 3, '19:00:00', 90, 'Demo-Saison (Captain-Outreach).', 1
);
SET @sid = LAST_INSERT_ID();
INSERT INTO wp_1340630_tt_sessions (team_id, season_id, session_date, location, start_time, duration_minutes, status) VALUES
(@tid, @sid, '2026-05-06', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-13', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-20', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-27', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-06-03', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-06-10', NULL, '19:00:00', 90, 'scheduled');
COMMIT;

-- ========== Team 2 ==========
START TRANSACTION;
INSERT INTO wp_1340630_tt_teams (name, location, weekday, start_time, duration_minutes)
VALUES ('Meine Mannschaft', NULL, 3, '19:00:00', 90);
SET @tid = LAST_INSERT_ID();
INSERT INTO wp_1340630_tt_admin_tokens (team_id, admin_token, label)
VALUES (@tid, 'df85e30a94ef7efea51e66ed024cae36440c9f5903686b6670dd73202c8aff14', 'captain-outreach-02');
INSERT INTO wp_1340630_tt_players (team_id, name, sort_order, player_token) VALUES
(@tid, 'Spieler 1', 1, 'de9d5b66f655f6e3316302757b27e44b09edaf04813a2ff8e67ae0ab0582e9cd'),
(@tid, 'Spieler 2', 2, '95461ad461001e02aae6ed4be82fdbea2ce9ef8eced088f748a6f394c58e5d35'),
(@tid, 'Spieler 3', 3, 'b7b34e390560eecd2fbc784b91dc187c9c57bca46b4269e90f5265a7486e8bd0'),
(@tid, 'Spieler 4', 4, 'c57fea3ac12762ec640329cbe5c69cc9d21a0afd5389d65aa0dc85c168c31b26');
INSERT INTO wp_1340630_tt_seasons (
    team_id, name, season_type, start_date, end_date,
    default_location, default_weekday, default_start_time, default_duration_minutes, description, is_active
) VALUES (
    @tid, 'Saison 2026', 'summer', '2026-05-01', '2026-09-30',
    NULL, 3, '19:00:00', 90, 'Demo-Saison (Captain-Outreach).', 1
);
SET @sid = LAST_INSERT_ID();
INSERT INTO wp_1340630_tt_sessions (team_id, season_id, session_date, location, start_time, duration_minutes, status) VALUES
(@tid, @sid, '2026-05-06', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-13', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-20', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-27', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-06-03', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-06-10', NULL, '19:00:00', 90, 'scheduled');
COMMIT;

-- ========== Team 3 ==========
START TRANSACTION;
INSERT INTO wp_1340630_tt_teams (name, location, weekday, start_time, duration_minutes)
VALUES ('Meine Mannschaft', NULL, 3, '19:00:00', 90);
SET @tid = LAST_INSERT_ID();
INSERT INTO wp_1340630_tt_admin_tokens (team_id, admin_token, label)
VALUES (@tid, '5b6bda27bbf2cee3d8a5e9785eb52bb8bb93513f73c3fa87a0468d6f4b1252b9', 'captain-outreach-03');
INSERT INTO wp_1340630_tt_players (team_id, name, sort_order, player_token) VALUES
(@tid, 'Spieler 1', 1, 'ca58c5aaf5a73354295396cb47e8fcfa073b2b682cc90cd5f2ee8fcbfe2f8e37'),
(@tid, 'Spieler 2', 2, '480ed85a14c2767b4efec13ad6f8adb53ab22977f67275e3198ec46513b82e09'),
(@tid, 'Spieler 3', 3, '99e653588971a31b794eb7a3ddd8417b8d3662fe5b172473a84e3ef2fb0d9cbd'),
(@tid, 'Spieler 4', 4, '3150fab8f32b938393413d49d38071b73e942c2c86f8797c5ee40f378801939b');
INSERT INTO wp_1340630_tt_seasons (
    team_id, name, season_type, start_date, end_date,
    default_location, default_weekday, default_start_time, default_duration_minutes, description, is_active
) VALUES (
    @tid, 'Saison 2026', 'summer', '2026-05-01', '2026-09-30',
    NULL, 3, '19:00:00', 90, 'Demo-Saison (Captain-Outreach).', 1
);
SET @sid = LAST_INSERT_ID();
INSERT INTO wp_1340630_tt_sessions (team_id, season_id, session_date, location, start_time, duration_minutes, status) VALUES
(@tid, @sid, '2026-05-06', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-13', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-20', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-27', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-06-03', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-06-10', NULL, '19:00:00', 90, 'scheduled');
COMMIT;

-- ========== Team 4 ==========
START TRANSACTION;
INSERT INTO wp_1340630_tt_teams (name, location, weekday, start_time, duration_minutes)
VALUES ('Meine Mannschaft', NULL, 3, '19:00:00', 90);
SET @tid = LAST_INSERT_ID();
INSERT INTO wp_1340630_tt_admin_tokens (team_id, admin_token, label)
VALUES (@tid, 'b8eda6ecd750caa513aac3b122457935afc7a51cf558ba33c6c2942fd42ec329', 'captain-outreach-04');
INSERT INTO wp_1340630_tt_players (team_id, name, sort_order, player_token) VALUES
(@tid, 'Spieler 1', 1, 'fc96f2419dcd7b9f31ceef1fbfc8e5d4fa632f28f80942cacfef90e67f06f367'),
(@tid, 'Spieler 2', 2, 'b858ce1d573d69fa8673ef4b397130b7d864b0f2ba3e82fc92066e66e4905760'),
(@tid, 'Spieler 3', 3, '1fafb88c616383559f2178c4a279228f03c2c1338e9a1a5c0a4157dd6bd1a453'),
(@tid, 'Spieler 4', 4, '35af32d378f732f808ca3d279781927d17a13f354c499f974c5355e82bf5c326');
INSERT INTO wp_1340630_tt_seasons (
    team_id, name, season_type, start_date, end_date,
    default_location, default_weekday, default_start_time, default_duration_minutes, description, is_active
) VALUES (
    @tid, 'Saison 2026', 'summer', '2026-05-01', '2026-09-30',
    NULL, 3, '19:00:00', 90, 'Demo-Saison (Captain-Outreach).', 1
);
SET @sid = LAST_INSERT_ID();
INSERT INTO wp_1340630_tt_sessions (team_id, season_id, session_date, location, start_time, duration_minutes, status) VALUES
(@tid, @sid, '2026-05-06', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-13', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-20', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-27', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-06-03', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-06-10', NULL, '19:00:00', 90, 'scheduled');
COMMIT;

-- ========== Team 5 ==========
START TRANSACTION;
INSERT INTO wp_1340630_tt_teams (name, location, weekday, start_time, duration_minutes)
VALUES ('Meine Mannschaft', NULL, 3, '19:00:00', 90);
SET @tid = LAST_INSERT_ID();
INSERT INTO wp_1340630_tt_admin_tokens (team_id, admin_token, label)
VALUES (@tid, 'f14ebb828fd85e1ae16498bb58294dec78f226161c53d2be07dcfea1c7c08504', 'captain-outreach-05');
INSERT INTO wp_1340630_tt_players (team_id, name, sort_order, player_token) VALUES
(@tid, 'Spieler 1', 1, '23d4697f8e325b0e127d352705bf562b979daa1cf24fe4b9cb152b02d5b67632'),
(@tid, 'Spieler 2', 2, 'daaba16edfb9f336895fe0f0af8409d31b033ec2570272824900af009978aee1'),
(@tid, 'Spieler 3', 3, '0c7624610380db124916204fbcaee38fc4d88add896d67f0088b06648f6bad93'),
(@tid, 'Spieler 4', 4, '398b9fe464f9649e42cb9657c1336e1c8300ebdda12e66b4065e7e89b05f34a6');
INSERT INTO wp_1340630_tt_seasons (
    team_id, name, season_type, start_date, end_date,
    default_location, default_weekday, default_start_time, default_duration_minutes, description, is_active
) VALUES (
    @tid, 'Saison 2026', 'summer', '2026-05-01', '2026-09-30',
    NULL, 3, '19:00:00', 90, 'Demo-Saison (Captain-Outreach).', 1
);
SET @sid = LAST_INSERT_ID();
INSERT INTO wp_1340630_tt_sessions (team_id, season_id, session_date, location, start_time, duration_minutes, status) VALUES
(@tid, @sid, '2026-05-06', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-13', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-20', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-27', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-06-03', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-06-10', NULL, '19:00:00', 90, 'scheduled');
COMMIT;

-- ========== Team 6 ==========
START TRANSACTION;
INSERT INTO wp_1340630_tt_teams (name, location, weekday, start_time, duration_minutes)
VALUES ('Meine Mannschaft', NULL, 3, '19:00:00', 90);
SET @tid = LAST_INSERT_ID();
INSERT INTO wp_1340630_tt_admin_tokens (team_id, admin_token, label)
VALUES (@tid, '995e4f690576011346e1cdd909ee33315027cf0676b8ede606c3ad06d2f3ae8a', 'captain-outreach-06');
INSERT INTO wp_1340630_tt_players (team_id, name, sort_order, player_token) VALUES
(@tid, 'Spieler 1', 1, '626373e3914405abc4d3716699fa3ba92025cea9e23935b62ea68f754cf9dc5f'),
(@tid, 'Spieler 2', 2, 'bbedb86ceb5c52ab5ae3fb55ab982222ad396c4137b9f5d29821f1ea288ddf15'),
(@tid, 'Spieler 3', 3, '4b7adcabd433b2e195a2ec0d36d91d688fb806968941799cb265afbbb796f043'),
(@tid, 'Spieler 4', 4, '0203765a2b5f1bcafd25bb10f158856f4c37f371dc2b008ab385454cd1fd6633');
INSERT INTO wp_1340630_tt_seasons (
    team_id, name, season_type, start_date, end_date,
    default_location, default_weekday, default_start_time, default_duration_minutes, description, is_active
) VALUES (
    @tid, 'Saison 2026', 'summer', '2026-05-01', '2026-09-30',
    NULL, 3, '19:00:00', 90, 'Demo-Saison (Captain-Outreach).', 1
);
SET @sid = LAST_INSERT_ID();
INSERT INTO wp_1340630_tt_sessions (team_id, season_id, session_date, location, start_time, duration_minutes, status) VALUES
(@tid, @sid, '2026-05-06', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-13', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-20', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-27', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-06-03', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-06-10', NULL, '19:00:00', 90, 'scheduled');
COMMIT;

-- ========== Team 7 ==========
START TRANSACTION;
INSERT INTO wp_1340630_tt_teams (name, location, weekday, start_time, duration_minutes)
VALUES ('Meine Mannschaft', NULL, 3, '19:00:00', 90);
SET @tid = LAST_INSERT_ID();
INSERT INTO wp_1340630_tt_admin_tokens (team_id, admin_token, label)
VALUES (@tid, 'b09ad472e6e3d5e622f5ffc763ad34f7dbd022bf9d4778b357f5f32f71c55454', 'captain-outreach-07');
INSERT INTO wp_1340630_tt_players (team_id, name, sort_order, player_token) VALUES
(@tid, 'Spieler 1', 1, '09218329a1a6f86a6fcf1c01400201119c812580a34d77a8ed2ef44cdfcf2cd0'),
(@tid, 'Spieler 2', 2, 'cec811043259ec116a9cdeb532bcd9bfbee070ca98563e11a4166697ba870fe6'),
(@tid, 'Spieler 3', 3, 'dab19b903ed60ad4d5d3a7602aafe56feb7572ea19156a487c7e33cb18ba81d1'),
(@tid, 'Spieler 4', 4, 'b32fca8647042719b320ec6991f826a0975a243a9ce7142639f886aa3cd2ad8f');
INSERT INTO wp_1340630_tt_seasons (
    team_id, name, season_type, start_date, end_date,
    default_location, default_weekday, default_start_time, default_duration_minutes, description, is_active
) VALUES (
    @tid, 'Saison 2026', 'summer', '2026-05-01', '2026-09-30',
    NULL, 3, '19:00:00', 90, 'Demo-Saison (Captain-Outreach).', 1
);
SET @sid = LAST_INSERT_ID();
INSERT INTO wp_1340630_tt_sessions (team_id, season_id, session_date, location, start_time, duration_minutes, status) VALUES
(@tid, @sid, '2026-05-06', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-13', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-20', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-27', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-06-03', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-06-10', NULL, '19:00:00', 90, 'scheduled');
COMMIT;

-- ========== Team 8 ==========
START TRANSACTION;
INSERT INTO wp_1340630_tt_teams (name, location, weekday, start_time, duration_minutes)
VALUES ('Meine Mannschaft', NULL, 3, '19:00:00', 90);
SET @tid = LAST_INSERT_ID();
INSERT INTO wp_1340630_tt_admin_tokens (team_id, admin_token, label)
VALUES (@tid, '4b84574963068390189d32f106c0d5a5096fedf74d2d848c9ea82e7a6fc024e6', 'captain-outreach-08');
INSERT INTO wp_1340630_tt_players (team_id, name, sort_order, player_token) VALUES
(@tid, 'Spieler 1', 1, '17da2ce772dd47744bd29c06b0c7e824ce5c3af837f4ca18e7500ac641f8cb9f'),
(@tid, 'Spieler 2', 2, '1c098ea2c478968cd27ac52abe9ce2522a3fbb1e1325a43d1f100be2421b175b'),
(@tid, 'Spieler 3', 3, '3d98ba3e4053076ab8dcaef533b7db09497f53a8443abff17ac2cd0e3e95d967'),
(@tid, 'Spieler 4', 4, 'a859b2b7e4197d1a44ae16f0dd5acb5ff3622d55346553e96fe0868b22b2017e');
INSERT INTO wp_1340630_tt_seasons (
    team_id, name, season_type, start_date, end_date,
    default_location, default_weekday, default_start_time, default_duration_minutes, description, is_active
) VALUES (
    @tid, 'Saison 2026', 'summer', '2026-05-01', '2026-09-30',
    NULL, 3, '19:00:00', 90, 'Demo-Saison (Captain-Outreach).', 1
);
SET @sid = LAST_INSERT_ID();
INSERT INTO wp_1340630_tt_sessions (team_id, season_id, session_date, location, start_time, duration_minutes, status) VALUES
(@tid, @sid, '2026-05-06', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-13', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-20', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-05-27', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-06-03', NULL, '19:00:00', 90, 'scheduled'),
(@tid, @sid, '2026-06-10', NULL, '19:00:00', 90, 'scheduled');
COMMIT;

-- ========== Export fuer Mails ==========
SELECT
    a.label,
    t.id AS team_id,
    CONCAT('https://mysilverline.it-pin.ch/htmltools/tennisteam/admin.html?token=', a.admin_token) AS admin_url
FROM wp_1340630_tt_admin_tokens a
INNER JOIN wp_1340630_tt_teams t ON t.id = a.team_id
WHERE a.label LIKE 'captain-outreach-%'
ORDER BY a.label;

SELECT
    t.id AS team_id,
    p.sort_order,
    p.name,
    CONCAT('https://mysilverline.it-pin.ch/htmltools/tennisteam/index.html?token=', p.player_token) AS player_url
FROM wp_1340630_tt_players p
INNER JOIN wp_1340630_tt_teams t ON t.id = p.team_id
INNER JOIN wp_1340630_tt_admin_tokens a ON a.team_id = t.id AND a.label LIKE 'captain-outreach-%'
ORDER BY t.id, p.sort_order;
