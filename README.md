# BuyAPI MCP Server

> Unbiased vendor intelligence for AI coding agents.

BuyAPI helps AI agents and developers make informed infrastructure decisions. When your agent needs to pick a database, auth provider, hosting platform, or payment processor, BuyAPI provides current, structured, neutral vendor comparisons — not training data defaults.

## Quick Start

### Remote MCP (Recommended)

Add to your MCP client config:

```json
{
  "mcpServers": {
    "buyapi": {
      "url": "https://mcp.buyapi.ai/mcp"
    }
  }
}
```

### Local Install

```bash
npx buyapi-mcp
```

## Available Tools

### `resolve-vendor`

Search for vendors by category. Returns matching vendors with pricing summaries and positioning.

```
Query: "I need a database for a real-time collaborative app"
Category: "database"

→ Returns: Supabase, Convex, Neon, PlanetScale, Firebase with comparison metadata
```

### `get-vendor-details`

Get detailed vendor profile — concrete pricing numbers, free tier limits, scaling characteristics, known gotchas, and head-to-head comparisons.

```
Vendor ID: /database/supabase
Query: "free tier limits for a side project"

→ Returns: Full pricing tiers, 500MB DB limit, 50K auth users, scaling triggers
```

### `recommend-stack`

Describe your project and get a complete stack recommendation with cost projections at multiple scale points.

```
Project: "SaaS for restaurant inventory with real-time updates"
Constraints: "Solo founder, under $50/month until 1000 users"

→ Returns: Full stack (hosting + DB + auth + payments + email) with cost estimates at 100/1K/10K users
```

## Setup by Client

<details>
<summary><strong>Claude Code</strong></summary>

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "buyapi": {
      "url": "https://mcp.buyapi.ai/mcp"
    }
  }
}
```

</details>

<details>
<summary><strong>Cursor</strong></summary>

In Cursor Settings → MCP Servers, add:

```json
{
  "mcpServers": {
    "buyapi": {
      "url": "https://mcp.buyapi.ai/mcp"
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
      "url": "https://mcp.buyapi.ai/mcp"
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
      "url": "https://mcp.buyapi.ai/mcp"
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

## API Key (Optional)

BuyAPI works without an API key. For higher rate limits, get a free key at [buyapi.ai/dashboard](https://buyapi.ai/dashboard).

```json
{
  "mcpServers": {
    "buyapi": {
      "url": "https://mcp.buyapi.ai/mcp",
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

This MCP server is a thin TypeScript client that calls the BuyAPI backend API. It contains no vendor data or business logic — all intelligence is served from [buyapi.ai](https://buyapi.ai).

The source is fully open so you can verify there's no data collection, prompt injection, or hidden behavior.

## Data Transparency

- All vendor data is publicly viewable at [buyapi.ai](https://buyapi.ai)
- Every profile shows when it was last updated and data source (manual curation, vendor-claimed)
- BuyAPI does not accept payment from vendors for ranking influence
- Report inaccurate data: [buyapi.ai/feedback](https://buyapi.ai/feedback)

## License

MIT
