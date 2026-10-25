import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { routes, site } from "../../src/data/site";
import { mockProgress } from "./progress-fixture";
import { endpoint, githubRelease, mockDownloadAssets } from "./release-fixture";

test.beforeEach(async ({ page }) => {
	await mockDownloadAssets(page);
	await mockProgress(page);
	await page.route(endpoint, (route) =>
		route.fulfill({ json: githubRelease() }),
	);
});

for (const route of [
	...routes,
	"/solidcore/progress/",
	"/solidcore/progress/units/",
	"/solidcore/progress/issues/",
	"/solidcore/progress/ssi/",
]) {
	test(`route ${route} loads without browser errors or serious accessibility violations`, async ({
		page,
	}) => {
		const errors: string[] = [];
		page.on("pageerror", (error) => errors.push(error.message));
		page.on("console", (message) => {
			if (message.type() === "error" && !message.text().includes("404"))
				errors.push(message.text());
		});
		const response = await page.goto(route);
		expect(response?.status(), route).toBe(200);
		expect(response?.headers()["x-robots-tag"], route).toBeUndefined();
		await expect(page.locator('meta[name="robots"]'), route).toHaveAttribute(
			"content",
			"index, follow",
		);
		await expect(page.locator("h1"), route).toHaveCount(1);
		if (route.startsWith("/solidcore/progress/"))
			await expect(page.locator(".progress-provenance")).toBeVisible();
		const scan = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
			.analyze();
		expect(
			scan.violations.filter((v) =>
				["critical", "serious"].includes(v.impact || ""),
			),
			`Accessibility on ${route}`,
		).toEqual([]);
		expect(errors).toEqual([]);
	});
}

test("interior pages reflow on mobile, and font failure preserves usable content", async ({
	page,
}) => {
	for (const width of [320, 390, 768]) {
		await page.setViewportSize({ width, height: 844 });
		for (const route of routes.filter((route) => route !== "/")) {
			await page.goto(route);
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= window.innerWidth,
				),
				`Overflow on ${route} at ${width}`,
			).toBe(true);
		}
	}
	await page.route(/\.woff2$/, (route) => route.abort());
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/");
	await expect(page.locator(".hero h1")).toBeVisible();
	await expect(page.locator(".hero .actions a")).toHaveCount(3);
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth,
		),
	).toBe(true);
});

test("hero actions stay visible and layouts reflow at representative widths", async ({
	page,
}) => {
	for (const width of [320, 390, 430, 768, 1024, 1280, 1536]) {
		await page.setViewportSize({ width, height: 932 });
		await page.goto("/");
		const actions = page.locator(".hero .actions");
		await expect(
			actions.getByRole("link", { name: /Download (for .+|SolidCraft)/ }),
		).toHaveAttribute("href", /^\/download\/$|\/releases\/download\//);
		await expect(
			actions.getByRole("link", { name: "Try in your browser" }),
		).toHaveAttribute("href", site.app);
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
			`Horizontal overflow at ${width}`,
		).toBe(true);
		if (width === 390 || width === 430) {
			const box = await actions.boundingBox();
			if (!box) throw new Error("Hero actions are missing.");
			expect(box.y + box.height).toBeLessThan(844);
		}
	}
	await page.screenshot({ path: "artifacts/home-desktop.png", fullPage: true });
	await page.setViewportSize({ width: 390, height: 844 });
	await page.screenshot({ path: "artifacts/home-mobile.png", fullPage: true });
});

test("mobile disclosure supports keyboard, Escape, and navigation", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/");
	const menu = page.locator(".mobile-menu");
	const trigger = menu.locator("summary");
	await trigger.focus();
	await page.keyboard.press("Enter");
	await expect(menu).toHaveAttribute("open", "");
	await expect(
		menu.getByRole("link", { name: "Try in your browser" }),
	).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(menu).not.toHaveAttribute("open", "");
	await expect(trigger).toBeFocused();
	await trigger.click();
	await menu.getByRole("link", { name: "Features", exact: true }).click();
	await expect(page).toHaveURL("/features/");
});

test("download filters select correct architecture, show empty state, and reset", async ({
	page,
}) => {
	await page.goto("/download/");
	await expect(page.getByLabel("Platform", { exact: true })).toBeEnabled();
	await expect(page.locator(".package")).toHaveCount(22);
	const initialDownload = await page
		.locator("[data-platform-download] a")
		.getAttribute("href");
	await page.getByLabel("Platform", { exact: true }).selectOption("Linux");
	await page.getByLabel("Architecture", { exact: true }).selectOption("ARM64");
	await page.getByLabel("Package format", { exact: true }).selectOption("DEB");
	await expect(page.locator(".package")).toHaveCount(1);
	await expect(page.locator(".package .button")).toHaveAttribute(
		"href",
		/releases\/download\/v0\.22\.0\/solidcraft-0\.22\.0-linux-aarch64\.deb$/,
	);
	await expect(page.locator("[data-platform-download] a")).toHaveText(
		"Download SolidCraft for Linux",
	);
	await expect(page.locator("[data-platform-download] a")).toHaveAttribute(
		"href",
		/releases\/download\/v0\.22\.0\//,
	);
	await page.getByLabel("Platform", { exact: true }).selectOption("macOS");
	await expect(
		page.getByText("No matching package.", { exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: "Reset filters" }).click();
	await expect(page.locator(".package")).toHaveCount(22);
	await expect(page.locator("[data-platform-download] a")).toHaveAttribute(
		"href",
		initialDownload ?? "",
	);
	await expect(page.locator(".page-intro .actions")).not.toContainText(
		"Try in your browser",
	);
	await page.screenshot({
		path: "artifacts/download-desktop.png",
		fullPage: true,
	});
});

test("macOS gets the disk image link while all artifacts stay visible", async ({
	page,
}) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "platform", { value: "MacIntel" });
		Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
		Object.defineProperty(navigator, "userAgent", {
			value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
		});
	});
	await page.goto("/download/");
	await expect(page.locator("[data-platform-download] a")).toHaveText(
		"Download SolidCraft for macOS",
	);
	await expect(page.locator("[data-platform-download] a")).toHaveAttribute(
		"href",
		/releases\/download\/v0\.22\.0\/solidcraft-0\.22\.0-macos-universal\.dmg$/,
	);
	await expect(page.locator(".package")).toHaveCount(22);
});

test("no JavaScript preserves navigation, all packages, and selectable setup commands", async ({
	browser,
}) => {
	const context = await browser.newContext({
		javaScriptEnabled: false,
		viewport: { width: 390, height: 844 },
	});
	const page = await context.newPage();
	await page.goto("/download/");
	await expect(page.locator(".package")).toHaveCount(22);
	await page.locator(".mobile-menu summary").click();
	await page
		.locator(".mobile-menu")
		.getByRole("link", { name: "MCP", exact: true })
		.click();
	await expect(
		page.locator("pre").filter({ hasText: "claude mcp add solidcraft" }),
	).toBeVisible();
	await expect(page.getByRole("button", { name: "Copy command" })).toHaveCount(
		0,
	);
	await context.close();
});

test("MCP copy succeeds, announces status, and retains focus", async ({
	page,
	context,
}) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await page.goto("/mcp/");
	const button = page.getByRole("button", { name: "Copy command" }).last();
	await button.click();
	await expect(page.locator(".copy-status").last()).toHaveText("Copied.");
	await expect(button).toBeFocused();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
		"claude mcp add solidcraft -- solidcraft-cli mcp",
	);
});

test("MCP copy failure keeps a selectable manual fallback", async ({
	page,
}) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText: () => Promise.reject(new Error("denied")) },
		});
	});
	await page.goto("/mcp/");
	await page.getByRole("button", { name: "Copy command" }).last().click();
	await expect(page.locator(".copy-status").last()).toContainText(
		"Select the command",
	);
	await expect(page.locator("pre").last()).toContainText("claude mcp add");
});

test("videos autoplay muted inline with looping and no native controls or third-party requests", async ({
	page,
}) => {
	const external: string[] = [];
	page.on("request", (request) => {
		if (
			!request.url().startsWith("http://127.0.0.1:4322") &&
			request.url() !== endpoint
		)
			external.push(request.url());
	});
	await page.goto("/");
	for (const video of await page.locator("video").all()) {
		await video.scrollIntoViewIfNeeded();
		await expect
			.poll(() =>
				video.evaluate((element: HTMLVideoElement) => ({
					autoplay: element.autoplay,
					muted: element.muted,
					loop: element.loop,
					inline: element.playsInline,
					controls: element.controls,
				})),
			)
			.toEqual({
				autoplay: true,
				muted: true,
				loop: true,
				inline: true,
				controls: false,
			});
		await expect
			.poll(() =>
				video.evaluate((element: HTMLVideoElement) => element.currentTime),
			)
			.toBeGreaterThan(0);
		await expect
			.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
			.toBe(false);
	}
	const parameterVideo = page.getByLabel(
		"Watch the enclosure height change from 24 to 32 mm",
		{
			exact: true,
		},
	);
	await expect(parameterVideo.locator("source")).toHaveAttribute(
		"src",
		"/media/enclosure-parameter.mp4",
	);
	expect(
		await parameterVideo.evaluate((video: HTMLVideoElement) => video.duration),
	).toBeCloseTo(7.966667, 1);
	await expect(page.locator("#parameter-change-caption")).toHaveCount(1);
	expect(external).toEqual([]);
});

test("progress report keeps unit details, source links, and working filters", async ({
	page,
}) => {
	const response = await page.goto("/solidcore/progress/");
	expect(response?.status()).toBe(200);
	await expect(page.locator(".progress-back")).toHaveAttribute(
		"href",
		"/solidcore/",
	);
	await page.goto("/solidcore/progress/units/");
	const search = page.getByLabel("Search");
	await search.fill("vector3d");
	await expect(page.locator("table tbody tr:visible")).not.toHaveCount(0);
	const unit = page.locator("table tbody tr:visible a").first();
	await unit.click();
	await expect(page.locator("h1")).toContainText("vector3d");
	await page.goto("/solidcore/progress/ssi/");
	await expect(page.locator("h1")).toHaveText("SSI corpus");
});

test("missing route returns an actual 404 and security headers are enforced", async ({
	page,
}) => {
	const response = await page.goto("/this-page-does-not-exist/");
	expect(response?.status()).toBe(404);
	expect(response?.headers()["x-robots-tag"]).toBeUndefined();
	expect(response?.headers()["content-security-policy"]).toContain(
		"object-src 'none'",
	);
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(
		"This page isn’t here.",
	);
	await page.getByRole("link", { name: "Back to SolidCraft" }).click();
	await expect(page).toHaveURL("/");
});

const systems = [
	{
		name: "Windows x64",
		platform: "Win32",
		agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
		href: /releases\/download\/v0\.22\.0\/SolidCraft-0\.22\.0-windows-x64\.exe$/,
	},
	{
		name: "macOS",
		platform: "MacIntel",
		agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
		href: /releases\/download\/v0\.22\.0\/solidcraft-0\.22\.0-macos-universal\.dmg$/,
	},
	{
		name: "Linux x86_64",
		platform: "Linux x86_64",
		agent: "Mozilla/5.0 (X11; Linux x86_64)",
		href: /releases\/download\/v0\.22\.0\/solidcraft-0\.22\.0-linux-x86_64\.AppImage$/,
	},
];

async function spoof(
	page: import("@playwright/test").Page,
	platform: string,
	agent: string,
	touch = 0,
) {
	await page.addInitScript(
		({ platform, agent, touch }) => {
			Object.defineProperty(navigator, "platform", { value: platform });
			Object.defineProperty(navigator, "userAgent", { value: agent });
			Object.defineProperty(navigator, "maxTouchPoints", { value: touch });
			// Client hints would report this runner's real CPU.
			Object.defineProperty(navigator, "userAgentData", { value: undefined });
		},
		{ platform, agent, touch },
	);
}

for (const system of systems) {
	test(`home button is a plain link to the installer and clicking it stays on the page: ${system.name}`, async ({
		page,
	}) => {
		await spoof(page, system.platform, system.agent);
		const downloads: string[] = [];
		const assetRequests: string[] = [];
		const navigations: string[] = [];
		page.on("download", (download) => downloads.push(download.url()));
		page.on("request", (request) => {
			if (request.url().includes("/releases/download/"))
				assetRequests.push(request.url());
		});
		page.on("framenavigated", (frame) => {
			if (frame === page.mainFrame()) navigations.push(frame.url());
		});
		await page.goto("/");
		const button = page.locator(".hero .actions a.button.primary");
		await expect(button).toHaveAttribute("href", system.href);
		await expect(
			page.locator(".hero .actions").getByRole("link", {
				name: "Other downloads",
			}),
		).toHaveAttribute("href", "/download/");
		// Loading the page never touches an asset or starts a download.
		expect(assetRequests).toEqual([]);
		expect(downloads).toEqual([]);
		// A click serves the asset (mocked here, as an attachment) and the
		// visitor stays on the same page.
		const before = page.url();
		await button.click();
		await page.waitForTimeout(500);
		expect(page.url()).toBe(before);
		expect(navigations.every((url) => url === before)).toBe(true);
		expect(assetRequests).toHaveLength(1);
	});
}

test("home button goes to /download/ when the system is unknown", async ({
	page,
}) => {
	await spoof(
		page,
		"Linux armv8l",
		"Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile",
		5,
	);
	await page.goto("/");
	await expect(page.locator(".hero .actions a.button.primary")).toHaveAttribute(
		"href",
		"/download/",
	);
});

for (const path of ["/", "/download/"]) {
	test(`${path} never downloads or navigates to an asset by itself`, async ({
		page,
	}) => {
		const downloads: string[] = [];
		const assetRequests: string[] = [];
		const navigations: string[] = [];
		page.on("download", (download) => downloads.push(download.url()));
		page.on("request", (request) => {
			if (request.url().includes("/releases/download/"))
				assetRequests.push(request.url());
		});
		page.on("framenavigated", (frame) => navigations.push(frame.url()));
		await page.goto(path);
		await page.waitForTimeout(1500);
		expect(downloads).toEqual([]);
		expect(assetRequests).toEqual([]);
		expect(
			navigations.every((url) => !url.includes("/releases/download/")),
		).toBe(true);
		const html = await page.content();
		expect(html).not.toMatch(/http-equiv=["']refresh/i);
		expect(await page.locator("iframe").count()).toBe(0);
		expect(
			await page
				.locator(
					'link[rel~="prefetch"], link[rel~="preload"][href*="releases/download"]',
				)
				.count(),
		).toBe(0);
	});
}

test("download page lists every platform's packages as direct links", async ({
	page,
}) => {
	await page.goto("/download/");
	await expect(page.locator(".package")).toHaveCount(22);
	for (const platform of ["Windows", "macOS", "Linux", "FreeBSD"])
		await expect(
			page.locator(".package-platform", { hasText: platform }).first(),
		).toBeVisible();
	for (const kind of [
		"EXE installer",
		"MSI installer",
		"Disk image",
		"AppImage",
		"DEB",
		"RPM",
		"Flatpak",
		"TAR archive",
		"CLI ZIP",
	])
		await expect(
			page.locator(".package h3", { hasText: kind }).first(),
		).toBeVisible();
	for (const link of await page.locator(".package a.button").all())
		await expect(link).toHaveAttribute(
			"href",
			/^https:\/\/github\.com\/tangency-labs\/solidcraft\/releases\/download\/v0\.22\.0\//,
		);
	await expect(page.locator("[data-release-tag]")).toHaveText("v0.22.0");
	await expect(
		page.locator("a[data-release-checksums]").first(),
	).toHaveAttribute("href", /releases\/download\/v0\.22\.0\/SHA256SUMS\.txt$/);
	await expect(page.locator("[data-homebrew]")).toContainText(
		"brew install --cask tangency-labs/tap/solidcraft",
	);
	await expect(page.locator("#code-signing")).toContainText("SignPath");
});
