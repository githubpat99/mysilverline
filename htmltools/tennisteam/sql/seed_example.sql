INSERT INTO wp_1340630_tt_teams (name, location, weekday, start_time, duration_minutes)
VALUES ('Tennisteam Mittwoch', 'Tennisplatz Silverline', 3, '19:00:00', 90);

INSERT INTO wp_1340630_tt_players (team_id, name, sort_order, player_token)
VALUES
    (1, 'Patrik', 1, '294310927a442ea46ddabd53f7c9e5a95f28776498cacf64f0f9c856e1c4fab8'),
    (1, 'Guido', 2, '5f925d4fe7d6c055e0e6e7a44c3afe07d29613e16e00a15ad2350ecdf639b348'),
    (1, 'Jürg', 3, '7b6be9f3ac0adec9f3ef5eef0abf863ffb6da9d8c4e60b3f7697324e63212fbe'),
    (1, 'Leuzi', 4, '95c0a21b41edf4e5d132c2b6dee96443e208e168562a1c956b70a6b06d05a384'),
    (1, 'Maha', 5, '0b82cab146a52ec4edb3975c711b4efa16c89e0ae9c1802f7e12ee5265c8bb5e'),
    (1, 'Peter', 6, 'cfeeeb6314591777fbdb2e7fb625916c1728858ff4173919d58fc7bdf5fa89eb'),
    (1, 'Wene', 7, 'bf13a0403165f7e08dfed90a82b94ccbff34684e9d17f801051a3e9845c1a7be'),
    (1, 'Hampi', 8, 'be9d5343a004f912e1c9f05491c657e461aab67832cb010a1ccbe9f9f3e1d35e');

INSERT INTO wp_1340630_tt_admin_tokens (team_id, admin_token, label)
VALUES
    (1, '2d06b8bb452bdcc9e95bbe4206f46097a835d2a747df1d1505a6a277da0dc38d', 'main-admin');

INSERT INTO wp_1340630_tt_seasons (
    team_id,
    name,
    season_type,
    start_date,
    end_date,
    default_location,
    default_weekday,
    default_start_time,
    default_duration_minutes,
    description,
    is_active
)
VALUES
    (1, 'Winter - Training 2025/26', 'winter', '2025-10-01', '2026-04-30', 'Tennisplatz Silverline', 3, '19:00:00', 90, 'Wintertraining am Mittwoch.', 1),
    (1, 'Sommer - Trainingssaison 2026', 'summer', '2026-05-01', '2026-09-30', 'Tennisplatz Silverline', 3, '19:00:00', 90, 'Sommertraining am Mittwoch.', 1),
    (1, 'Interclub Saison 2026', 'interclub', '2026-05-01', '2026-07-31', 'Clubanlage Silverline', 6, '13:00:00', 240, 'Standard fuer Heimspiele, Auswaertsdetails direkt im Termin.', 0);

INSERT INTO wp_1340630_tt_sessions (
    team_id,
    season_id,
    session_date,
    location,
    start_time,
    duration_minutes,
    description,
    status,
    admin_note
)
VALUES
    (1, 1, '2026-04-08', NULL, NULL, NULL, 'Training wie gewohnt.', 'scheduled', 'Bitte spaetestens bis Dienstagabend eintragen.');
