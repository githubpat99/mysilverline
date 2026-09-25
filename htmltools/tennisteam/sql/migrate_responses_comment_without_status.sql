-- Erlaubt eine Rueckmeldung, die nur aus einem Kommentar besteht ("offen, aber Bemerkung").
-- Bisher war attendance_status NOT NULL, dadurch ging ein Kommentar ohne Status verloren.
--
-- VOR dem Deploy der zugehoerigen Code-Aenderung ausfuehren.
ALTER TABLE wp_1340630_tt_responses
    MODIFY COLUMN attendance_status ENUM('yes', 'no', 'maybe', 'replacement') NULL;
