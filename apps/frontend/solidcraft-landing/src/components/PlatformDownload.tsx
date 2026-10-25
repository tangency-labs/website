import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { site } from "../data/site";
import {
	type Architecture,
	detectDownloadSystem,
	formatBytes,
	kindLabel,
	type Platform,
	recommendArtifact,
} from "../lib/download-utils";
import { useRelease } from "../lib/use-release";
import { downloadStore } from "../stores/downloads";

export default function PlatformDownload() {
	const { artifacts } = useRelease();
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
	// A plain link to the asset on github.com; only a click downloads it.
	const href = artifact?.url ?? site.latestRelease;
	const description = artifact
		? `${platform} ${artifact.architecture}: ${kindLabel(artifact.kind)}, ${formatBytes(artifact.bytes)}.`
		: platform
			? `Pick the package for ${platform} from the list below.`
			: "Pick your platform's package from the list below.";
	return (
		<div className="platform-download" data-platform-download>
			<a className="button primary" href={href}>
				<Download aria-hidden="true" size={18} strokeWidth={1.5} />
				<span data-download-label>
					{platform
						? `Download SolidCraft for ${platform}`
						: "Download SolidCraft"}
				</span>
			</a>
			<p className="small muted" data-download-description>
				{description}
			</p>
			<p className="small muted" data-auto-download-status role="status">
				Nothing downloads until you click a link. Other platforms and formats
				are listed below.
			</p>
		</div>
	);
}
