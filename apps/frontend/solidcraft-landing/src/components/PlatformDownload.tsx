import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "zustand";
import {
	type Architecture,
	detectDownloadSystem,
	formatBytes,
	type Platform,
	recommendArtifact,
} from "../lib/download-utils";
import { useRelease } from "../lib/use-release";
import { downloadStore } from "../stores/downloads";

export default function PlatformDownload() {
	const { artifacts, notes } = useRelease();
	const filters = useStore(downloadStore, (state) => state.filters);
	const [detected, setDetected] = useState<{
		platform: Platform | null;
		architecture: Architecture | "";
	} | null>(null);
	useEffect(() => {
		let active = true;
		void detectDownloadSystem(navigator).then((system) => {
			if (active) setDetected(system);
		});
		return () => {
			active = false;
		};
	}, []);
	const platform = (filters.platform ||
		detected?.platform ||
		null) as Platform | null;
	const architecture =
		filters.architecture ||
		(platform === detected?.platform ? detected?.architecture : "") ||
		"";
	const artifact = recommendArtifact(
		artifacts,
		platform,
		architecture,
		filters.kind,
	);
	// The file itself is never linked from this site: the release page is, so
	// the download starts from github.com.
	const href = notes;
	const description = artifact
		? `${platform} ${artifact.architecture}: pick the ${artifact.kind} (${formatBytes(artifact.bytes)}) on the release page.`
		: platform
			? `Pick the package for ${platform} on the release page.`
			: "Pick your platform's package on the release page.";
	return (
		<div className="platform-download" data-platform-download>
			<a className="button primary" href={href}>
				<Download aria-hidden="true" size={18} strokeWidth={1.5} />
				<span data-download-label>
					{platform
						? `Get SolidCraft for ${platform}`
						: "Get SolidCraft for your platform"}
				</span>
			</a>
			<p className="small muted" data-download-description>
				{description}
			</p>
			<p className="small muted" data-auto-download-status role="status">
				This opens the release on GitHub, where you choose the file to download.
				Other platforms and formats are listed below.
			</p>
		</div>
	);
}
