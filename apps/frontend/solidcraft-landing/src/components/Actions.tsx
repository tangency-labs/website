import { AppWindow, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { site } from "../data/site";
import {
	type Architecture,
	detectDownloadSystem,
	type Platform,
	recommendArtifact,
} from "../lib/download-utils";
import { releaseStore } from "../lib/release-client";
import { useRelease } from "../lib/use-release";

// The one package the home button downloads for each detected system. Anything
// else goes to the full list on /download/.
const direct: Record<string, { architecture: Architecture; kind: string }> = {
	Windows: { architecture: "x64", kind: "MSI installer" },
	macOS: { architecture: "Universal", kind: "Disk image" },
	Linux: { architecture: "x64", kind: "AppImage" },
};

export default function Actions({ compact = false }: { compact?: boolean }) {
	const release = useRelease();
	const live = useStore(
		releaseStore,
		(state) =>
			state.ready &&
			!state.unavailable &&
			state.release.verification === "github-api-validated",
	);
	const [system, setSystem] = useState<{
		platform: Platform | null;
		architecture: Architecture | "";
	} | null>(null);
	useEffect(() => {
		let active = true;
		void detectDownloadSystem(navigator).then((detected) => {
			if (active) setSystem(detected);
		});
		return () => {
			active = false;
		};
	}, []);
	const platform = system?.platform ?? null;
	const wanted = platform ? direct[platform] : undefined;
	// A plain link to the asset on github.com, only from validated live release
	// data (never the saved snapshot) and only followed when the visitor clicks.
	const artifact =
		live && wanted && system?.architecture === wanted.architecture
			? recommendArtifact(
					release.artifacts,
					platform,
					wanted.architecture,
					wanted.kind,
				)
			: null;
	const href = artifact?.kind === wanted?.kind ? artifact?.url : undefined;
	return (
		<div className={`actions${compact ? " compact" : ""}`}>
			<a className="button primary" href={href ?? "/download/"}>
				<Download aria-hidden="true" size={18} strokeWidth={1.5} />
				{compact
					? "Download"
					: platform
						? `Download for ${platform}`
						: "Download SolidCraft"}
			</a>
			<a className="button secondary" href={site.app}>
				<AppWindow aria-hidden="true" size={18} strokeWidth={1.5} />
				Try in your browser
			</a>
		</div>
	);
}
