// Serves the release candidate and latest-build web apps on solidcraft.io. The files live on
// docs.solidcraft.io because the app's wasm is larger than Cloudflare Pages allows for a static
// file. `_routes.json` sends only these two paths here; the rest of the site never runs this.
const ORIGIN = "https://docs.solidcraft.io";
const CHANNEL = /^\/(app-rc|app-edge)(\/.*)?$/;

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const channel = url.pathname.match(CHANNEL);
		if (!channel) return env.ASSETS.fetch(request);
		if (request.method !== "GET" && request.method !== "HEAD") {
			return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
		}
		if (!channel[2]) {
			return Response.redirect(`${url.origin}${url.pathname}/${url.search}`, 301);
		}
		const upstream = await fetch(`${ORIGIN}${url.pathname}${url.search}`, {
			method: request.method,
			headers: request.headers,
			redirect: "manual",
		});
		const response = new Response(upstream.body, upstream);
		response.headers.set("X-Robots-Tag", "noindex");
		const location = response.headers.get("Location");
		if (location?.startsWith(`${ORIGIN}/`)) {
			response.headers.set("Location", `${url.origin}${location.slice(ORIGIN.length)}`);
		}
		return response;
	},
};
