export const site = {
	name: "SolidCraft",
	url: "https://solidcraft.io",
	app: "https://solidcraft.io/app",
	discord: "/discord",
	discordInvite: "https://discord.gg/FtU4NQNVDH",
	docs: "https://docs.solidcraft.io/",
	repo: "https://github.com/tangency-labs/solidcraft",
	kernel: "https://github.com/tangency-labs/solidcore",
	progress: "https://tangency-labs.github.io/solidcore/",
	releases: "https://github.com/tangency-labs/solidcraft/releases",
} as const;

export const guide = (chapter: string) => `${site.docs}guide/${chapter}.html`;
export const nav = [
	{ label: "Features", href: "/features/" },
	{ label: "MCP", href: "/mcp/" },
	{ label: "SolidCore", href: "/solidcore/" },
	{ label: "Docs", href: site.docs },
	{ label: "GitHub", href: site.repo },
	{ label: "Discord", href: site.discordInvite },
];
export const routes = [
	"/",
	"/features/",
	"/mcp/",
	"/solidcore/",
	"/download/",
	"/showcase/",
	"/showcase/pi-enclosure/",
	"/showcase/selene/",
	"/releases/",
	"/docs/",
	"/disclaimer/",
	"/licenses/",
	"/privacy/",
];
