import { test, expect } from "@playwright/test";

test.describe("iOS focused flow (WebKit emulation)", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "webkit-ios",
      "This suite is intended for the webkit-ios project only.",
    );
  });

  test("landing shows iOS install guidance", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /Installiere die Silverline App/i }),
    ).toBeVisible();
    await expect(page.getByText("Teilen")).toBeVisible();
    await expect(page.getByText("Zum Home-Bildschirm")).toBeVisible();
  });

  test("finance page opens and shows first workflow step", async ({ page }) => {
    await page.goto("/finance");

    await expect(page).toHaveURL(/\/finance/);
    const loadingText = page.getByText("Daten werden geladen…");
    if (await loadingText.isVisible().catch(() => false)) {
      await expect(loadingText).toBeHidden({ timeout: 20_000 });
    }

    const pickerHeading = page.getByRole("heading", {
      name: /Willkommen bei Silverline/i,
    });
    if (await pickerHeading.isVisible().catch(() => false)) {
      await page
        .getByRole("button", { name: /Oder starte mit leeren Daten/i })
        .click();
    }

    await expect(
      page.getByRole("button", { name: /^Vermögen$/i }),
    ).toBeVisible({ timeout: 20_000 });
  });
});
