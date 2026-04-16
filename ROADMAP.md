# BuyAPI Roadmap

Current status and planned features for the BuyAPI MCP server.

## Current (v0.1)

- [x] `resolve-vendor` — search vendors by category with relevance ranking
- [x] `get-vendor-details` — full vendor profiles with pricing, limits, comparisons
- [x] `recommend-stack` — complete stack recommendations with cost projections
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
- [ ] Remote MCP endpoint (`https://mcp.buyapi.ai/mcp`) — no local install needed
- [ ] npm publish — `npx buyapi-mcp` installable from registry
- [ ] More vendor profiles with full pricing data
- [ ] CI/CD for automated npm releases on tag

### Future
- [ ] New categories: analytics, monitoring, CMS, search, vector databases
- [ ] Automated data freshness — pricing pages scraped and verified on schedule
- [ ] Vendor-claimed profiles — vendors can verify and update their own data
- [ ] Usage analytics — which vendors and categories are queried most
- [ ] Compare tool — head-to-head structured comparison between two specific vendors

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
