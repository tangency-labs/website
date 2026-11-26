import { readFile, writeFile } from "node:fs/promises";
import { normalizeRelease } from "../src/lib/normalize-release.ts";
import { snapshotSchema } from "../src/lib/releases.ts";

// `pnpm releases:refresh vX.Y.Z` proposes a specific release for review.
// `pnpm releases:refresh latest` replaces releases.json with the latest
// stable release when it is newer; the release workflow runs it on a schedule.
const target = process.argv[2];
const latest = target === "latest";
if (!target || (!latest && !/^v\d+\.\d+\.\d+$/.test(target)))
	throw new Error(
		"Usage: pnpm releases:refresh vX.Y.Z (writes a candidate for review) or pnpm releases:refresh latest (updates releases.json).",
	);
const path = latest ? "latest" : `tags/${target}`;
const response = await fetch(
	`https://api.github.com/repos/tangency-labs/solidcraft/releases/${path}`,
	{
		headers: {
			Accept: "application/vnd.github+json",
			"User-Agent": "solidcraft-website",
			...(process.env.GITHUB_TOKEN
				? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
				: {}),
		},
	},
);
if (!response.ok)
	throw new Error(
		`GitHub returned ${response.status}; existing snapshot left intact.`,
	);
const snapshot = normalizeRelease(
	await response.json(),
	new Date().toISOString(),
);
const json = `${JSON.stringify(snapshot, null, "\t")}\n`;

if (latest) {
	const current = snapshotSchema.parse(
		JSON.parse(await readFile("src/data/releases.json", "utf8")),
	);
	if (current.releaseId === snapshot.releaseId) {
		console.log(`releases.json already has ${current.tag}.`);
	} else {
		await writeFile("src/data/releases.json", json);
		console.log(
			`Updated releases.json from ${current.tag} to ${snapshot.tag}: ${snapshot.artifacts.length} packages.`,
		);
	}
} else {
	// A refresh proposes metadata. It never overwrites the input used by builds.
	await writeFile("src/data/release-candidate.json", json, { flag: "wx" });
	console.log(
		`Proposed ${snapshot.tag}: ${snapshot.artifacts.length} packages. Review release-candidate.json and signing/CLI facts before replacing releases.json.`,
	);
}
