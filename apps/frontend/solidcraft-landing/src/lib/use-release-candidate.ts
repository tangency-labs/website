import { useEffect, useState } from "react";
import {
	pickReleaseCandidate,
	type ReleaseCandidate,
	releaseListEndpoint,
} from "./release-candidate";
import { useRelease } from "./use-release";

export type ReleaseCandidateState =
	| { status: "loading" | "failed" | "none" }
	| { status: "ready"; candidate: ReleaseCandidate };

// One request per page, shared by every button that shows the release candidate.
let releases: Promise<unknown> | undefined;
function fetchReleases() {
	releases ??= fetch(releaseListEndpoint, {
		headers: { Accept: "application/vnd.github+json" },
		credentials: "omit",
		signal: AbortSignal.timeout(10_000),
	}).then((response) => {
		if (!response.ok) throw new Error(`GitHub: ${response.status}`);
		return response.json();
	});
	return releases;
}

export function useReleaseCandidate(enabled = true): ReleaseCandidateState {
	const { tag: stableTag } = useRelease();
	const [state, setState] = useState<ReleaseCandidateState>({
		status: "loading",
	});
	useEffect(() => {
		if (!enabled) return;
		let current = true;
		(async () => {
			try {
				const candidate = pickReleaseCandidate(
					(await fetchReleases()) as Parameters<typeof pickReleaseCandidate>[0],
					stableTag,
				);
				if (current)
					setState(
						candidate ? { status: "ready", candidate } : { status: "none" },
					);
			} catch {
				if (current) setState({ status: "failed" });
			}
		})();
		return () => {
			current = false;
		};
	}, [enabled, stableTag]);
	return state;
}
