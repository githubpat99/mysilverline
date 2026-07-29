import { test, expect } from "@playwright/test";

const ADMIN_TOKEN = "admin-demo-token";

function buildSummary(
  responses: Record<number, { attendance_status: "yes" | "no" | "maybe" | "replacement"; comment: string | null }>,
  totalPlayers: number,
) {
  const summary = {
    total_players: totalPlayers,
    responded: 0,
    missing: totalPlayers,
    yes: 0,
    no: 0,
    maybe: 0,
    replacement: 0,
  };

  Object.values(responses).forEach((response) => {
    summary.responded += 1;
    summary.missing -= 1;
    summary[response.attendance_status] += 1;
  });

  return summary;
}

function createState() {
  const team = {
    id: 1,
    name: "Tennisteam Mittwoch",
    location: "Tennisplatz Silverline",
    weekday: 3,
    start_time: "19:00:00",
    duration_minutes: 90,
  };

  const season = {
    id: 1,
    name: "Winter - Training 2025/26",
    season_type: "winter",
    start_date: "2025-10-01",
    end_date: "2026-04-30",
    default_location: "Tennisplatz Silverline",
    default_weekday: 3,
    default_start_time: "19:00:00",
    default_duration_minutes: 90,
    description: "Wintertraining am Mittwoch.",
    is_active: true,
  };

  const seasons = [
    {
      id: 2,
      name: "Interclub Saison 2026",
      season_type: "interclub",
      start_date: "2026-05-01",
      end_date: "2026-07-31",
      default_location: "Clubanlage Silverline",
      default_weekday: 6,
      default_start_time: "13:00:00",
      default_duration_minutes: 240,
      description: "IC-Heimspiele als Standard.",
      is_active: false,
    },
    { ...season },
  ];

  const sessions = [
    {
      id: 1,
      season_id: 1,
      session_date: "2026-04-01",
      location: "Tennisplatz Silverline",
      start_time: "19:00:00",
      duration_minutes: 90,
      description: "Training wie gewohnt.",
      status: "scheduled",
      admin_note: "Bitte bis Dienstag eintragen.",
      summary: { total_players: 2, responded: 1, missing: 1, yes: 0, no: 1, maybe: 0, replacement: 0 },
    },
    {
      id: 2,
      season_id: 1,
      session_date: "2026-04-08",
      location: "Center Court",
      start_time: "20:15:00",
      duration_minutes: 120,
      description: "Interclub statt Training.",
      status: "scheduled",
      admin_note: null,
      summary: { total_players: 2, responded: 1, missing: 1, yes: 1, no: 0, maybe: 0, replacement: 0 },
    },
  ];

  const roster = [
    {
      id: 1,
      team_id: 1,
      name: "Patrik",
      sort_order: 1,
      player_token: "player-token-1",
      is_active: true,
    },
    {
      id: 2,
      team_id: 1,
      name: "Guido",
      sort_order: 2,
      player_token: "player-token-2",
      is_active: true,
    },
  ];

  const responsesBySession: Record<
    number,
    Record<number, { attendance_status: "yes" | "no" | "maybe" | "replacement"; comment: string | null }>
  > = {
    1: {
      1: { attendance_status: "no", comment: null },
    },
    2: {
      2: { attendance_status: "yes", comment: "Bin da" },
    },
  };

  return { team, season, seasons, sessions, roster, responsesBySession };
}

function buildDashboard(state: ReturnType<typeof createState>, selectedSessionId = 1) {
  const activeSeason =
    state.seasons.find((season) => season.id === state.season.id) ?? state.seasons[0] ?? null;
  const sessions = state.sessions.map((session) => ({
    ...session,
    summary: buildSummary(state.responsesBySession[session.id] ?? {}, state.roster.length),
  }));
  const selectedSession =
    sessions.find((session) => session.id === selectedSessionId) ?? sessions[0] ?? null;
  const selectedResponses = selectedSession ? state.responsesBySession[selectedSession.id] ?? {} : {};
  const selectedPlayers = state.roster.map((player) => {
    const response = selectedResponses[player.id];
    return {
      id: player.id,
      name: player.name,
      sort_order: player.sort_order,
      attendance_status: response?.attendance_status ?? null,
      comment: response?.comment ?? null,
      updated_at: null,
      is_current_player: false,
    };
  });

  return {
    success: true,
    data: {
      admin: {
        id: 1,
        label: "Patrik Admin",
        token: ADMIN_TOKEN,
      },
      team: state.team,
      season: activeSeason,
      seasons: state.seasons,
      sessions,
      selected_session: selectedSession,
      selected_players: selectedPlayers,
      selected_summary: selectedSession?.summary ?? buildSummary({}, state.roster.length),
      roster: state.roster,
      season_excluded_player_ids: [],
    },
  };
}

test.beforeEach(async ({ page }) => {
  const state = createState();

  await page.route("**/htmltools/tennisteam/api/admin/dashboard.php**", async (route) => {
    const url = new URL(route.request().url());
    const selectedSessionId = Number(url.searchParams.get("session_id") || "1");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildDashboard(state, selectedSessionId)),
    });
  });

  await page.route("**/htmltools/tennisteam/api/admin/session-update.php", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    const session = state.sessions.find((item) => item.id === Number(body.session_id));
    if (session) {
      session.session_date = body.session_date || session.session_date;
      session.status = body.status;
      session.location = body.location || null;
      session.start_time = body.start_time ? body.start_time + ":00" : null;
      session.duration_minutes =
        body.duration_minutes === null || body.duration_minutes === undefined || body.duration_minutes === ""
          ? null
          : Number(body.duration_minutes);
      session.description = body.description || null;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          admin: { id: 1, label: "Patrik Admin" },
        },
      }),
    });
  });

  await page.route("**/htmltools/tennisteam/api/admin/response-save.php", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    const sessionId = Number(body.session_id);
    const playerId = Number(body.player_id);
    const status = body.status;
    const existing = state.responsesBySession[sessionId] ?? {};

    if (!status) {
      delete existing[playerId];
    } else {
      existing[playerId] = {
        attendance_status: status,
        comment: null,
      };
    }

    state.responsesBySession[sessionId] = existing;

    const selectedPlayers = state.roster.map((player) => {
      const response = state.responsesBySession[sessionId]?.[player.id];
      return {
        id: player.id,
        name: player.name,
        sort_order: player.sort_order,
        attendance_status: response?.attendance_status ?? null,
        comment: response?.comment ?? null,
        updated_at: null,
        is_current_player: false,
      };
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          selected_players: selectedPlayers,
          selected_summary: buildSummary(state.responsesBySession[sessionId] ?? {}, state.roster.length),
        },
      }),
    });
  });

  await page.route("**/htmltools/tennisteam/api/admin/team-save.php", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    state.team = {
      ...state.team,
      name: body.name,
      location: body.location,
    };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          team: state.team,
        },
      }),
    });
  });

  await page.route("**/htmltools/tennisteam/api/admin/season-save.php", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    const previousWeekday = state.season.default_weekday;
    const nextWeekday = body.default_weekday ?? null;

    state.season = {
      id: 1,
      name: body.name,
      season_type: body.season_type,
      start_date: body.start_date,
      end_date: body.end_date,
      default_location: body.default_location || null,
      default_weekday: body.default_weekday ?? null,
      default_start_time: body.default_start_time ? body.default_start_time + ":00" : null,
      default_duration_minutes: body.default_duration_minutes ?? null,
      description: body.description || null,
      is_active: true,
    };
    state.seasons = state.seasons.map((season) => (season.id === 1 ? { ...state.season } : season));

    if (previousWeekday !== null && nextWeekday !== null && previousWeekday !== nextWeekday) {
      state.sessions = state.sessions.map((session) => {
        const nextDate = session.id === 1 ? "2026-04-02" : "2026-04-09";
        return { ...session, session_date: nextDate };
      });
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          season: state.season,
          future_sessions: {
            shifted: previousWeekday !== null && nextWeekday !== null && previousWeekday !== nextWeekday ? 2 : 0,
            skipped_conflicts: 0,
            out_of_range: 0,
          },
          generated_sessions: 0,
        },
      }),
    });
  });

  await page.route("**/htmltools/tennisteam/api/admin/season-delete.php", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    const seasonId = Number(body.season_id);
    const deletedSessions = state.sessions.filter((session) => session.season_id === seasonId).length;

    state.sessions = state.sessions.filter((session) => session.season_id !== seasonId);
    state.seasons = state.seasons.filter((season) => season.id !== seasonId);
    state.season = state.seasons[0];

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          deleted_sessions: deletedSessions,
        },
      }),
    });
  });

  await page.route("**/htmltools/tennisteam/api/admin/player-save.php", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    const playerId = Number(body.player_id || 0);

    if (playerId > 0) {
      state.roster = state.roster.map((player) =>
        player.id === playerId
          ? {
              ...player,
              name: body.name,
              sort_order: Number(body.sort_order),
              is_active: Boolean(body.is_active),
              player_token: body.regenerate_token ? `${player.player_token}-new` : player.player_token,
            }
          : player,
      );
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          player: state.roster[0],
          roster: state.roster,
        },
      }),
    });
  });

  await page.route("**/htmltools/tennisteam/api/admin/player-delete.php", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    const playerId = Number(body.player_id);
    state.roster = state.roster.filter((player) => player.id !== playerId);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          player_id: playerId,
          roster: state.roster,
        },
      }),
    });
  });
});

test("admin recovers from a stale season id in the url", async ({ page }) => {
  await page.unroute("**/htmltools/tennisteam/api/admin/dashboard.php**");
  const state = createState();

  await page.route("**/htmltools/tennisteam/api/admin/dashboard.php**", async (route) => {
    const url = new URL(route.request().url());
    const seasonId = url.searchParams.get("season_id");

    if (seasonId === "999") {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: "Season not found.",
        }),
      });
      return;
    }

    const selectedSessionId = Number(url.searchParams.get("session_id") || "1");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildDashboard(state, selectedSessionId)),
    });
  });

  await page.goto(`/htmltools/tennisteam/admin.html?token=${ADMIN_TOKEN}&season_id=999`);

  await expect(page.locator("#error-box")).toBeHidden();
  await expect(page.locator("#season-name-input")).toHaveValue("Winter - Training 2025/26");
});

test("admin dashboard loads with roster tokens", async ({ page }) => {
  await page.goto(`/htmltools/tennisteam/admin.html?token=${ADMIN_TOKEN}`);

  await expect(page.getByRole("heading", { name: /Tennisteam Mittwoch Admin/i })).toBeVisible();
  await expect(page.locator("#error-box")).toBeHidden();
  await expect(page.getByRole("button", { name: "Interclub Saison 2026" })).toBeVisible();
  await expect(page.locator('input[value="player-token-1"]').first()).toBeVisible();
  await expect(page.locator('input[value*="index.html?token=player-token-1"]').first()).toBeVisible();
  await expect(page.locator("#season-start-input")).toHaveValue("01.10.2025");
  await expect(page.locator("#season-end-input")).toHaveValue("30.04.2026");
  await expect(page.locator("#season-time-input")).toHaveValue("19:00");
  await expect(page.locator("#season-location-input")).toHaveValue("Tennisplatz Silverline");
});

test("admin can select and save a session", async ({ page }) => {
  await page.goto(`/htmltools/tennisteam/admin.html?token=${ADMIN_TOKEN}`);

  const sessionButtons = page.locator("#sessions-list button");
  await expect(sessionButtons.nth(1)).toBeVisible();
  await sessionButtons.nth(1).click();

  await expect(page.locator("#selected-session-title")).toHaveText(/08\.04\.2026/i);
  await page.locator("#session-date-picker").fill("2026-04-10");
  await page.getByRole("button", { name: "Provisorisch" }).click();
  await page.locator("#session-location-input").fill("IC Bern");
  await page.locator("#session-time-trigger").click();
  await page.locator("#time-picker-hour").selectOption("14");
  await page.locator("#time-picker-minute").selectOption("30");
  await page.getByRole("button", { name: "Uebernehmen" }).click();
  await page.locator("#session-duration-input").fill("180");
  await page.locator("#session-description-input").fill("Interclub auswaerts.");
  await page.getByRole("button", { name: "Termin speichern" }).click();

  await expect(page.locator("#error-box")).toBeHidden();
  await expect(page.getByText("Termin gespeichert.")).toBeVisible();
  await expect(page.locator("#sessions-list button").nth(1)).toContainText("10.04.2026");
  await expect(page.locator("#sessions-list button").nth(1)).toContainText("Provisorisch");
});

test("admin can record another player's response for a selected session", async ({ page }) => {
  await page.goto(`/htmltools/tennisteam/admin.html?token=${ADMIN_TOKEN}`);

  const guidoRow = page.locator("#selected-players-list .response-row").filter({ hasText: "Guido" });
  await guidoRow.getByRole("button", { name: "Dabei" }).click();

  await expect(page.locator("#error-box")).toBeHidden();
  await expect(page.locator("#selected-session-summary")).toContainText("Geantwortet");
  await expect(page.locator("#selected-session-summary")).toContainText("2");
  await expect(page.locator("#sessions-list button").first()).toContainText("Zusagen: 1");
  await expect(page.locator("#sessions-list button").first()).toContainText("Absagen: 1");
});

test("admin can mark a session duration as unbestimmt", async ({ page }) => {
  await page.goto(`/htmltools/tennisteam/admin.html?token=${ADMIN_TOKEN}`);

  await page.locator("#sessions-list button").nth(1).click();
  await page.locator("#session-duration-open-ended-input").check();
  await page.getByRole("button", { name: "Termin speichern" }).click();

  await expect(page.locator("#error-box")).toBeHidden();
  await expect(page.locator("#session-duration-open-ended-input")).toBeChecked();
  await expect(page.locator("#selected-session-summary")).toContainText("Unbestimmt");
});

test("admin displays completed sessions with matching status button", async ({ page }) => {
  await page.unroute("**/htmltools/tennisteam/api/admin/dashboard.php**");
  const state = createState();
  state.sessions[0] = {
    ...state.sessions[0],
    status: "completed",
  };

  await page.route("**/htmltools/tennisteam/api/admin/dashboard.php**", async (route) => {
    const url = new URL(route.request().url());
    const selectedSessionId = Number(url.searchParams.get("session_id") || "1");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildDashboard(state, selectedSessionId)),
    });
  });

  await page.goto(`/htmltools/tennisteam/admin.html?token=${ADMIN_TOKEN}`);

  await expect(page.locator("#sessions-list button").first()).toContainText("Durchgefuehrt");
  await expect(page.getByRole("button", { name: "Durchgefuehrt", exact: true })).toHaveClass(/active/);
});

test("admin can save team basics", async ({ page }) => {
  await page.goto(`/htmltools/tennisteam/admin.html?token=${ADMIN_TOKEN}`);

  await page.locator("#team-name-input").fill("Tennisteam Center Court");
  await page.locator("#team-location-input").fill("Fallback Halle");
  await page.getByRole("button", { name: "Team speichern" }).click();

  await expect(page.locator("#error-box")).toBeHidden();
  await expect(page.locator("#team-location-input")).toHaveValue("Fallback Halle");
});

test("admin can save interclub season defaults", async ({ page }) => {
  await page.goto(`/htmltools/tennisteam/admin.html?token=${ADMIN_TOKEN}`);

  await page.getByRole("button", { name: "Neue Saison" }).click();
  await page.locator("#season-name-input").fill("Interclub Saison 2026");
  await page.locator("#season-type-input").selectOption("interclub");
  await page.locator("#season-start-picker").fill("2026-05-01");
  await page.locator("#season-end-picker").fill("2026-07-31");
  await page.locator("#season-weekday-input").selectOption("6");
  await page.locator("#season-time-trigger").click();
  await page.locator("#time-picker-hour").selectOption("13");
  await page.locator("#time-picker-minute").selectOption("00");
  await page.getByRole("button", { name: "Uebernehmen" }).click();
  await page.locator("#season-duration-input").fill("240");
  await page.locator("#season-location-input").fill("Clubanlage Silverline");
  await page.locator("#season-description-input").fill("Heimspiele als Standard.");
  await page.locator("#season-save-btn").click({ force: true });

  await expect(page.locator("#error-box")).toBeHidden();
  await expect(page.getByText("Saison gespeichert.")).toBeVisible();
});

test("admin shifts future season sessions when weekday changes", async ({ page }) => {
  await page.goto(`/htmltools/tennisteam/admin.html?token=${ADMIN_TOKEN}`);

  await page.locator("#season-weekday-input").selectOption("4");
  await page.getByRole("button", { name: "Saison speichern" }).click();

  await expect(page.locator("#error-box")).toBeHidden();
  await expect(page.locator("#season-save-msg")).toContainText("2 kuenftige Termine verschoben.");
  await expect(page.locator("#sessions-list button").first()).toContainText("02.04.2026");
});

test("admin can delete a season", async ({ page }) => {
  await page.goto(`/htmltools/tennisteam/admin.html?token=${ADMIN_TOKEN}`);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Saison loeschen" }).click();

  await expect(page.locator("#error-box")).toBeHidden();
  await expect(page.getByText("Saison geloescht.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Interclub Saison 2026" })).toBeVisible();
});

test("admin can delete a player", async ({ page }) => {
  await page.goto(`/htmltools/tennisteam/admin.html?token=${ADMIN_TOKEN}`);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Spieler loeschen" }).first().click();

  await expect(page.locator("#error-box")).toBeHidden();
  await expect(page.locator("#roster-list")).not.toContainText("Patrik");
  await expect(page.locator("#roster-list")).toContainText("Guido");
});
