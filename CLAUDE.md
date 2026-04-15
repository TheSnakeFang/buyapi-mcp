# BuyAPI MCP Server

Public, open-source MCP server for BuyAPI. This is a thin client — all business logic and vendor data lives in the private `buyapi-app` repo.

## What This Repo Is
- TypeScript MCP server with 3 tools: `resolve-vendor`, `get-vendor-details`, `recommend-stack`
- Calls the BuyAPI backend API (`https://buyapi.ai`) — contains NO vendor data itself
- Published to npm as `buyapi-mcp` (when ready)
- MIT licensed for trust and distribution

## What This Repo Is NOT
- No seed data, no backend logic, no API keys, no private information
- No planning docs — those live in the private app repo
- Changes here are visible to the public — review before committing

## Stack
- TypeScript, `@modelcontextprotocol/sdk`, `zod`
- Bundled with `tsup`, tested with `vitest`

## Commands
- `pnpm build` — Build to `dist/`
- `pnpm test` — Run tests (21 tests)
- `pnpm typecheck` — Type check
- `BUYAPI_API_URL=http://localhost:3000 node dist/index.mjs` — Run locally against dev backend

## Architecture
- `src/index.ts` — MCP server entry, tool registration
- `src/lib/api.ts` — HTTP client calling buyapi.ai API routes
- `src/lib/format.ts` — Response formatting (Markdown output for LLMs)
- `src/lib/types.ts` — Shared types (duplicated from app repo)

## Contributing Guidelines (for public visibility)
- Tool descriptions are prompt engineering — changes affect how LLMs use BuyAPI
- Keep the README install instructions current for every major MCP client
- Never add vendor data, API keys, or internal docs to this repo
