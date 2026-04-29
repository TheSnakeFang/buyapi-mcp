# Changelog

All notable changes to this project will be documented in this file.

## [0.6.5] - 2026-04-28

### Changed

- Rename MCP tools into a dot-notation tree for registry navigability.
- Add MCP tool annotations declaring BuyAPI tools read-only, non-destructive, idempotent, and open-world.

## [0.6.4] - 2026-04-28

### Fixed

- Match official MCP Registry server naming to the exact GitHub owner casing required for publish permissions.

## [0.6.3] - 2026-04-28

### Added

- Official MCP Registry metadata via `server.json`.
- `mcpName` package metadata required by the official MCP Registry.

## [0.6.2] - 2026-04-28

### Added

- Interactive setup now explains whether hosted MCP or local stdio MCP was configured, including the local `npx -y buyapi mcp` command.

## [0.6.1] - 2026-04-28

### Added

- Bare `buyapi` / `npx buyapi` now runs an interactive setup flow in TTY terminals.
- Setup guidance now includes global install instructions for users who do not want to type `npx`.

### Fixed

- Browser login callback now closes the local callback server more aggressively after receiving the API key.

## [0.6.0] - 2026-04-28

### Added

- Scanner now includes unknown top-level npm package candidates in verbose local output.
- Authenticated `buyapi scan --sync` sends unknown package candidates to BuyAPI for admin review, alongside known detected tools.
- Sync success output reports how many unknown package candidates were queued.

## [0.5.1] - 2026-04-28

### Fixed

- CLI user-facing errors now print concise messages instead of stack traces.

## [0.5.0] - 2026-04-28

### Added

- `buyapi setup <client>` writes MCP config for Claude Code, Cursor, Codex, Windsurf, and Cline.
- `buyapi setup <client> --local` writes local stdio config using `npx -y buyapi mcp`.
- Browser-based `buyapi login` with local callback and dashboard-generated API key.
- `buyapi whoami` for checking the active local key.
- Scanner flags: `--dry-run`, `--verbose`, `--all`, `--yes`, `--stack`, and `--stack-name`.

### Changed

- `buyapi scan --sync` now asks before uploading unless `--yes` is passed.
- Scanner output now includes detection methods and primary/supporting status in verbose mode.

## [0.4.0] - 2026-04-27

### Added

- `buyapi setup` and default `buyapi` setup guidance for human installs.
- `buyapi login <api-key>` and `buyapi logout` for storing CLI credentials.
- `buyapi scan --sync` for saving detected stack tools to the BuyAPI dashboard.

### Changed

- Local MCP stdio now uses the explicit `buyapi mcp` command in docs and help text.

## [0.3.2] - 2026-04-27

### Changed

- Deprecated the old `buyapi-mcp` npm package and removed compatibility wording from the canonical CLI help text.

## [0.3.1] - 2026-04-27

### Added

- Canonical `buyapi` npm package name with `buyapi` and `buyapi-mcp` binaries.
- Explicit `buyapi mcp` and `buyapi --version` commands.
- Local-only `scan` command for detecting known stack tools from project files.
- Read-only CLI commands: `search`, `details`, `recommend`, `compare`, and `cost`.
- Hosted MCP endpoint now exposes `vendors.evidence` and `stacks.findSimilar`.
- README clarification for hosted MCP vs local stdio MCP vs human-facing CLI commands.
- README sections for decision prompts, vendor-ID tips, CLI reference, troubleshooting, and data disclaimer.

### Fixed

- Publish metadata now lists the `buyapi` binary first so `npx buyapi` resolves the canonical command.

## [0.2.0] - 2026-04-21

### Added

- `vendors.compare` tool -- structured head-to-head vendor comparisons.
- `vendors.estimateCost` tool -- deterministic cost estimates from explicit workload inputs.
- Structured `stacks.recommend` output with decision matrix, assumptions, unknowns, alternatives, and sources.
- Optional category support and unknown-corpus fallback for `vendors.resolve`.
- Source provenance rendering for vendor details.

## [0.1.0] - 2026-04-15

Initial public release of the BuyAPI MCP server.

### Added

- `vendors.resolve` tool -- search vendors by category with relevance ranking
- `vendors.details` tool -- full vendor profiles with pricing, free tier limits, and comparisons
- `stacks.recommend` tool -- complete stack recommendations with cost projections at 100/1K/10K users
- Local stdio transport via `npx buyapi-mcp`
- Remote MCP endpoint at `https://buyapi.ai/api/mcp`
- Optional API key forwarding hook for future keyed backend access
- Vendor coverage across 5 categories:
  - Database (Supabase, Convex, Neon, PlanetScale, Firebase)
  - Auth (Supabase Auth, Clerk, Auth0, Auth.js)
  - Hosting (Vercel, Netlify, Railway, Fly.io)
  - Payments (Stripe, LemonSqueezy, Paddle, RevenueCat)
  - Email (Resend, SendGrid, Postmark, Amazon SES)
- Setup docs for Claude Code, Cursor, VS Code (Copilot), and Windsurf
