# BuyAPI Roadmap

Current status and planned features for the BuyAPI MCP server.

## Current (v0.6)

- [x] `resolve-vendor` - search vendors by query/category with relevance ranking and unknown-corpus fallback
- [x] `get-vendor-details` - full vendor profiles with pricing, limits, comparisons, and source provenance
- [x] `compare-vendors` - head-to-head structured comparison between specific vendors
- [x] `estimate-cost` - deterministic cost estimates from explicit workload inputs
- [x] `recommend-stack` - complete stack recommendations with cost projections, decision matrix, assumptions, unknowns, alternatives, and sources
- [x] Local stdio transport (`npx buyapi mcp`)
- [x] API key forwarding in local client
- [x] Public API key creation/validation for higher rate limits
- [x] Local-only `scan` command for package/config-based stack detection
- [x] Browser `buyapi login`, `logout`, `whoami`, and `BUYAPI_API_KEY` support
- [x] `buyapi setup <client>` config installer for Claude Code, Cursor, Codex, Windsurf, and Cline
- [x] Interactive `buyapi` setup for choosing a client, installing config, and optional login
- [x] Account-backed `scan --sync --yes` for private stack sync
- [x] Unknown npm package candidates from authenticated scans queued for BuyAPI admin review

### Covered Categories
- Database (Supabase, Convex, Neon, PlanetScale, Firebase)
- Auth (Supabase Auth, Clerk, Auth0, Auth.js)
- Hosting (Vercel, Netlify, Railway, Fly.io)
- Payments (Stripe, LemonSqueezy, Paddle, RevenueCat)
- Email (Resend, SendGrid, Postmark, Amazon SES)

## Planned

### Near-term
- [x] Remote MCP endpoint (`https://buyapi.ai/api/mcp`) - no local install needed
- [x] npm publish - `buyapi@0.6.0` installable from registry via `npx buyapi`
- [x] compatibility publish - `buyapi-mcp@0.3.1` is deprecated with a rename notice
- [x] GitHub Release - `v0.2.0` release notes published
- [x] Release workflow skips npm publish when a version already exists
- [ ] More vendor profiles with full pricing data
- [x] CI/CD for automated npm releases on tag
- [x] Keep public README aligned with app repo's `docs/CURRENT_STATE.md`
- [x] Publish/rename broader CLI package so `npx buyapi scan` works directly
- [ ] Expand scanner fixture coverage and detection registry provenance
- [ ] Add AI-assisted package enrichment after human review queue proves useful

### Future
- [ ] New categories: analytics, monitoring, CMS, search, vector databases
- [ ] Automated data freshness — pricing pages scraped and verified on schedule
- [ ] Vendor-claimed profiles — vendors can verify and update their own data
- [ ] Usage analytics — which vendors and categories are queried most

## Possible Future

- [ ] Optional agent skill/rule installed by `buyapi setup`

## Requesting Vendors or Categories

Open an issue if you'd like a vendor or category added. Include:
- Vendor name and URL
- Category it belongs to
- Why it's relevant for AI-assisted development

## Data Accuracy

All vendor data is manually curated and reviewed. If you spot inaccurate information, please open an issue with:
- Which vendor and field is wrong
- What the correct data is
- A link to the source
