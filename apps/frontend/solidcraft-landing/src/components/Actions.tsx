import { Download, Globe } from "lucide-react";
import { useEffect, useState } from "react";
import { site } from "../data/site";
import {
	type Architecture,
	detectDownloadSystem,
	homeDownload,
	type Platform,
} from "../lib/download-utils";
import { useRelease } from "../lib/use-release";

// `direct` makes the main button a plain link to the installer asset for the
// visitor's system on github.com (an attachment, so the browser downloads the
// file and stays on this page). The system is read after render. Unknown
// systems link to /download/. The file only downloads when the visitor clicks.
export default function Actions({
	compact = false,
	direct = false,
}: {
	compact?: boolean;
	direct?: boolean;
}) {
	const release = useRelease();
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
	const artifact = direct ? homeDownload(release.artifacts, system) : null;
	const label = compact
		? "Download"
		: platform
			? `Download for ${platform}`
			: "Download SolidCraft";
	return (
		<div className={`actions${compact ? " compact" : ""}`}>
			<div className="primary-action">
				<a className="button primary" href={artifact?.url ?? "/download/"}>
					<Download aria-hidden="true" size={18} strokeWidth={1.5} />
					{label}
				</a>
				{direct && (
					<a className="small other-downloads" href="/download/">
						Other downloads
					</a>
				)}
			</div>
			<a className="button secondary" href={site.app}>
				<Globe aria-hidden="true" size={18} strokeWidth={1.5} />
				Try in your browser
			</a>
		</div>
	);
}
