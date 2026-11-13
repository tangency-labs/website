// Serves solidcraft.io/leaderboard/* from the leaderboard repo's GitHub Pages
// (https://github.com/tangency-labs/leaderboard). Cloudflare Pages Function.

const UPSTREAM = "https://tangency-labs.github.io/leaderboard";

export async function onRequest({ request }) {
	if (request.method !== "GET" && request.method !== "HEAD") {
		return new Response("Method not allowed", {
			status: 405,
			headers: { allow: "GET, HEAD" },
		});
	}
	const url = new URL(request.url);
	const rest = url.pathname.slice("/leaderboard".length);
	if (rest === "")
		return Response.redirect(`${url.origin}/leaderboard/${url.search}`, 301);
	if (rest.includes("..")) return new Response("Not found", { status: 404 });

	const upstream = await fetch(`${UPSTREAM}${rest}`, {
		method: request.method,
		cf: { cacheTtl: 60, cacheEverything: true },
	});
	const headers = new Headers();
	for (const name of ["content-type", "etag", "last-modified"]) {
		const value = upstream.headers.get(name);
		if (value) headers.set(name, value);
	}
	headers.set("cache-control", "public, max-age=60");
	headers.set("x-content-type-options", "nosniff");
	return new Response(upstream.body, { status: upstream.status, headers });
}
