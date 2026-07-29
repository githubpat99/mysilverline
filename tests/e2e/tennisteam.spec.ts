import { test, expect } from "@playwright/test";

const TENNISTEAM_PLAYER_TOKEN =
  "294310927a442ea46ddabd53f7c9e5a95f28776498cacf64f0f9c856e1c4fab8";

const seasonPayload = {
  success: true,
  data: {
    team: {
      id: 1,
      name: "Tennisteam Mittwoch",
      location: "Tennisplatz Silverline",
      weekday: 3,
      start_time: "19:00:00",
      duration_minutes: 90,
    },
    season: {
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
    },
    seasons: [
      {
        id: 3,
        name: "Interclub Saison 2026",
        season_type: "interclub",
        start_date: "2026-05-01",
        end_date: "2026-07-31",
        default_location: "Clubanlage Silverline",
        default_weekday: 6,
        default_start_time: "13:00:00",
        default_duration_minutes: 240,
        description: "IC-Heimspiele als Standard.",
        is_active: true,
      },
      {
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
      },
    ],
    sessions: [
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
        summary: {
          total_players: 8,
          responded: 1,
          missing: 7,
          yes: 0,
          no: 1,
          maybe: 0,
          replacement: 0,
        },
        own_response: {
          id: 1,
          name: "Patrik",
          sort_order: 1,
          attendance_status: "no",
          comment: null,
          updated_at: "2026-03-30 15:38:24",
          is_current_player: true,
        },
      },
      {
        id: 2,
        season_id: 1,
        session_date: "2026-04-08",
        location: "Center Court",
        start_time: "20:15:00",
        duration_minutes: 120,
        description: "Platz 2 statt Platz 1.",
        status: "scheduled",
        admin_note: null,
        summary: {
          total_players: 8,
          responded: 0,
          missing: 8,
          yes: 0,
          no: 0,
          maybe: 0,
          replacement: 0,
        },
        own_response: {
          id: 1,
          name: "Patrik",
          sort_order: 1,
          attendance_status: null,
          comment: null,
          updated_at: null,
          is_current_player: true,
        },
      },
    ],
  },
};

const sessionDetails = {
  1: {
    success: true,
    data: {
      team: seasonPayload.data.team,
      season: seasonPayload.data.season,
      session: {
        id: 1,
        session_date: "2026-04-01",
        season_id: 1,
        location: "Tennisplatz Silverline",
        start_time: "19:00:00",
        duration_minutes: 90,
        description: "Training wie gewohnt.",
        status: "scheduled",
        admin_note: "Bitte bis Dienstag eintragen.",
      },
      players: [
        {
          id: 1,
          name: "Patrik",
          sort_order: 1,
          attendance_status: "no",
          comment: null,
          updated_at: "2026-03-30 15:38:24",
          is_current_player: true,
        },
        {
          id: 2,
          name: "Guido",
          sort_order: 2,
          attendance_status: null,
          comment: null,
          updated_at: null,
          is_current_player: false,
        },
      ],
      summary: seasonPayload.data.sessions[0].summary,
      own_response: seasonPayload.data.sessions[0].own_response,
    },
  },
  2: {
    success: true,
    data: {
      team: seasonPayload.data.team,
      season: seasonPayload.data.season,
      session: {
        id: 2,
        session_date: "2026-04-08",
        season_id: 1,
        location: "Center Court",
        start_time: "20:15:00",
        duration_minutes: 120,
        description: "Platz 2 statt Platz 1.",
        status: "scheduled",
        admin_note: null,
      },
      players: [
        {
          id: 1,
          name: "Patrik",
          sort_order: 1,
          attendance_status: null,
          comment: null,
          updated_at: null,
          is_current_player: true,
        },
        {
          id: 2,
          name: "Guido",
          sort_order: 2,
          attendance_status: "yes",
          comment: "Bin da",
          updated_at: "2026-03-30 16:12:00",
          is_current_player: false,
        },
      ],
      summary: seasonPayload.data.sessions[1].summary,
      own_response: seasonPayload.data.sessions[1].own_response,
    },
  },
} as const;

test.beforeEach(async ({ page }) => {
  await page.route("**/htmltools/tennisteam/api/sessions.php**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(seasonPayload),
    });
  });

  await page.route("**/htmltools/tennisteam/api/session.php**", async (route) => {
    const url = new URL(route.request().url());
    const sessionId = Number(url.searchParams.get("session_id") || "1") as 1 | 2;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(sessionDetails[sessionId] ?? sessionDetails[1]),
    });
  });
});

test("tennisteam recovers from a stale season id in the url", async ({ page }) => {
  await page.unroute("**/htmltools/tennisteam/api/sessions.php**");
  await page.route("**/htmltools/tennisteam/api/sessions.php**", async (route) => {
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

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(seasonPayload),
    });
  });

  await page.goto(`/htmltools/tennisteam/index.html?token=${TENNISTEAM_PLAYER_TOKEN}&season_id=999`);

  await expect(page.locator("#error-box")).toBeHidden();
  await expect(page.locator("#sessions-list button").first()).toBeVisible();
  await expect(page.locator("#overview-season-label")).toHaveText(/Winter - Training 2025\/26/i);
});

test("tennisteam recovers from a stale or unpublished session id in the url", async ({ page }) => {
  await page.unroute("**/htmltools/tennisteam/api/session.php**");
  await page.route("**/htmltools/tennisteam/api/session.php**", async (route) => {
    const url = new URL(route.request().url());
    const sessionId = url.searchParams.get("session_id");

    if (sessionId === "999") {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: "Session not found.",
        }),
      });
      return;
    }

    const numericSessionId = Number(sessionId || "1") as 1 | 2;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(sessionDetails[numericSessionId] ?? sessionDetails[1]),
    });
  });

  await page.goto(`/htmltools/tennisteam/index.html?token=${TENNISTEAM_PLAYER_TOKEN}&session_id=999`);

  await expect(page.locator("#error-box")).toBeHidden();
  await expect(page.locator("#highlight-title")).toContainText("19:00");
  await expect(page.locator("#sessions-list button").first()).toHaveClass(/current/);
});

test("tennisteam season view loads without runtime error", async ({ page }) => {
  await page.goto(`/htmltools/tennisteam/index.html?token=${TENNISTEAM_PLAYER_TOKEN}`);

  await expect(
    page.getByRole("heading", { name: /Tennisteam Mittwoch/i }),
  ).toBeVisible();
  await expect(page.locator("#error-box")).toBeHidden();
  await expect(page.locator("#sessions-list button").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Interclub Saison 2026/i })).toBeVisible();
  await expect(page.getByText("Ausgewaehlter Termin")).toHaveCount(0);
  await expect(page.locator("#jump-to-session-btn")).toHaveCount(0);
});

test("tennisteam clicking a session opens its detail block", async ({ page }) => {
  await page.goto(`/htmltools/tennisteam/index.html?token=${TENNISTEAM_PLAYER_TOKEN}`);

  const sessionButtons = page.locator("#sessions-list button");
  await expect(sessionButtons.first()).toBeVisible();

  const responseCard = page.locator("#response-card");
  await sessionButtons.nth(1).click();

  await expect(responseCard).toBeInViewport();
  await expect(page.locator("#highlight-title")).toContainText("20:15");
  await page.getByRole("button", { name: /Termininfo anzeigen/i }).click();
  await expect(page.locator("#selected-session-time")).toHaveText("20:15");
  await expect(page.locator("#selected-session-location")).toHaveText(/Center Court/i);
  await expect(page.locator("#session-note")).toContainText(/Platz 2 statt Platz 1/i);
  await expect(page.locator("#error-box")).toBeHidden();
});

test("tennisteam shows season defaults in the details panel", async ({ page }) => {
  await page.goto(`/htmltools/tennisteam/index.html?token=${TENNISTEAM_PLAYER_TOKEN}`);

  await page.getByRole("button", { name: /Saisoninfo anzeigen/i }).click();

  await expect(page.locator("#season-time")).toContainText(/Mittwoch, 19:00/i);
  await expect(page.locator("#season-duration")).toHaveText("90 Min.");
  await expect(page.locator("#season-location")).toHaveText(/Tennisplatz Silverline/i);
});
