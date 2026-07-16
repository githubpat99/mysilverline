import { describe, expect, it } from "vitest";

import {
  filterSessionsForSeason,
  getSeasonLabelForDate,
  getSeasonTypeForDate,
  isAttendanceStatus,
  pickRelevantSession,
  resolveSessionSchedule,
  summarizeAttendance,
} from "./domain";

describe("tennisteam domain rules", () => {
  it("accepts only the planned attendance states", () => {
    expect(isAttendanceStatus("yes")).toBe(true);
    expect(isAttendanceStatus("replacement")).toBe(true);
    expect(isAttendanceStatus("later")).toBe(false);
  });

  it("summarizes responses and counts missing players", () => {
    const summary = summarizeAttendance(
      [
        { id: 1, name: "Patrik" },
        { id: 2, name: "Sven" },
        { id: 3, name: "Miro" },
        { id: 4, name: "Nico" },
      ],
      [
        { playerId: 1, attendanceStatus: "yes" },
        { playerId: 2, attendanceStatus: "no" },
        { playerId: 3, attendanceStatus: "replacement" },
      ],
    );

    expect(summary).toEqual({
      totalPlayers: 4,
      responded: 3,
      missing: 1,
      yes: 1,
      no: 1,
      maybe: 0,
      replacement: 1,
    });
  });

  it("prefers the next upcoming session over older ones", () => {
    const session = pickRelevantSession(
      [
        { id: 10, sessionDate: "2026-04-01", status: "scheduled" },
        { id: 11, sessionDate: "2026-04-08", status: "scheduled" },
        { id: 12, sessionDate: "2026-04-15", status: "cancelled" },
      ],
      "2026-04-06",
    );

    expect(session?.id).toBe(11);
  });

  it("falls back to the latest known session when no future session exists", () => {
    const session = pickRelevantSession(
      [
        { id: 20, sessionDate: "2026-03-18", status: "scheduled" },
        { id: 21, sessionDate: "2026-03-25", status: "cancelled" },
      ],
      "2026-04-06",
    );

    expect(session?.id).toBe(20);
  });

  it("detects summer and winter season types from dates", () => {
    expect(getSeasonTypeForDate("2026-05-08")).toBe("summer");
    expect(getSeasonTypeForDate("2026-10-08")).toBe("winter");
    expect(getSeasonTypeForDate("2026-02-08")).toBe("winter");
  });

  it("resolves session values from session to season to team", () => {
    expect(
      resolveSessionSchedule(
        {
          location: "Teamplatz",
          startTime: "19:00:00",
          durationMinutes: 90,
        },
        {
          location: "Sommerplatz",
          startTime: "18:30:00",
          durationMinutes: 120,
          description: "Sommertraining",
        },
        {
          location: "Auswaerts Bern",
          durationMinutes: 180,
        },
      ),
    ).toEqual({
      location: "Auswaerts Bern",
      startTime: "18:30:00",
      durationMinutes: 180,
      description: "Sommertraining",
    });
  });

  it("builds the expected season labels for summer and winter", () => {
    expect(getSeasonLabelForDate("2026-06-03")).toBe("Sommer 2026");
    expect(getSeasonLabelForDate("2026-11-04")).toBe("Winter 2026/27");
    expect(getSeasonLabelForDate("2026-04-08")).toBe("Winter 2025/26");
  });

  it("filters sessions for a selected season label", () => {
    const sessions = [
      { id: 1, sessionDate: "2026-04-08", status: "scheduled" as const },
      { id: 2, sessionDate: "2026-05-06", status: "scheduled" as const },
      { id: 3, sessionDate: "2026-05-13", status: "cancelled" as const },
      { id: 4, sessionDate: "2026-10-07", status: "scheduled" as const },
    ];

    expect(filterSessionsForSeason(sessions, "Sommer 2026").map((s) => s.id)).toEqual([2, 3]);
    expect(filterSessionsForSeason(sessions, "Winter 2025/26").map((s) => s.id)).toEqual([1]);
  });
});
