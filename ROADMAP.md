# BuyAPI Roadmap

Current status and planned features for the BuyAPI MCP server.

## Current (v0.2)

- [x] `resolve-vendor` - search vendors by query/category with relevance ranking and unknown-corpus fallback
- [x] `get-vendor-details` - full vendor profiles with pricing, limits, comparisons, and source provenance
- [x] `compare-vendors` - head-to-head structured comparison between specific vendors
- [x] `estimate-cost` - deterministic cost estimates from explicit workload inputs
- [x] `recommend-stack` - complete stack recommendations with cost projections, decision matrix, assumptions, unknowns, alternatives, and sources
- [x] Local stdio transport (`npx buyapi-mcp`)
- [x] API key support for higher rate limits

### Covered Categories
- Database (Supabase, Convex, Neon, PlanetScale, Firebase)
- Auth (Supabase Auth, Clerk, Auth0, Auth.js)
- Hosting (Vercel, Netlify, Railway, Fly.io)
- Payments (Stripe, LemonSqueezy, Paddle, RevenueCat)
- Email (Resend, SendGrid, Postmark, Amazon SES)

## Planned

### Near-term
- [x] Remote MCP endpoint (`https://buyapi.ai/api/mcp`) - no local install needed
- [x] npm publish - `buyapi-mcp@0.2.0` installable from registry via `npx buyapi-mcp`
- [x] GitHub Release - `v0.2.0` release notes published
- [x] Release workflow skips npm publish when a version already exists
- [ ] More vendor profiles with full pricing data
- [x] CI/CD for automated npm releases on tag

### Future
- [ ] New categories: analytics, monitoring, CMS, search, vector databases
- [ ] Automated data freshness — pricing pages scraped and verified on schedule
- [ ] Vendor-claimed profiles — vendors can verify and update their own data
- [ ] Usage analytics — which vendors and categories are queried most

## Possible Future

- [ ] `buyapi-cli` — CLI tool for researching vendors, managing profiles, and interacting with the BuyAPI platform from the terminal

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
