import { expect, test } from "@playwright/test";
import { endpoint, githubRelease, mockDownloadAssets } from "./release-fixture";

const systems = [
	{
		platform: "macOS",
		navigatorPlatform: "MacIntel",
		userAgent: "Mozilla/5.0 Macintosh",
		suffix: /macos-universal\.dmg$/,
	},
	{
		platform: "Windows",
		navigatorPlatform: "Win32",
		userAgent: "Mozilla/5.0 Windows NT 10.0; Win64; x64",
		suffix: /windows-x64\.exe$/,
	},
	{
		platform: "Linux",
		navigatorPlatform: "Linux x86_64",
		userAgent: "Mozilla/5.0 Linux x86_64",
		suffix: /linux-x86_64\.AppImage$/,
	},
	{
		platform: "FreeBSD",
		navigatorPlatform: "FreeBSD amd64",
		userAgent: "Mozilla/5.0 FreeBSD amd64",
		suffix: /freebsd-x86_64\.tar.gz$/,
	},
];

test.beforeEach(async ({ page }) => {
	await mockDownloadAssets(page);
	await page.route(endpoint, (route) =>
		route.fulfill({ json: githubRelease("v0.14.0") }),
	);
});

for (const system of systems) {
	test(`${system.platform} homepage buttons lead to one automatic matching download with all alternatives`, async ({
		page,
	}) => {
		await page.addInitScript(({ navigatorPlatform, userAgent }) => {
			Object.defineProperty(navigator, "platform", {
				value: navigatorPlatform,
			});
			Object.defineProperty(navigator, "userAgent", { value: userAgent });
			Object.defineProperty(navigator, "userAgentData", { value: undefined });
			Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
		}, system);
		await page.goto("/");
		await expect(page.locator(".hero .button.primary")).toHaveText(
			`Download for ${system.platform}`,
		);
		await expect(page.locator(".closing-cta .button.primary")).toHaveText(
			`Download for ${system.platform}`,
		);
		await expect(page.locator(".release-callout h2")).toHaveText(
			"SolidCraft v0.14.0",
		);
		const downloads: string[] = [];
		page.on("download", (download) => {
			downloads.push(download.url());
		});
		const download = page.waitForEvent("download");
		await page.locator(".hero .button.primary").click();
		expect((await download).url()).toMatch(system.suffix);
		expect(downloads[0]).toContain("/v0.14.0/");
		await expect(page).toHaveURL("/download/");
		await expect(page.locator(".package")).toHaveCount(22);
		await expect(page.locator("[data-auto-download-status]")).toContainText(
			"should start automatically",
		);
		await page.getByLabel("Platform", { exact: true }).selectOption("Linux");
		await page
			.getByLabel("Architecture", { exact: true })
			.selectOption("ARM64");
		await expect(page.locator(".package")).toHaveCount(6);
		expect(downloads).toHaveLength(1);
	});
}

test("ARM client hints override a Windows x64 user agent", async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "platform", { value: "Win32" });
		Object.defineProperty(navigator, "userAgent", {
			value: "Mozilla/5.0 Windows NT 10.0; Win64; x64",
		});
		Object.defineProperty(navigator, "userAgentData", {
			value: {
				getHighEntropyValues: async () => ({
					architecture: "arm",
					bitness: "64",
				}),
			},
		});
	});
	const download = page.waitForEvent("download");
	await page.goto("/download/");
	expect((await download).url()).toMatch(/windows-arm64\.msi$/);
	await expect(page.locator(".package")).toHaveCount(22);
});

for (const identity of [
	{
		platform: "Linux",
		userAgent: "Mozilla/5.0 Linux Android",
		label: "Download for your platform",
	},
	{
		platform: "Win32",
		userAgent: "Mozilla/5.0 Windows NT 10.0",
		label: "Download for Windows",
	},
]) {
	test(`unrecognized architecture or mobile system offers manual selection: ${identity.userAgent}`, async ({
		page,
	}) => {
		await page.addInitScript((identity) => {
			Object.defineProperty(navigator, "platform", {
				value: identity.platform,
			});
			Object.defineProperty(navigator, "userAgent", {
				value: identity.userAgent,
			});
			Object.defineProperty(navigator, "userAgentData", { value: undefined });
		}, identity);
		const downloads: string[] = [];
		page.on("download", (download) => {
			downloads.push(download.url());
		});
		await page.goto("/download/");
		await expect(page.locator("[data-release-tag]")).toHaveText("v0.14.0");
		await expect(page.locator("[data-platform-download] a")).toHaveText(
			identity.label,
		);
		await expect(page.locator(".package")).toHaveCount(22);
		await page.getByLabel("Platform", { exact: true }).selectOption("Windows");
		await page.getByLabel("Architecture", { exact: true }).selectOption("x64");
		await expect(page.locator("[data-platform-download] a")).toHaveAttribute(
			"href",
			/windows-x64\.exe$/,
		);
		expect(downloads).toEqual([]);
	});
}

test("a missing release keeps the saved package list without trying another repository", async ({
	page,
}) => {
	const requests: string[] = [];
	page.on("request", (request) => {
		if (request.url().startsWith("https://api.github.com/"))
			requests.push(request.url());
	});
	await page.route(endpoint, (route) =>
		route.fulfill({ status: 404, json: { message: "Not Found" } }),
	);
	await page.goto("/download/");
	await expect(page.locator("[data-release-status]")).toContainText(
		"GitHub could not be reached",
	);
	await expect(page.locator(".package")).toHaveCount(22);
	await expect(page.locator(".package .button").first()).toHaveAttribute(
		"href",
		/github.com\/tangency-labs\/solidcraft\/releases\/download\/v0.12.0\//,
	);
	expect(requests).toEqual([endpoint]);
});

test("Discord, migrated destinations and footer remain available on desktop and mobile", async ({
	page,
	request,
}) => {
	await page.goto("/");
	await expect(
		page
			.getByRole("navigation", { name: "Main navigation" })
			.getByRole("link", { name: "Discord" }),
	).toHaveAttribute("href", "https://discord.gg/FtU4NQNVDH");
	for (const path of ["/discord", "/discord/"]) {
		const response = await request.get(path, { maxRedirects: 0 });
		expect(response.status()).toBe(302);
		expect(response.headers().location).toBe("https://discord.gg/FtU4NQNVDH");
	}
	for (const path of ["/app", "/app/"]) {
		const response = await request.get(path, { maxRedirects: 0 });
		expect(response.status()).toBe(302);
		expect(response.headers().location).toBe("https://docs.solidcraft.io/app");
	}
	await expect(
		page.locator(".hero").getByRole("link", { name: "Try in your browser" }),
	).toHaveAttribute("href", "https://solidcraft.io/app");
	await expect(page.locator(".footer-brand")).toContainText("© Tangency Labs");
	await page.setViewportSize({ width: 390, height: 844 });
	await page.locator(".mobile-menu summary").click();
	await expect(
		page.locator(".mobile-menu").getByRole("link", { name: "Discord" }),
	).toBeVisible();
	await expect(
		page.locator(".mobile-menu").getByRole("link", { name: "GitHub" }),
	).toHaveAttribute("href", "https://github.com/tangency-labs/solidcraft");
});

test("automatic download waits for fresh metadata and does not repeat after refresh", async ({
	page,
}) => {
	await page.clock.install();
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "platform", { value: "MacIntel" });
		Object.defineProperty(navigator, "userAgent", {
			value: "Mozilla/5.0 Macintosh",
		});
		Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
	});
	let releaseResponse: (() => void) | undefined;
	let tag = "v0.14.0";
	await page.route(endpoint, async (route) => {
		await new Promise<void>((resolve) => {
			releaseResponse = resolve;
		});
		await route.fulfill({ json: githubRelease(tag) });
	});
	const downloads: string[] = [];
	page.on("download", (download) => {
		downloads.push(download.url());
	});
	await page.goto("/download/");
	await expect(page.locator("[data-download-label]")).toHaveText(
		"Download for macOS",
	);
	expect(downloads).toEqual([]);
	await expect.poll(() => Boolean(releaseResponse)).toBe(true);
	const first = page.waitForEvent("download");
	releaseResponse?.();
	expect((await first).url()).toContain("/v0.14.0/");
	tag = "v0.15.0";
	const firstReleaseResponse = releaseResponse;
	await page.clock.fastForward(5 * 60_000 + 1000);
	await expect.poll(() => releaseResponse !== firstReleaseResponse).toBe(true);
	releaseResponse?.();
	await expect(page.locator("[data-release-tag]")).toHaveText(tag);
	expect(downloads).toHaveLength(1);
});

test("a manual download while metadata is loading suppresses the automatic attempt", async ({
	page,
}) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "platform", { value: "MacIntel" });
		Object.defineProperty(navigator, "userAgent", {
			value: "Mozilla/5.0 Macintosh",
		});
		Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
	});
	let releaseResponse: (() => void) | undefined;
	await page.route(endpoint, async (route) => {
		await new Promise<void>((resolve) => {
			releaseResponse = resolve;
		});
		await route.fulfill({ json: githubRelease("v0.14.0") });
	});
	const downloads: string[] = [];
	page.on("download", (download) => {
		downloads.push(download.url());
	});
	await page.goto("/download/");
	await expect(page.locator("[data-download-label]")).toHaveText(
		"Download for macOS",
	);
	const manual = page.waitForEvent("download");
	await page.locator("[data-platform-download] a").click();
	await manual;
	await expect.poll(() => Boolean(releaseResponse)).toBe(true);
	releaseResponse?.();
	await expect(page.locator("[data-release-tag]")).toHaveText("v0.14.0");
	expect(downloads).toHaveLength(1);
});
