import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { snapshotSchema } from "../../src/lib/releases";

const snapshot = snapshotSchema.parse(
	JSON.parse(readFileSync("src/data/releases.json", "utf8")),
);
export const endpoint =
	"https://api.github.com/repos/tangency-labs/solidcraft/releases/latest";
export function githubRelease(tag = snapshot.tag) {
	const version = tag.slice(1);
	return {
		id: snapshot.releaseId + (tag === snapshot.tag ? 0 : 1),
		tag_name: tag,
		draft: false,
		prerelease: false,
		published_at: snapshot.publishedAt,
		html_url: `https://github.com/tangency-labs/solidcraft/releases/tag/${tag}`,
		assets: [
			...snapshot.artifacts.map((a) => ({
				id: a.id,
				name: a.name.replaceAll(snapshot.tag.slice(1), version),
				size: a.bytes,
				browser_download_url: a.url
					.replaceAll(snapshot.tag, tag)
					.replaceAll(snapshot.tag.slice(1), version),
				digest: a.digest,
			})),
			{
				id: 999999,
				name: "SHA256SUMS.txt",
				size: 100,
				browser_download_url: `https://github.com/tangency-labs/solidcraft/releases/download/${tag}/SHA256SUMS.txt`,
			},
		],
	};
}

// Avoid fetching actual installers in QA.
export async function mockDownloadAssets(page: Page) {
	await page.route(
		"https://github.com/*/solidcraft/releases/download/**",
		(route) =>
			route.fulfill({
				contentType: "application/octet-stream",
				headers: {
					"content-disposition":
						'attachment; filename="solidcraft-test-package"',
				},
				body: "Test package",
			}),
	);
}
