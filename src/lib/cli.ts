import type { WorkloadInput } from "./types.js";
import { PACKAGE_VERSION } from "./version.js";
import type { SetupClient, SetupMode } from "./setup.js";
import type { SkillClient } from "./skill.js";

export type CliCommand =
  | { name: "mcp" }
  | {
      name: "setup";
      client?: SetupClient;
      mode: SetupMode;
      print: boolean;
      skill: boolean;
    }
  | { name: "setup-skill"; client?: SkillClient; print: boolean }
  | { name: "login"; apiKey?: string }
  | { name: "logout" }
  | { name: "whoami"; json: boolean; quiet: boolean }
  | { name: "help" }
  | { name: "version" }
  | {
      name: "scan";
      root?: string;
      sync: boolean;
      dryRun: boolean;
      verbose: boolean;
      all: boolean;
      yes: boolean;
      allowEmpty: boolean;
      projectName?: string;
      stackSlug?: string;
      summary?: string;
      json: boolean;
    }
  | {
      name: "search";
      query: string;
      category?: string;
      json: boolean;
    }
  | {
      name: "details";
      vendorId: string;
      query?: string;
      json: boolean;
    }
  | {
      name: "recommend";
      projectDescription: string;
      constraints?: string;
      workload?: WorkloadInput;
      json: boolean;
    }
  | {
      name: "compare";
      vendorIds: string[];
      query: string;
      workload?: WorkloadInput;
      json: boolean;
    }
  | {
      name: "cost";
      vendorIds: string[];
      category?: string;
      workload: WorkloadInput;
      json: boolean;
    };

export function parseCliCommand(argv: string[]): CliCommand {
  const [rawCommand, ...rest] = argv;
  const command = rawCommand ?? "";

  if (command === "--help" || command === "-h" || command === "help") {
    return { name: "help" };
  }
  if (command === "--version" || command === "-v" || command === "version") {
    return { name: "version" };
  }

  if (!command || command.startsWith("--") || command === "setup") {
    const { positional, options } = parseOptions(
      command === "setup" ? rest : argv
    );
    const client = normalizeClient(positional[0] || options.client);
    return {
      name: "setup",
      client,
      mode: options.local ? "local" : "remote",
      print: Boolean(options.print),
      skill: Boolean(options.skill),
    };
  }

  const { positional, options, json } = parseOptions(rest);
  if (command === "mcp") return { name: "mcp" };

  if (command === "setup-skill") {
    return {
      name: "setup-skill",
      client: normalizeSkillClient(positional[0] || options.client),
      print: Boolean(options.print),
    };
  }

  if (command === "login") {
    return { name: "login", apiKey: positional[0] || options.key };
  }

  if (command === "logout") {
    return { name: "logout" };
  }

  if (command === "whoami") {
    return { name: "whoami", json, quiet: Boolean(options.quiet) };
  }

  if (command === "scan") {
    const root = positional.find((item) => !item.startsWith("-"));
    const projectName = options["stack-name"] ?? options.name;
    return {
      name: "scan",
      root,
      sync: Boolean(options.sync),
      dryRun: Boolean(options["dry-run"]),
      verbose: Boolean(options.verbose),
      all: Boolean(options.all),
      yes: Boolean(options.yes),
      allowEmpty: Boolean(options["allow-empty"] || options.force),
      projectName,
      stackSlug: options.stack,
      summary: options.summary,
      json,
    };
  }

  if (command === "search") {
    const query = positional.join(" ").trim() || options.query;
    if (!query) throw new Error("search requires a query.");
    return {
      name: "search",
      query,
      category: options.category,
      json,
    };
  }

  if (command === "details") {
    const vendorId = positional[0];
    if (!vendorId) throw new Error("details requires a vendor ID.");
    return {
      name: "details",
      vendorId,
      query: options.query,
      json,
    };
  }

  if (command === "recommend") {
    const projectDescription = positional.join(" ").trim() || options.project;
    if (!projectDescription) {
      throw new Error("recommend requires a project description.");
    }
    return {
      name: "recommend",
      projectDescription,
      constraints: options.constraints,
      workload: parseWorkload(options),
      json,
    };
  }

  if (command === "compare") {
    const query = options.query;
    if (!query) throw new Error("compare requires --query.");
    if (positional.length < 2) {
      throw new Error("compare requires at least two vendor IDs.");
    }
    return {
      name: "compare",
      vendorIds: positional,
      query,
      workload: parseWorkload(options),
      json,
    };
  }

  if (command === "cost") {
    const workload = parseWorkload(options);
    if (Object.keys(workload).length === 0) {
      throw new Error("cost requires workload flags like --users or --emails.");
    }
    return {
      name: "cost",
      vendorIds: positional,
      category: options.category,
      workload,
      json,
    };
  }

  throw new Error(`Unknown command: ${command}`);
}

export function helpText(): string {
  return `BuyAPI

Version: ${PACKAGE_VERSION}

Commands:
  buyapi                             Show setup options for humans
  buyapi setup <client>              Install MCP config for a supported client
  buyapi setup <client> --skill      Install MCP config and the /stack skill
  buyapi setup-skill <client>         Install the /stack skill only
  buyapi mcp                         Run the local MCP server over stdio
  buyapi login                       Sign in through the browser and store a key
  buyapi login <api-key>             Store an existing API key for CLI sync
  buyapi logout                      Remove the stored API key
  buyapi whoami                      Show the active local BuyAPI key state
  buyapi whoami --quiet              Exit 0 when logged in, 1 when not
  buyapi scan [dir]                  Scan locally, then optionally save stack
  buyapi scan --sync --yes           Scan and save without prompts
  buyapi search <query>              Search tools in the BuyAPI corpus
  buyapi details <vendor-id>          Show a sourced vendor profile
  buyapi recommend <project>          Recommend a stack for a project
  buyapi compare <ids...> --query ... Compare vendors for a decision
  buyapi cost <ids...> --users 1000   Estimate vendor costs

Options:
  --category <name>       Limit search/cost to a category
  --query <text>          Decision context or details focus
  --client <name>         setup target: claude-code, cursor, codex, windsurf, cline
  --local                 setup local stdio config instead of hosted MCP URL
  --skill                 also install the /stack planning skill during setup
  --print                 print setup config instead of writing it
  --name <text>           Stack name for scan sync
  --stack-name <text>     Alias for --name
  --stack <slug>          Stable stack slug/name to update during sync
  --summary <text>        Stack notes for scan sync
  --sync                  Save scan output to your BuyAPI dashboard
  --dry-run               Preview scan output without uploading
  --verbose               Include scanner evidence details
  --all                   Include lower-confidence supporting detections
  --allow-empty           Save a stack even when no known tools were detected
  --force                 Alias for --allow-empty
  --yes                   Skip sync confirmation prompt
  --constraints <text>    Budget, scale, compliance, or existing tools
  --users <n>             User count
  --mau <n>               Monthly active users
  --emails <n>            Email sends per month
  --transactions <n>      Monthly payment transactions
  --avg-transaction <n>   Average transaction in USD
  --revenue <n>           Monthly revenue in USD
  --json                  Print raw JSON

Use the buyapi package for new installs. buyapi-mcp remains as a compatibility binary.

Install globally if you do not want to type npx:
  npm install -g buyapi
  buyapi scan

By default, scan previews locally first. In an interactive terminal it asks
before saving. Use --dry-run for a guaranteed no-upload scan, or use
buyapi login and buyapi scan --sync --yes for automation. Run
buyapi setup claude-code --skill or buyapi setup-skill codex to add the
/stack planning workflow where skills are supported.`;
}

function parseOptions(argv: string[]) {
  const positional: string[] = [];
  const options: Record<string, string> = {};
  let json = false;

  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === "--json") {
      json = true;
      continue;
    }
    if (value.startsWith("--")) {
      const key = value.slice(2);
      const next = argv[index + 1];
      if (key === "sync") {
        options[key] = "true";
        continue;
      }
      if (
        [
          "local",
          "print",
          "skill",
          "dry-run",
          "verbose",
          "all",
          "allow-empty",
          "force",
          "yes",
          "quiet",
        ].includes(key)
      ) {
        options[key] = "true";
        continue;
      }
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for --${key}.`);
      }
      options[key] = next;
      index++;
      continue;
    }
    positional.push(value);
  }

  return { positional, options, json };
}

function normalizeSkillClient(value?: string): SkillClient | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (
    normalized === "claude" ||
    normalized === "claude-code" ||
    normalized === "claudecode"
  ) {
    return "claude-code";
  }
  if (normalized === "codex" || normalized === "codex-cli") return "codex";
  throw new Error(`Unknown skill client: ${value}. Use claude-code or codex.`);
}

function normalizeClient(value: string | undefined): SetupClient | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (
    normalized === "claude" ||
    normalized === "claude-code" ||
    normalized === "claudecode"
  ) {
    return "claude-code";
  }
  if (normalized === "cursor") return "cursor";
  if (normalized === "codex" || normalized === "codex-cli") return "codex";
  if (normalized === "windsurf") return "windsurf";
  if (normalized === "cline" || normalized === "vscode") return "cline";
  throw new Error(
    `Unknown setup client: ${value}. Use claude-code, cursor, codex, windsurf, or cline.`
  );
}

function parseWorkload(options: Record<string, string>): WorkloadInput {
  return omitUndefined({
    users: parseNumber(options.users),
    monthlyActiveUsers: parseNumber(options.mau),
    emailSendsPerMonth: parseNumber(options.emails),
    monthlyTransactions: parseNumber(options.transactions),
    averageTransactionUsd: parseNumber(options["avg-transaction"]),
    monthlyRevenueUsd: parseNumber(options.revenue),
    notes: options.notes,
  });
}

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected number, received ${value}.`);
  }
  return parsed;
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}
