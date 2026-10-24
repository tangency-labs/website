import { expect, test } from "@playwright/test";
import { endpoint, githubRelease, mockDownloadAssets } from "./release-fixture";

test.beforeEach(async ({ page }) => {
	await mockDownloadAssets(page);
});

const cacheKey = "solidcraft:release:v1";
test("a new GitHub release updates packages, metadata, CTA and other pages without rebuilding", async ({
	page,
}) => {
	let requests = 0;
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
		Object.defineProperty(navigator, "userAgent", {
			get: () => "Mozilla/5.0 Macintosh",
		});
	});
	await page.route(endpoint, (route) => {
		requests++;
		return route.fulfill({ json: githubRelease("v0.13.0") });
	});
	const response = await page.goto("/download/");
	expect(response?.headers()["content-security-policy"]).toContain(
		"connect-src 'self' https://api.github.com",
	);
	await expect(page.locator("[data-release-tag]")).toHaveText("v0.13.0");
	await expect(page.locator(".package")).toHaveCount(22);
	await expect(page.locator(".package-filename").first()).toContainText(
		"0.13.0",
	);
	await expect(page.locator("[data-platform-download] a")).toHaveAttribute(
		"href",
		/releases\/latest$/,
	);
	await expect(page.locator("[data-release-notes]").first()).toHaveAttribute(
		"href",
		/v0.13.0/,
	);
	for (const link of await page
		.locator(".package a, [data-release-checksums]")
		.all()) {
		await expect(link).toHaveAttribute("href", /\/releases\/latest$/);
	}
	await page.getByLabel("Platform", { exact: true }).selectOption("Linux");
	await page.getByLabel("Architecture", { exact: true }).selectOption("ARM64");
	await page.getByLabel("Package format", { exact: true }).selectOption("DEB");
	await expect(page.locator(".package")).toHaveCount(1);
	await expect(page.locator("[data-platform-download] a")).toHaveAttribute(
		"href",
		/releases\/latest$/,
	);
	await page.goto("/");
	await expect(page.locator("[data-release-tag]").first()).toHaveText(
		"v0.13.0",
	);
	await page.goto("/releases/");
	await expect(page.locator("[data-release-tag]")).toHaveText("v0.13.0");
	await expect(page.locator("article")).toContainText("v0.12.0");
	expect(requests).toBe(1); // One shared request, cached across navigation.
});

test("rate limits and invalid release data retain usable saved packages", async ({
	page,
}) => {
	await page.route(endpoint, (route) =>
		route.fulfill({
			status: 403,
			json: { message: "API rate limit exceeded" },
		}),
	);
	await page.goto("/download/");
	await expect(page.locator("[data-release-status]")).toContainText(
		"GitHub could not be reached",
	);
	await expect(page.locator(".package")).toHaveCount(22);
	await expect(page.locator("[data-release-tag]")).toHaveText("v0.12.0");
	const bad = githubRelease("v0.13.0");
	bad.assets[0].browser_download_url = "https://evil.example/installer.exe";
	await page.route(endpoint, (route) => route.fulfill({ json: bad }));
	await page.reload();
	await expect(page.locator("[data-release-status]")).toContainText(
		"GitHub could not be reached",
	);
	await expect(page.locator(".package")).toHaveCount(22);
	await expect(page.locator(".package a").first()).toHaveAttribute(
		"href",
		/github.com\/tangency-labs\/solidcraft\/releases\/latest$/,
	);
});

test("expired or corrupted cache refreshes and optional checksums stay truthful", async ({
	page,
}) => {
	await page.addInitScript((key) => {
		if (!sessionStorage.getItem("seeded")) {
			localStorage.setItem(key, "{invalid");
			sessionStorage.setItem("seeded", "yes");
		}
	}, cacheKey);
	const release = githubRelease("v0.13.0");
	release.assets = release.assets.filter((a) => a.name !== "SHA256SUMS.txt");
	let requests = 0;
	await page.route(endpoint, (route) => {
		requests++;
		return route.fulfill({ json: release });
	});
	await page.goto("/download/");
	await expect(page.locator("[data-release-tag]")).toHaveText("v0.13.0");
	await expect(page.locator("[data-release-checksums]:visible")).toHaveCount(0);
	await page.evaluate((key) => {
		const cached = JSON.parse(localStorage.getItem(key) ?? "null");
		cached.observedAt = new Date(Date.now() - 6 * 60_000).toISOString();
		localStorage.setItem(key, JSON.stringify(cached));
	}, cacheKey);
	await page.reload();
	await expect(page.locator("[data-release-tag]")).toHaveText("v0.13.0");
	expect(requests).toBe(2);
});

test("disabled browser storage still fetches current releases", async ({
	page,
}) => {
	await page.addInitScript(() => {
		Storage.prototype.getItem = Storage.prototype.setItem = () => {
			throw new Error("Storage disabled");
		};
	});
	await page.route(endpoint, (route) =>
		route.fulfill({ json: githubRelease("v0.13.0") }),
	);
	await page.goto("/download/");
	await expect(page.locator("[data-release-tag]")).toHaveText("v0.13.0");
	await expect(page.locator(".package-filename").first()).toContainText(
		"0.13.0",
	);
});

test("an open page refreshes new packages after five minutes without losing filters", async ({
	page,
}) => {
	await page.clock.install();
	let tag = "v0.12.0";
	await page.route(endpoint, (route) =>
		route.fulfill({ json: githubRelease(tag) }),
	);
	await page.goto("/download/");
	await expect(page.locator("[data-release-status]")).toContainText(
		"from GitHub",
	);
	await page.getByLabel("Platform", { exact: true }).selectOption("Linux");
	await page.getByLabel("Architecture", { exact: true }).selectOption("ARM64");
	await page.getByLabel("Package format", { exact: true }).selectOption("DEB");
	tag = "v0.13.0";
	await page.clock.fastForward(5 * 60_000 + 1000);
	await expect(page.locator("[data-release-tag]")).toHaveText(tag);
	await expect(page.locator(".package")).toHaveCount(1);
	await expect(page.locator(".package-filename")).toContainText("0.13.0");
	await expect(page.locator("[data-platform-download] a")).toHaveAttribute(
		"href",
		/releases\/latest$/,
	);
});
