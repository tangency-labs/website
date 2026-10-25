import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { mockProgress } from "./progress-fixture";
import { endpoint, githubRelease, mockDownloadAssets } from "./release-fixture";

test.beforeEach(async ({ page }) => {
	await mockDownloadAssets(page);
	await mockProgress(page);
	await page.route(endpoint, (route) =>
		route.fulfill({ json: githubRelease() }),
	);
});

test("downloads hydrate in development and survive a concurrent production build", async ({
	page,
}) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto("/download/");
	await expect(page.getByLabel("Platform", { exact: true })).toBeEnabled();
	await expect(page.locator(".package")).toHaveCount(22);
	await page.getByLabel("Platform", { exact: true }).selectOption("Linux");
	await page.getByLabel("Architecture", { exact: true }).selectOption("ARM64");
	await page.getByLabel("Package format", { exact: true }).selectOption("DEB");
	await expect(page.locator(".package")).toHaveCount(1);
	await expect(page.locator(".package a")).toHaveAttribute(
		"href",
		/releases\/download\/v0\.22\.0\//,
	);
	await page.setViewportSize({ width: 390, height: 844 });
	const menu = page.locator(".mobile-menu");
	await menu.locator("summary").click();
	await expect(menu).toHaveAttribute("open", "");
	await page.keyboard.press("Escape");
	await expect(menu).not.toHaveAttribute("open", "");
	await promisify(execFile)("pnpm", ["build"], { timeout: 30_000 });
	await page.reload();
	await expect(page.getByLabel("Platform", { exact: true })).toBeEnabled();
	await expect(page.locator(".package")).toHaveCount(22);
	await menu.locator("summary").click();
	await expect(menu).toHaveAttribute("open", "");
	await page.keyboard.press("Escape");
	await expect(menu).not.toHaveAttribute("open", "");
	expect(errors).toEqual([]);
	await page.screenshot({
		path: "artifacts/download-development.png",
		fullPage: true,
	});
});
