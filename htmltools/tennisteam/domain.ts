/**
 * Tennisteam domain rules — Single Source of Truth for new business logic.
 *
 * Workflow (see AGENTS.md and doc/ARCHITECTURE.md):
 * 1. Add or change rules here (pure functions).
 * 2. Cover with domain.test.ts and run: npm run test:run -- htmltools/tennisteam/domain.test.ts
 * 3. Mirror equivalent logic in lib/team_data.php (PHP runtime).
 * 4. UI calls API only — do not duplicate rules in index.html / admin.html.
 */
export const attendanceStatuses = ["yes", "no", "maybe", "replacement"] as const;
export const seasonTypes = ["summer", "winter", "interclub", "custom"] as const;
export const sessionStatuses = ["scheduled", "provisional", "completed", "cancelled"] as const;

export type AttendanceStatus = (typeof attendanceStatuses)[number];
export type SeasonType = (typeof seasonTypes)[number];
export type SessionStatus = (typeof sessionStatuses)[number];

export type SessionRecord = {
  id: number;
  sessionDate: string;
  status: SessionStatus;
};

export type ScheduleDefaults = {
  location?: string | null;
  startTime?: string | null;
  durationMinutes?: number | null;
  description?: string | null;
};

export type TeamPlayer = {
  id: number;
  name: string;
  licenseNumber?: string | null;
  classification?: string | null;
};

export type PlayerResponse = {
  playerId: number;
  /** `null` = nur ein Kommentar hinterlegt, aber noch keine Zu- oder Absage. */
  attendanceStatus: AttendanceStatus | null;
};

export function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return attendanceStatuses.includes(value as AttendanceStatus);
}

export function getSeasonTypeForDate(isoDate: string): SeasonType {
  const month = Number.parseInt(isoDate.slice(5, 7), 10);
  return month >= 5 && month <= 9 ? "summer" : "winter";
}

export function getSeasonLabelForDate(isoDate: string): string {
  const year = Number.parseInt(isoDate.slice(0, 4), 10);
  const seasonType = getSeasonTypeForDate(isoDate);

  if (seasonType === "summer") {
    return `Sommer ${year}`;
  }

  const nextYearShort = String((year + 1) % 100).padStart(2, "0");
  const prevYear = year - 1;
  const month = Number.parseInt(isoDate.slice(5, 7), 10);

  return month >= 10
    ? `Winter ${year}/${nextYearShort}`
    : `Winter ${prevYear}/${String(year % 100).padStart(2, "0")}`;
}

export function summarizeAttendance(
  players: TeamPlayer[],
  responses: PlayerResponse[],
) {
  const respondedIds = new Set<number>();
  const summary = {
    totalPlayers: players.length,
    responded: 0,
    missing: 0,
    yes: 0,
    no: 0,
    maybe: 0,
    replacement: 0,
  };

  for (const response of responses) {
    if (!isAttendanceStatus(response.attendanceStatus)) {
      continue;
    }

    respondedIds.add(response.playerId);
    summary.responded += 1;
    summary[response.attendanceStatus] += 1;
  }

  summary.missing = Math.max(players.length - respondedIds.size, 0);

  return summary;
}

export function pickRelevantSession(
  sessions: SessionRecord[],
  todayIsoDate: string,
): SessionRecord | null {
  if (sessions.length === 0) {
    return null;
  }

  const isSelectable = (session: SessionRecord) =>
    session.status !== "cancelled" && session.status !== "completed";

  const sorted = [...sessions].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  const selectable = sorted.filter(isSelectable);
  const pool = selectable.length > 0 ? selectable : sorted;

  const futureOrToday = pool.filter((session) => session.sessionDate >= todayIsoDate);

  if (futureOrToday.length > 0) {
    return futureOrToday[0];
  }

  return pool[pool.length - 1] ?? null;
}

export function filterSessionsForSeason(
  sessions: SessionRecord[],
  seasonLabel: string,
): SessionRecord[] {
  return sessions.filter((session) => getSeasonLabelForDate(session.sessionDate) === seasonLabel);
}

export function resolveSessionSchedule(
  team: ScheduleDefaults,
  season: ScheduleDefaults,
  session: ScheduleDefaults,
) {
  return {
    location: session.location || season.location || team.location || null,
    startTime: session.startTime || season.startTime || team.startTime || null,
    durationMinutes:
      session.durationMinutes ?? season.durationMinutes ?? team.durationMinutes ?? null,
    description: session.description || season.description || null,
  };
}
