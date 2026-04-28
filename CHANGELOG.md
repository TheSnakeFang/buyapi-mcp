# Changelog

All notable changes to this project will be documented in this file.

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
- Hosted MCP endpoint now exposes `get-vendor-evidence` and `find-similar-stacks`.
- README clarification for hosted MCP vs local stdio MCP vs human-facing CLI commands.
- README sections for decision prompts, vendor-ID tips, CLI reference, troubleshooting, and data disclaimer.

### Fixed

- Publish metadata now lists the `buyapi` binary first so `npx buyapi` resolves the canonical command.

## [0.2.0] - 2026-04-21

### Added

- `compare-vendors` tool -- structured head-to-head vendor comparisons.
- `estimate-cost` tool -- deterministic cost estimates from explicit workload inputs.
- Structured `recommend-stack` output with decision matrix, assumptions, unknowns, alternatives, and sources.
- Optional category support and unknown-corpus fallback for `resolve-vendor`.
- Source provenance rendering for vendor details.

## [0.1.0] - 2026-04-15

Initial public release of the BuyAPI MCP server.

### Added

- `resolve-vendor` tool -- search vendors by category with relevance ranking
- `get-vendor-details` tool -- full vendor profiles with pricing, free tier limits, and comparisons
- `recommend-stack` tool -- complete stack recommendations with cost projections at 100/1K/10K users
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
