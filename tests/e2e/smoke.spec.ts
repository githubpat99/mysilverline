import { test, expect } from "@playwright/test";

test("landing loads and shows Silverline", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Silverline")).toBeVisible();
});

test("finance route opens", async ({ page }) => {
  await page.goto("/finance");
  await expect(
    page.getByRole("heading", { name: "Silverline – Finanzen" }),
  ).toBeVisible();
});
