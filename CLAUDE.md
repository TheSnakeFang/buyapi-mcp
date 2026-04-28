# BuyAPI MCP Server

Public, open-source MCP server for BuyAPI — the tool AI agents call when they need to pick a vendor.

**Published:** `buyapi@0.3.1` on npm; `buyapi-mcp` is deprecated and points users to `buyapi`
**Live endpoint:** `https://buyapi.ai/api/mcp`

## What This Repo Is
- TypeScript MCP server with 5 tools: `resolve-vendor`, `get-vendor-details`, `compare-vendors`, `estimate-cost`, `recommend-stack`
- Calls the BuyAPI backend API (`https://buyapi.ai`) — contains NO vendor data itself
- Thin client (~300 lines). All business logic and vendor data lives in the private `buyapi-app` repo
- MIT licensed for trust and distribution

## What This Repo Is NOT
- No seed data, no backend logic, no API keys, no private information
- No planning docs — those live in the private app repo
- Changes here are visible to the public — review before committing

## Stack
- TypeScript, `@modelcontextprotocol/sdk`, `zod`
- Bundled with `tsup`, tested with `vitest` (21 tests)
- CI: GitHub Actions (typecheck + test on push, npm publish on release tag)

## Commands
- `pnpm build` — Build to `dist/`
- `pnpm test` — Run tests (21 tests)
- `pnpm lint` — Run ESLint
- `pnpm typecheck` — Type check
- `BUYAPI_API_URL=http://localhost:3000 node dist/index.js` — Run locally against dev backend

## Architecture
- `src/index.ts` — MCP server entry, tool registration with detailed LLM-facing descriptions
- `src/lib/api.ts` — HTTP client calling buyapi.ai API routes
- `src/lib/format.ts` — Response formatting (Markdown output optimized for LLM consumption)
- `src/lib/types.ts` — Shared types (duplicated from app repo)

## Publishing
- Bump version in `package.json`
- Commit and push to main
- Create GitHub release with `v*` tag → CI auto-publishes to npm

## Important
- Tool descriptions are prompt engineering — changes affect how LLMs use BuyAPI
- Keep the README install instructions current for every major MCP client
- Never add vendor data, API keys, or internal docs to this repo
- The `type: module` field is required — don't remove it or npx breaks
