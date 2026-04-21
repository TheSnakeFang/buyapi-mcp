# Changelog

All notable changes to this project will be documented in this file.

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
- Optional API key support for higher rate limits
- Vendor coverage across 5 categories:
  - Database (Supabase, Convex, Neon, PlanetScale, Firebase)
  - Auth (Supabase Auth, Clerk, Auth0, Auth.js)
  - Hosting (Vercel, Netlify, Railway, Fly.io)
  - Payments (Stripe, LemonSqueezy, Paddle, RevenueCat)
  - Email (Resend, SendGrid, Postmark, Amazon SES)
- Setup docs for Claude Code, Cursor, VS Code (Copilot), and Windsurf
