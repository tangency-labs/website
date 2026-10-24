// Browser-safe display/selection helpers. Release validation stays at build time.
export const platforms = ["Windows", "macOS", "Linux", "FreeBSD"] as const;
export const architectures = ["x64", "ARM64", "x86", "Universal"] as const;
export const packageKinds = [
	"EXE installer",
	"MSI installer",
	"Portable ZIP",
	"Disk image",
	"AppImage",
	"DEB",
	"RPM",
	"Flatpak",
	"Snap",
	"TAR archive",
	"CLI ZIP",
] as const;
export interface Artifact {
	id: number;
	name: string;
	platform: (typeof platforms)[number];
	architecture: (typeof architectures)[number];
	kind: (typeof packageKinds)[number];
	bytes: number;
	url: string;
	digest: string | null;
	signing: "unsigned" | "unknown";
	cli: "yes" | "unknown";
}
export function filterArtifacts(
	artifacts: Artifact[],
	filters: { platform: string; architecture: string; kind: string },
) {
	return artifacts.filter(
		(a) =>
			(!filters.platform || a.platform === filters.platform) &&
			(!filters.architecture || a.architecture === filters.architecture) &&
			(!filters.kind || a.kind === filters.kind),
	);
}
export const formatBytes = (bytes: number) =>
	`${(bytes / 1024 / 1024).toFixed(1)} MiB`;

export type Platform = (typeof platforms)[number];
export type Architecture = (typeof architectures)[number];

export function detectArchitecture(identity: string): Architecture | "" {
	if (/aarch64|arm64/i.test(identity)) return "ARM64";
	if (/x86_64|x64|Win64|WOW64|amd64/i.test(identity)) return "x64";
	if (/i[3-6]86|\bx86\b/i.test(identity)) return "x86";
	return "";
}

export async function detectDownloadSystem(browser: Navigator) {
	const platform = detectPlatform(browser);
	let architecture: Architecture | "" =
		platform === "macOS"
			? "Universal"
			: detectArchitecture(`${browser.platform} ${browser.userAgent}`);
	const hints = (
		browser as Navigator & {
			userAgentData?: {
				getHighEntropyValues: (
					keys: string[],
				) => Promise<{ architecture?: string; bitness?: string }>;
			};
		}
	).userAgentData;
	if (platform && platform !== "macOS" && hints) {
		try {
			const values = await Promise.race([
				hints.getHighEntropyValues(["architecture", "bitness"]),
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error("Client hints timed out")), 1000),
				),
			]);
			// Chromium can report an x64 user agent on ARM; client hints take precedence.
			if (values.architecture === "arm")
				architecture = values.bitness === "64" ? "ARM64" : "";
			else if (values.architecture === "x86")
				architecture =
					values.bitness === "64"
						? "x64"
						: values.bitness === "32"
							? "x86"
							: architecture;
		} catch {
			/* Fall back to the architecture exposed in the user agent. */
		}
	}
	return { platform, architecture };
}
export type DownloadChoice = Pick<
	Artifact,
	"platform" | "architecture" | "kind" | "url" | "bytes"
>;

export function detectPlatform({
	userAgent,
	platform,
	maxTouchPoints = 0,
}: {
	userAgent: string;
	platform: string;
	maxTouchPoints?: number;
}): Platform | null {
	if (
		/Android|iPhone|iPad|iPod/i.test(userAgent) ||
		(/Mac/i.test(platform) && maxTouchPoints > 1)
	)
		return null;
	const identity = `${platform} ${userAgent}`;
	if (/Windows|Win32|Win64/i.test(identity)) return "Windows";
	if (/Mac/i.test(identity)) return "macOS";
	if (/FreeBSD/i.test(identity)) return "FreeBSD";
	if (/Linux/i.test(identity)) return "Linux";
	return null;
}

export function recommendArtifact<T extends DownloadChoice>(
	artifacts: T[],
	platform: Platform | null,
	architecture = "",
	kind = "",
): T | null {
	if (!platform) return null;
	// macOS has a reviewed Universal build. Other systems need a detected or selected CPU.
	const selectedArchitecture =
		architecture || (platform === "macOS" ? "Universal" : "");
	if (!selectedArchitecture) return null;
	const candidates = artifacts.filter(
		(a) =>
			a.platform === platform &&
			a.architecture === selectedArchitecture &&
			(kind ? a.kind === kind : a.kind !== "CLI ZIP"),
	);
	const preferred = [
		"Disk image",
		"MSI installer",
		"EXE installer",
		"AppImage",
		"TAR archive",
		"Portable ZIP",
	];
	for (const type of preferred) {
		const artifact = candidates.find((candidate) => candidate.kind === type);
		if (artifact) return artifact;
	}
	return candidates[0] || null;
}
