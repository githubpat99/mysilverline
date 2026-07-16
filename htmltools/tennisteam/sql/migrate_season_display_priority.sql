ALTER TABLE wp_1340630_tt_seasons
    ADD COLUMN display_priority SMALLINT UNSIGNED DEFAULT NULL AFTER description;

UPDATE wp_1340630_tt_seasons
SET display_priority = CASE
    WHEN is_active = 1 THEN 1
    ELSE 2
END
WHERE display_priority IS NULL;
