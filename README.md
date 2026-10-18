<p align="center">
  <img src="apps/frontend/solidcraft-landing/public/brand/solidcraft.svg" width="64" height="64" alt="SolidCraft" />
</p>

<h1 align="center">SolidCraft Website</h1>

<p align="center">
  Product information, downloads, and development progress for SolidCraft.<br />
  Built with Astro, React, TypeScript, Tailwind CSS, and Zustand.
</p>

<p align="center">
  <a href="https://solidcraft.io">Website</a> ·
  <a href="https://docs.solidcraft.io">Documentation</a> ·
  <a href="https://github.com/tangency-labs/solidcraft">SolidCraft</a> ·
  <a href="https://github.com/tangency-labs/solidcore">SolidCore</a>
</p>

[![Website checks](https://github.com/tangency-labs/website/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/tangency-labs/website/actions/workflows/ci.yml)

## Overview

This repository contains the SolidCraft website: product pages, modeling demonstrations, desktop downloads, MCP setup, and live SolidCore progress reports.

Astro generates static pages. React islands provide interactive navigation, download selection, command copying, and progress reports, with shared client state managed by Zustand. The browser application and documentation are maintained separately.

[Development](#development) · [Project Structure](#project-structure) · [Live Data](#live-data) · [Quality Checks](#quality-checks) · [Deployment](#deployment) · [License](#license)

## Development

### Requirements

| Tool | Version |
| --- | --- |
| Node.js | `24.10.0` |
| pnpm | `12.10.1` |

### Getting Started

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open [localhost:4347](http://localhost:4347). Run commands from the repository root; they forward to the application package in `apps/frontend/solidcraft-landing/`.

## Project Structure

```text
apps/frontend/solidcraft-landing/
├── public/          # Branding, recordings, licenses, and redirects
├── scripts/         # Content validation, output checks, and release tooling
├── src/
│   ├── components/  # Astro components and interactive React islands
│   ├── data/        # Site links, release metadata, and asset provenance
│   ├── layouts/     # Shared page layout and metadata
│   ├── lib/         # Release and progress clients, validation, and utilities
│   ├── pages/       # Product pages and SolidCore progress routes
│   ├── stores/      # Zustand state
│   └── styles/      # Shared styles and progress presentation
└── tests/           # Unit tests, browser tests, and fixtures
```

The root contains the pnpm workspace, shared lockfile, and CI workflow. Keep dependency versions exact and commit lockfile changes with package changes.

## Live Data

### Downloads

Downloads fetch the latest stable release from GitHub in the browser. Validated metadata is shared between download controls, cached for five minutes, and refreshed while the page is open. New releases appear without rebuilding. Checked-in release metadata supplies working package links when JavaScript or GitHub is unavailable.

Homepage download buttons identify the visitor’s desktop platform. The download page starts one matching download after checking release metadata and keeps the complete package list available. Unrecognized systems or architectures use manual selection. Releases come from `tangency-labs/solidcraft` and require validated release URLs.

### SolidCore Progress

The progress dashboard loads upstream reports directly at `/solidcore/progress/`, including unit details, issues, and surface-intersection results. Reports refresh every five minutes while visible and retain their source revision and generation time. Failed requests show an error with Retry; there is no saved or stale-data fallback. Remote HTML is sanitized before rendering, and upstream scripts are never executed.

Builds do not fetch release or progress data. Public requests happen in the browser without credentials or API tokens.

### Updating Release Metadata

To prepare an update to the checked-in release metadata:

```sh
pnpm releases:refresh vX.Y.Z
```

This writes `apps/frontend/solidcraft-landing/src/data/release-candidate.json` without replacing `releases.json`. Review the candidate before updating the checked-in metadata.

## Quality Checks

```sh
pnpm check
pnpm typecheck
pnpm test:unit
pnpm build
pnpm --filter @solidcraft/solidcraft-landing exec playwright install chromium
pnpm test:e2e
pnpm test:dev
```

### Formatting and Linting

| Command | Purpose |
| --- | --- |
| `pnpm check` | Check formatting, lint rules, and imports |
| `pnpm check:fix` | Apply formatting and safe lint fixes |
| `pnpm format` | Format supported source files |
| `pnpm format:check` | Check formatting without modifying files |
| `pnpm lint` | Run lint checks only |

Biome checks TypeScript, React, Astro, CSS, and JSON. Generated files, public assets, and upstream test fixtures are excluded. CI runs `biome ci` from the repository root before type checking.

### Build and Browser Tests

The build validates release data, media hashes, licenses, local links, page metadata, and static-host file limits. It also generates security headers, including the Content Security Policy.

Browser tests cover responsive layouts, accessibility, navigation, downloads, video playback, clipboard behavior, and live-data success and failure states. They use a static server on port **4322** with the generated headers applied. The development regression uses port **4348** and checks hydration during a concurrent production build. Neither test server uses the development port, **4347**.

## Deployment

```sh
pnpm build
pnpm preview
```

The output is `apps/frontend/solidcraft-landing/dist/`. Preview runs at [localhost:4347](http://localhost:4347). Hosting requires only static files; there is no server runtime or database.

### Cloudflare Pages

| Setting | Value |
| --- | --- |
| Root directory | `apps/frontend/solidcraft-landing` |
| Build command | `pnpm build` |
| Output directory | `dist` |
| Node.js version | `24.10.0` |

The application-level `.node-version` pins the build runtime. Any hosting `NODE_VERSION` override must match it. Deploy the generated `_headers` and `_redirects` with the rest of the output.

The header’s `/discord` link uses a temporary redirect to `discordInvite` in `src/data/site.ts`. Change that invite and rebuild when the community invite changes; the shared website URL stays the same.

Search indexing is currently disabled through page metadata, response headers, and `robots.txt`.

## License

Website code is licensed under [MIT](LICENSE). Product media, branding, fonts, and dependencies retain their respective licenses. Attribution and license files are included in [`public/notices/`](apps/frontend/solidcraft-landing/public/notices/), with source revisions and media hashes recorded in `src/data/`.
