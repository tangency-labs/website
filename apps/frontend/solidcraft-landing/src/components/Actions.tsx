import { AppWindow, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { site } from "../data/site";
import { detectPlatform, type Platform } from "../lib/download-utils";

// `github` sends the main button to the Download section of the project README,
// which links the files directly. It is a plain link, never a file download, so
// nothing downloads from this site.
export default function Actions({
	compact = false,
	github = false,
}: {
	compact?: boolean;
	github?: boolean;
}) {
	const [platform, setPlatform] = useState<Platform | null>(null);
	useEffect(() => setPlatform(detectPlatform(navigator)), []);
	const label = compact
		? "Download"
		: platform
			? `Download for ${platform}`
			: "Download SolidCraft";
	return (
		<div className={`actions${compact ? " compact" : ""}`}>
			<div className="primary-action">
				<a
					className="button primary"
					href={github ? site.readmeDownload : "/download/"}
				>
					<Download aria-hidden="true" size={18} strokeWidth={1.5} />
					{label}
				</a>
				{github && (
					<a className="small other-downloads" href="/download/">
						Other downloads
					</a>
				)}
			</div>
			<a className="button secondary" href={site.app}>
				<AppWindow aria-hidden="true" size={18} strokeWidth={1.5} />
				Try in your browser
			</a>
		</div>
	);
}
