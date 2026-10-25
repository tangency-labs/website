import { site } from "../data/site.ts";

export function homeStructuredData(version: string) {
	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "Organization",
				"@id": `${site.url}/#organization`,
				name: "Tangency Labs",
				url: site.url,
				logo: `${site.url}/brand/solidcraft-512.png`,
				sameAs: [site.repo, site.discordInvite],
			},
			{
				"@type": "SoftwareApplication",
				"@id": `${site.url}/#software`,
				name: "SolidCraft",
				applicationCategory: "DesignApplication",
				operatingSystem: "Windows, macOS, Linux, Web",
				url: `${site.url}/`,
				downloadUrl: `${site.url}/download/`,
				softwareVersion: version.replace(/^v/, ""),
				license: [
					"https://spdx.org/licenses/MIT.html",
					"https://spdx.org/licenses/Apache-2.0.html",
				],
				offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
				publisher: { "@id": `${site.url}/#organization` },
			},
			{
				"@type": "WebSite",
				"@id": `${site.url}/#website`,
				name: "SolidCraft",
				alternateName: "SolidCraft CAD",
				url: `${site.url}/`,
				publisher: { "@id": `${site.url}/#organization` },
			},
		],
	};
}
