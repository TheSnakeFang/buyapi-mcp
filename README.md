# BuyAPI CLI + MCP Server

> Unbiased vendor intelligence for AI coding agents.

[![Website](https://img.shields.io/badge/Website-buyapi.ai-blue)](https://buyapi.ai)
[![NPM Version](https://img.shields.io/npm/v/buyapi?color=red)](https://www.npmjs.com/package/buyapi)
[![MIT licensed](https://img.shields.io/npm/l/buyapi)](./LICENSE)

BuyAPI helps AI agents and developers make informed infrastructure decisions. When your agent needs to pick a database, auth provider, hosting platform, payment processor, or email provider, BuyAPI provides current, structured, neutral vendor comparisons - not training data defaults.

## Quick Start

### Remote MCP (Recommended)

The hosted endpoint is the primary install path and exposes the current seven-tool contract.

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

This is the easiest path: the client connects directly to BuyAPI over HTTP, with no local process and no npm install.

### Local Install

`buyapi@0.3.1` is published on npm:

```bash
npx buyapi help
```

In an MCP client config, this command is launched by the client as a local stdio server. You do not run it manually first:

```json
{
  "mcpServers": {
    "buyapi": {
      "command": "npx",
      "args": ["-y", "buyapi"]
    }
  }
}
```

Use the local path when an agent client does not support remote MCP URLs, or when you want the open-source local transport. Hosted MCP is still the recommended default. The older `buyapi-mcp` package remains available as a compatibility package.

### Local Stack Scan

The CLI now has a local-only stack scanner. It inspects common project files and prints detected BuyAPI tools without uploading data or creating an account:

```bash
npx buyapi scan
```

`scan` is a human-facing CLI command, not an MCP tool. The MCP server should stay quiet on stdout because stdout carries the MCP protocol.

### Read-Only CLI

The local package can query BuyAPI without starting an MCP client:

```bash
npx buyapi search "realtime database with preview environments" --category database
npx buyapi details /database/convex
npx buyapi compare /database/convex /database/supabase --query "realtime SaaS"
npx buyapi recommend "B2B AI SaaS with teams and usage billing" --users 1000
npx buyapi cost /email/ses --emails 50000
```

Use `--json` on read-only commands to print the raw structured response.

## When To Use BuyAPI

Use BuyAPI when the question is a vendor or stack decision:

```txt
Should I use Convex, Supabase, or Neon for a realtime B2B SaaS?
```

```txt
Estimate the email cost for 50,000 transactional sends/month.
```

```txt
What auth provider should I use for organizations, SSO later, and a generous free tier?
```

Use implementation docs tools such as Context7 after the decision is made and the agent needs exact APIs, code examples, or version-specific setup steps.

## Tips For Better Answers

- Use BuyAPI vendor IDs when you know them, e.g. `/database/convex`, `/database/supabase`, `/hosting/vercel`.
- Include workload numbers when asking about cost: users, monthly active users, email sends, storage, bandwidth, or monthly orders.
- Include constraints that matter: solo founder, B2B SaaS, HIPAA/SOC2 later, no credit card free tier, preview environments, realtime collaboration, or low lock-in.
- Ask for alternatives when you want tradeoffs, not just a single recommendation.

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

### `get-vendor-evidence`

Fetch recent reviewed evidence rows for a vendor, category, stack, or comparison.

```
Subject type: "vendor"
Subject ID: /database/supabase

-> Returns: Evidence summaries with source URLs, stance, confidence, and observed dates
```

### `find-similar-stacks`

Find public stack profiles related to a vendor, or recent curated stack examples.

```
Vendor ID: /database/convex

-> Returns: Similar stack profiles with project summary, audience, stage, tools, and confidence
```

### `compare-vendors`

Compare two or more specific vendors for a workload or decision.

```
Vendor IDs: ["/database/convex", "/database/supabase", "/database/neon"]
Query: "realtime TypeScript SaaS with preview environments"

-> Returns: Structured decision matrix with fit, capability-by-capability yes/no/unknown coverage, tradeoffs, estimated cost, confidence, and sources
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
      "args": ["-y", "buyapi"]
    }
  }
}
```

</details>

## API Keys

BuyAPI currently works without an API key at the anonymous rate limit. Signed-in users can create dashboard API keys for keyed access and usage analytics.

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

## CLI Reference

```bash
buyapi                             # Run the local MCP server over stdio
buyapi mcp                         # Run the local MCP server over stdio
buyapi scan [dir]                  # Scan a local repo for known stack tools
buyapi search <query>              # Search vendors
buyapi details <vendorId>          # Fetch one vendor profile
buyapi compare <ids...>            # Compare vendors
buyapi recommend <prompt>          # Recommend a stack
buyapi cost <ids...>               # Estimate cost from workload flags
buyapi --version                   # Print the CLI version
```

Common flags:

```bash
--category <name>       Limit search/cost to a category
--query <text>          Add workload or decision context
--users <n>             Monthly active users
--emails <n>            Email sends per month
--orders <n>            Monthly orders
--json                  Print raw structured JSON
```

Future account-backed CLI commands such as `setup`, `login`, `logout`, and `stack sync` are planned but not shipped yet. `npx buyapi-mcp` remains supported for existing installs.

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

## Troubleshooting

- If your MCP client supports remote MCP URLs, use `https://buyapi.ai/api/mcp` first.
- If remote MCP is not supported, configure the local stdio server with `command: "npx"` and `args: ["-y", "buyapi"]`.
- Do not add banners or prompts to the stdio server command; stdout is reserved for MCP protocol messages.
- If anonymous rate limits are hit, create an API key in the BuyAPI dashboard and pass it as `BUYAPI_API_KEY` where your client supports environment variables.
- If a tool or vendor is missing, ask BuyAPI anyway. Unknown requests are treated as demand signals for future corpus expansion.

## Disclaimer

BuyAPI profiles combine first-party sources, manual review, public evidence, and structured estimates. Vendor data can become stale or incomplete, especially pricing and limits. Use BuyAPI as a decision-support layer, verify critical production commitments directly with the vendor, and report outdated facts through the website when the reporting flow is available.

## License

MIT
