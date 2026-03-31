INSERT INTO wp_1340630_tt_sessions (
    team_id,
    season_id,
    session_date,
    location,
    start_time,
    duration_minutes,
    status,
    admin_note
)
WITH RECURSIVE all_days AS (
    SELECT
        s.id AS season_id,
        s.team_id,
        s.start_date AS session_date,
        s.end_date,
        COALESCE(s.default_weekday, t.weekday) AS weekday
    FROM wp_1340630_tt_seasons s
    INNER JOIN wp_1340630_tt_teams t ON t.id = s.team_id
    WHERE s.is_active = 1
      AND COALESCE(s.default_weekday, t.weekday) IS NOT NULL

    UNION ALL

    SELECT
        season_id,
        team_id,
        DATE_ADD(session_date, INTERVAL 1 DAY) AS session_date,
        end_date,
        weekday
    FROM all_days
    WHERE session_date < end_date
)
SELECT
    all_days.team_id,
    all_days.season_id,
    all_days.session_date,
    seasons.default_location,
    seasons.default_start_time,
    seasons.default_duration_minutes,
    'scheduled' AS status,
    NULL AS admin_note
FROM all_days
INNER JOIN wp_1340630_tt_seasons seasons ON seasons.id = all_days.season_id
WHERE (WEEKDAY(all_days.session_date) + 1) = all_days.weekday
    AND NOT EXISTS (
        SELECT 1
        FROM wp_1340630_tt_sessions existing_sessions
        WHERE existing_sessions.team_id = all_days.team_id
            AND existing_sessions.session_date = all_days.session_date
    )
ORDER BY all_days.session_date;
