import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
	detectPlatform,
	recommendArtifact,
} from "../src/lib/download-utils.ts";
import {
	classifyArtifact,
	normalizeRelease,
} from "../src/lib/normalize-release.ts";
import {
	filterArtifacts,
	formatBytes,
	isReleaseAssetUrl,
	isStale,
	snapshotSchema,
} from "../src/lib/releases.ts";

const snapshot = snapshotSchema.parse(
	JSON.parse(readFileSync("src/data/releases.json", "utf8")),
);
test("platform detection recognizes desktop systems without treating mobile browsers as desktops", () => {
	assert.equal(
		detectPlatform({
			userAgent: "Mozilla/5.0 Macintosh",
			platform: "MacIntel",
		}),
		"macOS",
	);
	assert.equal(
		detectPlatform({
			userAgent: "Mozilla/5.0 Windows NT 10.0",
			platform: "Win32",
		}),
		"Windows",
	);
	assert.equal(
		detectPlatform({
			userAgent: "Mozilla/5.0 Linux x86_64",
			platform: "Linux",
		}),
		"Linux",
	);
	assert.equal(
		detectPlatform({
			userAgent: "Mozilla/5.0 Macintosh",
			platform: "MacIntel",
			maxTouchPoints: 5,
		}),
		null,
	);
	assert.equal(
		detectPlatform({
			userAgent: "Mozilla/5.0 Linux Android",
			platform: "Linux",
		}),
		null,
	);
	assert.equal(detectPlatform({ userAgent: "unknown", platform: "" }), null);
});
test("platform download uses the Universal macOS build and asks other systems for architecture", () => {
	assert.match(
		recommendArtifact(snapshot.artifacts, "macOS")?.url ?? "",
		/macos-universal\.dmg$/,
	);
	assert.equal(recommendArtifact(snapshot.artifacts, "Windows"), null);
	assert.equal(recommendArtifact(snapshot.artifacts, "Linux"), null);
	assert.equal(recommendArtifact(snapshot.artifacts, null), null);
	assert.match(
		recommendArtifact(snapshot.artifacts, "Windows", "ARM64")?.url ?? "",
		/windows-arm64\.msi$/,
	);
	assert.match(
		recommendArtifact(snapshot.artifacts, "Linux", "ARM64", "DEB")?.url ?? "",
		/linux-aarch64\.deb$/,
	);
	assert.equal(
		recommendArtifact(snapshot.artifacts, "macOS", "ARM64", "DEB"),
		null,
	);
});
test("download destinations must match the exact repository, release, and HTTPS resource shape", () => {
	const base = `https://github.com/tangency-labs/solidcraft/releases/download/${snapshot.tag}/`;
	assert.equal(isReleaseAssetUrl(`${base}solidcraft.zip`, snapshot.tag), true);
	for (const bad of [
		`${base.replace("https:", "http:")}a.zip`,
		`${base.replace("tangency-labs", "attacker")}a.zip`,
		`${base.replace("github.com", "github.com.evil.test")}a.zip`,
		`${base.replace(snapshot.tag, "v0.11.0")}a.zip`,
		`${base}%2e%2e/evil`,
		`${base}a%2fb.zip`,
		`${base}a%5cb.zip`,
		`${base}a.zip?redirect=evil`,
		`${base}a.zip#other`,
		`${base.replace("github.com", "github.com:444")}a.zip`,
		"javascript:alert(1)",
	])
		assert.equal(isReleaseAssetUrl(bad, snapshot.tag), false, bad);
});
test("platform mapping distinguishes architecture, CLI, and non-user artifacts", () => {
	assert.deepEqual(
		classifyArtifact("solidcraft-0.12.0-windows-arm64.msi", "0.12.0"),
		{
			platform: "Windows",
			architecture: "ARM64",
			kind: "MSI installer",
			cli: "unknown",
		},
	);
	assert.equal(
		classifyArtifact("solidcraft-cli-0.12.0-macos-universal.zip", "0.12.0")
			?.cli,
		"yes",
	);
	assert.equal(
		classifyArtifact("solidcraft-0.12.0-linux-aarch64.deb", "0.12.0")
			?.architecture,
		"ARM64",
	);
	for (const name of [
		"solidcraft-web-0.12.0.zip",
		"solidcraft-linux-x86_64.AppImage",
		"SHA256SUMS.txt",
		"solidcraft-0.12.0-linux-x86_64.AppImage.zsync",
	])
		assert.equal(classifyArtifact(name, "0.12.0"), null);
});
test("filters preserve all packages by default and support explicit empty results", () => {
	assert.equal(
		filterArtifacts(snapshot.artifacts, {
			platform: "",
			architecture: "",
			kind: "",
		}).length,
		22,
	);
	const arm = filterArtifacts(snapshot.artifacts, {
		platform: "Linux",
		architecture: "ARM64",
		kind: "DEB",
	});
	assert.equal(arm.length, 1);
	assert.match(arm[0].name, /linux-aarch64\.deb$/);
	assert.equal(
		filterArtifacts(snapshot.artifacts, {
			platform: "Windows",
			architecture: "Universal",
			kind: "",
		}).length,
		0,
	);
});
test("published snapshot rejects duplicate assets, a substituted URL, and wrong notes", () => {
	assert.throws(() =>
		snapshotSchema.parse({
			...snapshot,
			artifacts: [...snapshot.artifacts, snapshot.artifacts[0]],
		}),
	);
	assert.throws(() =>
		snapshotSchema.parse({
			...snapshot,
			artifacts: [
				{ ...snapshot.artifacts[0], url: "https://example.org/app.exe" },
			],
		}),
	);
	assert.throws(() =>
		snapshotSchema.parse({
			...snapshot,
			notes: "https://github.com/attacker/solidcraft/releases/tag/v0.12.0",
		}),
	);
});
test("freshness preserves original dates; sizes use MiB", () => {
	assert.equal(
		isStale("2026-10-01T00:00:00Z", Date.parse("2026-10-10T00:00:00Z")),
		false,
	);
	assert.equal(
		isStale("2026-10-01T00:00:00Z", Date.parse("2026-10-16T00:00:00Z")),
		true,
	);
	assert.equal(formatBytes(1024 * 1024), "1.0 MiB");
});
test("refresh rejects prereleases and drafts before creating a candidate", () => {
	const input = {
		id: 1,
		tag_name: "v0.12.0",
		draft: false,
		prerelease: true,
		published_at: "2026-10-15T00:00:00Z",
		html_url: snapshot.notes,
		assets: [],
	};
	assert.throws(
		() => normalizeRelease(input, snapshot.observedAt),
		/non-prerelease/,
	);
	assert.throws(
		() =>
			normalizeRelease(
				{ ...input, prerelease: false, draft: true },
				snapshot.observedAt,
			),
		/non-draft/,
	);
});

test("live normalization skips new package roles, allows missing checksum files, and validates every mapped destination", () => {
	const assets = snapshot.artifacts.map((a) => ({
		id: a.id,
		name: a.name,
		size: a.bytes,
		browser_download_url: a.url,
		digest: a.digest,
	}));
	const input = {
		id: 1,
		tag_name: snapshot.tag,
		draft: false,
		prerelease: false,
		published_at: snapshot.publishedAt,
		html_url: snapshot.notes,
		assets,
	};
	const extra = {
		id: 999999,
		name: `solidcraft-${snapshot.tag.slice(1)}-new-platform.pkg`,
		size: 100,
		browser_download_url: `https://github.com/tangency-labs/solidcraft/releases/download/${snapshot.tag}/new.pkg`,
		digest: null,
	};
	const release = normalizeRelease(
		{ ...input, assets: [...assets, extra] },
		snapshot.observedAt,
		true,
	);
	assert.equal(release.artifacts.length, 22);
	assert.equal(release.checksums, null);
	assert.equal(release.verification, "github-api-validated");
	assert.throws(
		() =>
			normalizeRelease(
				{ ...input, assets: [...assets, extra] },
				snapshot.observedAt,
			),
		/Unmapped/,
	);
	assert.throws(
		() => normalizeRelease(input, snapshot.observedAt),
		/missing SHA256SUMS/,
	);
	assert.throws(() =>
		normalizeRelease(
			{
				...input,
				assets: [
					{
						...assets[0],
						browser_download_url: "https://evil.example/app.exe",
					},
				],
			},
			snapshot.observedAt,
			true,
		),
	);
});
