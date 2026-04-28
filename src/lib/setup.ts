import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const MCP_URL = "https://buyapi.ai/api/mcp";

export type SetupClient =
  | "claude-code"
  | "cursor"
  | "codex"
  | "windsurf"
  | "cline";

export type SetupMode = "remote" | "local";

type SetupResult = {
  client: SetupClient;
  path: string;
  changed: boolean;
  message: string;
};

const CLIENT_PATHS: Record<SetupClient, string> = {
  "claude-code": join(homedir(), ".claude", "mcp_servers.json"),
  cursor: join(homedir(), ".cursor", "mcp.json"),
  codex: join(homedir(), ".codex", "config.toml"),
  windsurf: join(homedir(), ".codeium", "windsurf", "mcp_config.json"),
  cline: join(process.cwd(), ".vscode", "mcp.json"),
};

export const SETUP_CLIENTS: SetupClient[] = [
  "claude-code",
  "cursor",
  "codex",
  "windsurf",
  "cline",
];

export function installClientConfig(
  client: SetupClient,
  mode: SetupMode
): SetupResult {
  if (client === "codex") return installCodexConfig(mode);
  if (client === "cline") return installVsCodeMcpConfig(client, mode);
  return installMcpServersJson(client, mode);
}

export function setupTargetPath(client: SetupClient): string {
  return CLIENT_PATHS[client];
}

export function setupSnippet(mode: SetupMode, vscode = false): string {
  const server = mcpServerConfig(mode);
  return JSON.stringify(vscode ? { servers: { buyapi: server } } : { mcpServers: { buyapi: server } }, null, 2);
}

function installMcpServersJson(
  client: Exclude<SetupClient, "codex" | "cline">,
  mode: SetupMode
): SetupResult {
  const path = CLIENT_PATHS[client];
  const config = readJsonFile(path);
  const next = {
    ...config,
    mcpServers: {
      ...(asRecord(config.mcpServers) ?? {}),
      buyapi: mcpServerConfig(mode),
    },
  };
  const changed = JSON.stringify(config) !== JSON.stringify(next);
  writeJsonFile(path, next);
  return {
    client,
    path,
    changed,
    message: `Installed BuyAPI MCP config for ${client} at ${path}.`,
  };
}

function installVsCodeMcpConfig(
  client: "cline",
  mode: SetupMode
): SetupResult {
  const path = CLIENT_PATHS[client];
  const config = readJsonFile(path);
  const next = {
    ...config,
    servers: {
      ...(asRecord(config.servers) ?? {}),
      buyapi: mcpServerConfig(mode),
    },
  };
  const changed = JSON.stringify(config) !== JSON.stringify(next);
  writeJsonFile(path, next);
  return {
    client,
    path,
    changed,
    message: `Installed BuyAPI MCP config for Cline/VS Code at ${path}.`,
  };
}

function installCodexConfig(mode: SetupMode): SetupResult {
  const path = CLIENT_PATHS.codex;
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const block = codexTomlBlock(mode);
  const pattern = /\n?\[mcp_servers\.buyapi\]\n[\s\S]*?(?=\n\[|$)/;
  const next = pattern.test(existing)
    ? existing.replace(pattern, `\n${block}\n`)
    : `${existing.trimEnd()}${existing.trim() ? "\n\n" : ""}${block}\n`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next, { mode: 0o600 });
  return {
    client: "codex",
    path,
    changed: existing !== next,
    message: `Installed BuyAPI MCP config for Codex at ${path}.`,
  };
}

function codexTomlBlock(mode: SetupMode): string {
  if (mode === "remote") {
    return `[mcp_servers.buyapi]\nurl = "${MCP_URL}"`;
  }
  return `[mcp_servers.buyapi]\ncommand = "npx"\nargs = ["-y", "buyapi", "mcp"]`;
}

function mcpServerConfig(mode: SetupMode) {
  return mode === "remote"
    ? { url: MCP_URL }
    : { command: "npx", args: ["-y", "buyapi", "mcp"] };
}

function readJsonFile(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Could not parse ${path}. Fix the JSON or move the file before running setup. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function writeJsonFile(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
