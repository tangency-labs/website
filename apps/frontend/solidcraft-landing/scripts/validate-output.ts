import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { routes, site } from "../src/data/site.ts";
import {
	progressPages,
	progressRedirects,
} from "../src/lib/progress-routes.ts";

const files: string[] = [];
async function walk(dir: string) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) await walk(path);
		else files.push(path);
	}
}
await walk("dist");
if (files.some((file) => /(?:_worker\.js|server\/|functions\/)/.test(file)))
	throw new Error("Unexpected server runtime.");
if (files.length >= 20_000)
	throw new Error("Cloudflare Pages file-count budget exceeded.");
for (const file of files)
	if ((await stat(file)).size > 25 * 1024 * 1024)
		throw new Error(`Oversized Pages asset: ${file}`);
for (const route of [...routes, ...progressPages.map((page) => page.path)]) {
	const html = await readFile(`dist${route}index.html`, "utf8");
	if ((html.match(/<h1(?:\s|>)/g) || []).length !== 1)
		throw new Error(`Expected one h1: ${route}`);
	if (
		!html.includes("noindex, nofollow") ||
		!html.includes(`href="https://solidcraft.io${route}"`)
	)
		throw new Error(`Missing canonical or preview noindex: ${route}`);
	if (!html.includes("/disclaimer/") || !html.includes("/privacy/"))
		throw new Error(`Missing legal navigation: ${route}`);
}
await stat("dist/404.html");
const inlineScriptHashes = new Set<string>();
let links = 0;
for (const file of files.filter((file) => file.endsWith(".html"))) {
	const html = await readFile(file, "utf8");
	for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
		if (!/\bsrc\s*=/.test(match[1]) && match[2])
			inlineScriptHashes.add(
				`'sha256-${createHash("sha256").update(match[2]).digest("base64")}'`,
			);
	}
	for (const match of html.matchAll(/\b(?:href|src|poster)="([^"]+)"/g)) {
		const value = match[1].replaceAll("&amp;", "&");
		if (/^(?:https:|data:|mailto:|#)/.test(value)) continue;
		if (value.startsWith("//") || value.startsWith("javascript:"))
			throw new Error(`Unsafe link: ${file}: ${value}`);
		const pageUrl = `https://solidcraft.io/${file.slice(5).replace(/index\.html$/, "")}`;
		const resolved = new URL(value, pageUrl);
		const path = decodeURIComponent(resolved.pathname);
		const candidates = [
			`dist${path}`,
			join("dist", path, "index.html"),
			`dist${path}.html`,
		];
		if (
			!(
				await Promise.all(
					candidates.map(async (p) => {
						try {
							return (await stat(p)).isFile();
						} catch {
							return false;
						}
					}),
				)
			).some(Boolean)
		)
			throw new Error(`Broken local link: ${file}: ${value}`);
		links++;
	}
}
const csp = `default-src 'self'; script-src 'self' ${[...inlineScriptHashes].sort().join(" ")}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self'; connect-src 'self' https://api.github.com https://tangency-labs.github.io; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'`;
await writeFile(
	"dist/_headers",
	`/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  X-Robots-Tag: noindex, nofollow\n  Content-Security-Policy: ${csp}\n\n/_astro/*\n  Cache-Control: public, max-age=31536000, immutable\n`,
);
console.log(
	`Static output valid: ${files.length} files, ${links} local references, ${inlineScriptHashes.size} CSP script hashes. Preview indexing disabled.`,
);

await writeFile(
	"dist/_redirects",
	(await readFile("public/_redirects", "utf8")) +
		`${site.discord} ${site.discordInvite} 302\n${site.discord}/ ${site.discordInvite} 302\n` +
		progressRedirects
			.map((redirect) => `${redirect.from} ${redirect.to} 301`)
			.join("\n") +
		"\n",
);
