import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { site } from "./src/data/site.ts";
import { progressRedirects } from "./src/lib/progress-routes.ts";

export default defineConfig({
	site: "https://solidcraft.io",
	output: "static",
	trailingSlash: "always",
	redirects: {
		[site.discord]: { status: 302, destination: site.discordInvite },
	},
	integrations: [
		react(),
		sitemap({ filter: (url) => !/\/404(?:\.html|\/)$/.test(url) }),
	],
	vite: {
		plugins: [
			tailwindcss(),
			{
				name: "progress-legacy-links",
				configureServer(server) {
					const redirects = new Map(
						progressRedirects.map(({ from, to }) => [from, to]),
					);
					server.middlewares.use((request, response, next) => {
						const url = new URL(request.url || "/", "http://localhost");
						const target = redirects.get(url.pathname);
						if (!target) return next();
						response.writeHead(301, { Location: target + url.search });
						response.end();
					});
				},
			},
			{
				name: "separate-vite-mode-caches",
				// Astro checks/builds can run while the dev server is open. Their optimized
				// production React modules must never replace the development JSX runtime.
				config(_config, { mode }) {
					return { cacheDir: `node_modules/.vite/${mode}` };
				},
			},
		],
	},
});
