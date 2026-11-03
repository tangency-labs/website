import { site } from "../data/site";
import { formatBytes, kindLabel, platforms } from "../lib/download-utils";
import { useReleaseCandidate } from "../lib/use-release-candidate";

export default function ReleaseCandidateDownloads() {
	const state = useReleaseCandidate();

	if (state.status === "none")
		return <p className="small muted">No release candidate right now.</p>;
	if (state.status !== "ready")
		return (
			<p className="small muted">
				{state.status === "failed" ? "The list could not be loaded. " : ""}
				Find release candidates on{" "}
				<a className="text-link" href={site.releases}>
					GitHub Releases
				</a>
				.
			</p>
		);
	const { candidate } = state;
	return (
		<>
			<p className="small">
				<span className="badge">{candidate.tag}</span>{" "}
				<a href={candidate.notes}>Release notes and all files ↗</a>
			</p>
			{platforms.map((platform) => {
				const files = candidate.artifacts.filter(
					(a) => a.platform === platform,
				);
				if (files.length === 0) return null;
				return (
					<details data-rc-platform={platform} key={platform} open>
						<summary>{platform}</summary>
						<ul>
							{files.map((a) => (
								<li key={a.id}>
									<a href={a.url}>
										{a.architecture} {kindLabel(a.kind)}
									</a>{" "}
									<span className="muted">{formatBytes(a.bytes)}</span>
								</li>
							))}
						</ul>
					</details>
				);
			})}
		</>
	);
}
