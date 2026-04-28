import type { WorkloadInput } from "./types.js";
import { PACKAGE_VERSION } from "./version.js";

export type CliCommand =
  | { name: "mcp" }
  | { name: "help" }
  | { name: "version" }
  | { name: "scan"; root?: string }
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
  const { positional, options, json } = parseOptions(rest);

  if (!command || command === "mcp") return { name: "mcp" };
  if (command === "--help" || command === "-h" || command === "help") {
    return { name: "help" };
  }
  if (command === "--version" || command === "-v" || command === "version") {
    return { name: "version" };
  }

  if (command === "scan") {
    return { name: "scan", root: positional[0] };
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
  buyapi                             Run the local MCP server over stdio
  buyapi mcp                         Run the local MCP server over stdio
  buyapi scan [dir]                  Scan a local repo for known stack tools
  buyapi search <query>              Search tools in the BuyAPI corpus
  buyapi details <vendor-id>          Show a sourced vendor profile
  buyapi recommend <project>          Recommend a stack for a project
  buyapi compare <ids...> --query ... Compare vendors for a decision
  buyapi cost <ids...> --users 1000   Estimate vendor costs

Options:
  --category <name>       Limit search/cost to a category
  --query <text>          Decision context or details focus
  --constraints <text>    Budget, scale, compliance, or existing tools
  --users <n>             User count
  --mau <n>               Monthly active users
  --emails <n>            Email sends per month
  --transactions <n>      Monthly payment transactions
  --avg-transaction <n>   Average transaction in USD
  --revenue <n>           Monthly revenue in USD
  --json                  Print raw JSON

Note: buyapi-mcp is deprecated on npm. Use npx buyapi for new installs.

The scan command is local-only and does not upload data.`;
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
