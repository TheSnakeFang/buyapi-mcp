# BuyAPI MCP Server

> Unbiased vendor intelligence for AI coding agents.

BuyAPI helps AI agents and developers make informed infrastructure decisions. When your agent needs to pick a database, auth provider, hosting platform, payment processor, or email provider, BuyAPI provides current, structured, neutral vendor comparisons - not training data defaults.

## Quick Start

### Remote MCP (Recommended)

The hosted endpoint is the primary install path and exposes the current `v0.2.0` five-tool contract.

Add to your MCP client config:

```json
{
  "mcpServers": {
    "buyapi": {
      "url": "https://buyapi.ai/api/mcp"
    }
  }
}
```

### Local Install

`buyapi-mcp@0.2.0` is published on npm:

```bash
npx buyapi-mcp
```

### Local Stack Scan

The CLI now has a local-only stack scanner. It inspects common project files and prints detected BuyAPI tools without uploading data or creating an account:

```bash
npx buyapi-mcp scan
```

The package also exposes a `buyapi` binary for the future broader CLI. Publishing a separate `buyapi` npm package would be required before `npx buyapi scan` works from a clean machine.

## Available Tools

### `resolve-vendor`

Search for vendors by query. Category is optional. Returns matching vendors with pricing summaries, positioning, confidence, and explicit unknown-corpus fallbacks.

```
Query: "I need a database for a real-time collaborative app"
Category: "database"

-> Returns: Convex, Supabase, Neon, PlanetScale, Firebase with comparison metadata
```

### `get-vendor-details`

Get detailed vendor profile: concrete pricing numbers, free tier limits, scaling characteristics, known gotchas, source provenance, and head-to-head comparisons.

```
Vendor ID: /database/supabase
Query: "free tier limits for a side project"

-> Returns: Full pricing tiers, 500MB DB limit, 50K auth users, scaling triggers, and sources
```

### `compare-vendors`

Compare two or more specific vendors for a workload or decision.

```
Vendor IDs: ["/database/convex", "/database/supabase", "/database/neon"]
Query: "realtime TypeScript SaaS with preview environments"

-> Returns: Structured decision matrix with fit, tradeoffs, estimated cost, confidence, and sources
```

### `estimate-cost`

Run deterministic cost estimates from explicit workload inputs instead of leaving math to the model.

```
Vendor IDs: ["/email/ses"]
Workload: { "emailSendsPerMonth": 50000 }

-> Returns: Amazon SES estimated at $5/month, basis, assumptions, unknowns, and sources
```

### `recommend-stack`

Describe your project and get a complete stack recommendation with cost projections, a decision matrix, assumptions, unknowns, alternatives, and sources.

```
Project: "SaaS for restaurant inventory with real-time updates"
Constraints: "Solo founder, under $50/month until 1000 users"

-> Returns: Full stack (hosting + DB + auth + payments + email) with structured cost and decision data
```

## Setup by Client

<details>
<summary><strong>Claude Code</strong></summary>

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "buyapi": {
      "url": "https://buyapi.ai/api/mcp"
    }
  }
}
```

</details>

<details>
<summary><strong>Cursor</strong></summary>

In Cursor Settings -> MCP Servers, add:

```json
{
  "mcpServers": {
    "buyapi": {
      "url": "https://buyapi.ai/api/mcp"
    }
  }
}
```

</details>

<details>
<summary><strong>VS Code (Copilot)</strong></summary>

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "buyapi": {
      "url": "https://buyapi.ai/api/mcp"
    }
  }
}
```

</details>

<details>
<summary><strong>Windsurf</strong></summary>

Add to your Windsurf MCP config:

```json
{
  "mcpServers": {
    "buyapi": {
      "url": "https://buyapi.ai/api/mcp"
    }
  }
}
```

</details>

<details>
<summary><strong>Local (stdio)</strong></summary>

```json
{
  "mcpServers": {
    "buyapi": {
      "command": "npx",
      "args": ["-y", "buyapi-mcp"]
    }
  }
}
```

</details>

## API Keys

BuyAPI currently works without an API key at the anonymous rate limit. Keyed access is scaffolded in the backend but not publicly shipped yet, so the dashboard does not issue real keys today.

The local MCP package already forwards `BUYAPI_API_KEY` for future compatibility:

```json
{
  "mcpServers": {
    "buyapi": {
      "url": "https://buyapi.ai/api/mcp",
      "env": {
        "BUYAPI_API_KEY": "ba_live_..."
      }
    }
  }
}
```

## Covered Categories

| Category | Vendors |
|----------|---------|
| Database | Supabase, Convex, Neon, PlanetScale, Firebase |
| Auth | Supabase Auth, Clerk, Auth0, Auth.js |
| Hosting | Vercel, Netlify, Railway, Fly.io |
| Payments | Stripe, LemonSqueezy, Paddle, RevenueCat |
| Email | Resend, SendGrid, Postmark, Amazon SES |

## How It Works

This MCP server is a thin TypeScript client that calls the BuyAPI backend API. It contains no vendor data; lightweight comparison and cost formatting mirrors the hosted endpoint while vendor intelligence is served from [buyapi.ai](https://buyapi.ai).

The source is fully open so you can verify there's no prompt injection or hidden behavior. `scan` is local-only and does not upload stack data.

## Data Transparency

- All vendor data is publicly viewable at [buyapi.ai](https://buyapi.ai)
- Every profile shows when it was last updated and data source
- BuyAPI does not accept payment from vendors for ranking influence
- Inaccurate-data reporting and vendor claiming are roadmap items, not live product flows yet.

## License

MIT
