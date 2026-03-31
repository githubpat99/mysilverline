-- Lizenz-Nr. (Format 999.99.999.9) und Klassierung (N1–N4, R1–R9)
ALTER TABLE wp_1340630_tt_players
    ADD COLUMN license_number VARCHAR(12) DEFAULT NULL AFTER name,
    ADD COLUMN classification VARCHAR(2) DEFAULT NULL AFTER license_number;
