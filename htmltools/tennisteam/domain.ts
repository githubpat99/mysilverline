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
};

export type PlayerResponse = {
  playerId: number;
  attendanceStatus: AttendanceStatus;
};

export function isAttendanceStatus(value: string): value is AttendanceStatus {
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

  const futureOrToday = sessions
    .filter((session) => session.sessionDate >= todayIsoDate)
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));

  if (futureOrToday.length > 0) {
    return futureOrToday[0];
  }

  return [...sessions].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))[0];
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
