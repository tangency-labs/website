import { z } from "zod";
import { type Artifact, snapshotSchema } from "./releases.ts";

const githubRelease = z.object({
	id: z.number().int().positive(),
	tag_name: z.string(),
	draft: z.boolean(),
	prerelease: z.boolean(),
	published_at: z.iso.datetime(),
	html_url: z.url(),
	assets: z.array(
		z.object({
			id: z.number().int().positive(),
			name: z.string(),
			size: z.number().int().positive(),
			browser_download_url: z.url(),
			digest: z.string().nullable().optional(),
		}),
	),
});

// Exact, reviewed distribution names. New package roles require a reviewed mapping.
export function classifyArtifact(
	name: string,
	version: string,
): Pick<Artifact, "platform" | "architecture" | "kind" | "cli"> | null {
	if (name === `solidcraft-${version}-macos-universal.dmg`)
		return {
			platform: "macOS",
			architecture: "Universal",
			kind: "Disk image",
			cli: "unknown",
		};
	if (name === `solidcraft-cli-${version}-macos-universal.zip`)
		return {
			platform: "macOS",
			architecture: "Universal",
			kind: "CLI ZIP",
			cli: "yes",
		};
	if (name === `SolidCraft-${version}-windows-x64.exe`)
		return {
			platform: "Windows",
			architecture: "x64",
			kind: "EXE installer",
			cli: "unknown",
		};
	for (const [upstream, architecture] of [
		["x64", "x64"],
		["arm64", "ARM64"],
		["x86", "x86"],
	] as const) {
		if (name === `solidcraft-${version}-windows-${upstream}.msi`)
			return {
				platform: "Windows",
				architecture,
				kind: "MSI installer",
				cli: "unknown",
			};
		if (name === `solidcraft-${version}-windows-${upstream}-portable.zip`)
			return {
				platform: "Windows",
				architecture,
				kind: "Portable ZIP",
				cli: "unknown",
			};
	}
	for (const [upstream, architecture] of [
		["x86_64", "x64"],
		["aarch64", "ARM64"],
	] as const) {
		for (const [extension, kind] of [
			["AppImage", "AppImage"],
			["deb", "DEB"],
			["rpm", "RPM"],
			["flatpak", "Flatpak"],
			["snap", "Snap"],
			["tar.gz", "TAR archive"],
		] as const) {
			if (name === `solidcraft-${version}-linux-${upstream}.${extension}`)
				return { platform: "Linux", architecture, kind, cli: "unknown" };
		}
	}
	if (name === `solidcraft-${version}-freebsd-x86_64.tar.gz`)
		return {
			platform: "FreeBSD",
			architecture: "x64",
			kind: "TAR archive",
			cli: "unknown",
		};
	return null;
}

export function normalizeRelease(
	input: unknown,
	observedAt: string,
	live = false,
) {
	const release = githubRelease.parse(input);
	if (release.draft || release.prerelease)
		throw new Error("Only a non-draft, non-prerelease tag can be proposed.");
	if (!/^v\d+\.\d+\.\d+$/.test(release.tag_name))
		throw new Error("Unrecognized release version.");
	const version = release.tag_name.slice(1);
	const artifacts: Artifact[] = [];
	for (const asset of release.assets) {
		const classification = classifyArtifact(asset.name, version);
		if (classification)
			artifacts.push({
				id: asset.id,
				name: asset.name,
				...classification,
				bytes: asset.size,
				url: asset.browser_download_url,
				digest: asset.digest || null,
				signing: "unknown",
			});
		else if (
			!live &&
			asset.name.includes(`-${version}-`) &&
			!asset.name.endsWith(".zsync") &&
			!asset.name.startsWith("solidcraft-web-")
		)
			throw new Error(`Unmapped versioned asset: ${asset.name}`);
	}
	const checksums = release.assets.find((a) => a.name === "SHA256SUMS.txt");
	if (!checksums && !live)
		throw new Error("Release is missing SHA256SUMS.txt.");
	const platformOrder = ["Windows", "macOS", "Linux", "FreeBSD"];
	const architectureOrder = ["x64", "ARM64", "x86", "Universal"];
	const kindOrder = [
		"MSI installer",
		"Portable ZIP",
		"EXE installer",
		"Disk image",
		"AppImage",
		"DEB",
		"RPM",
		"Flatpak",
		"Snap",
		"TAR archive",
		"CLI ZIP",
	];
	artifacts.sort(
		(a, b) =>
			platformOrder.indexOf(a.platform) - platformOrder.indexOf(b.platform) ||
			architectureOrder.indexOf(a.architecture) -
				architectureOrder.indexOf(b.architecture) ||
			kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) ||
			a.name.localeCompare(b.name, "en"),
	);
	return snapshotSchema.parse({
		schemaVersion: 1,
		repository: "tangency-labs/solidcraft",
		observedAt,
		tag: release.tag_name,
		releaseId: release.id,
		publishedAt: release.published_at,
		channel: "release",
		notes: release.html_url,
		checksums: checksums?.browser_download_url ?? null,
		verification: live ? "github-api-validated" : "upstream-metadata-reviewed",
		artifacts,
	});
}
