import { type Artifact, classifyArtifact } from "./normalize-release.ts";
import { isReleaseAssetUrl } from "./releases.ts";

export const releaseListEndpoint =
	"https://api.github.com/repos/tangency-labs/solidcraft/releases?per_page=30";

export interface ReleaseCandidate {
	tag: string;
	notes: string;
	artifacts: Artifact[];
}

interface GithubAsset {
	id: number;
	name: string;
	size: number;
	browser_download_url: string;
	digest?: string | null;
}
interface GithubRelease {
	tag_name: string;
	draft: boolean;
	prerelease: boolean;
	html_url: string;
	assets: GithubAsset[];
}

function versionParts(tag: string): number[] | null {
	const match = tag.match(/^v(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/);
	if (!match) return null;
	// A final release sorts after every release candidate of the same version.
	return [
		Number(match[1]),
		Number(match[2]),
		Number(match[3]),
		match[4] === undefined ? Number.POSITIVE_INFINITY : Number(match[4]),
	];
}

function compareTags(a: number[], b: number[]) {
	for (let i = 0; i < 4; i += 1) if (a[i] !== b[i]) return a[i] - b[i];
	return 0;
}

// The newest published release candidate, only while it is newer than the stable release.
export function pickReleaseCandidate(
	releases: GithubRelease[],
	stableTag: string,
): ReleaseCandidate | null {
	const stable = versionParts(stableTag);
	if (!stable) return null;
	let newest: GithubRelease | null = null;
	let newestParts: number[] | null = null;
	for (const release of releases) {
		if (release.draft || !release.prerelease) continue;
		if (!/-rc\.\d+$/.test(release.tag_name)) continue;
		const parts = versionParts(release.tag_name);
		if (!parts || compareTags(parts, stable) <= 0) continue;
		if (!newestParts || compareTags(parts, newestParts) > 0) {
			newest = release;
			newestParts = parts;
		}
	}
	if (!newest) return null;
	const { tag_name: tag } = newest;
	const version = tag.slice(1);
	const artifacts: Artifact[] = [];
	for (const asset of newest.assets) {
		const classification = classifyArtifact(asset.name, version);
		if (classification && isReleaseAssetUrl(asset.browser_download_url, tag))
			artifacts.push({
				id: asset.id,
				name: asset.name,
				...classification,
				bytes: asset.size,
				url: asset.browser_download_url,
				digest: asset.digest || null,
				signing: "unknown",
			});
	}
	return artifacts.length > 0
		? { tag, notes: newest.html_url, artifacts }
		: null;
}
