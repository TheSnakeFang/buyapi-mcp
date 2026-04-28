import { describe, expect, it } from "vitest";
import { helpText, parseCliCommand } from "../lib/cli.js";

describe("parseCliCommand", () => {
  it("defaults to setup mode with no command", () => {
    expect(parseCliCommand([])).toEqual({
      name: "setup",
      client: undefined,
      mode: "remote",
      print: false,
    });
  });

  it("parses setup clients", () => {
    expect(parseCliCommand(["setup", "cursor"])).toEqual({
      name: "setup",
      client: "cursor",
      mode: "remote",
      print: false,
    });
    expect(parseCliCommand(["setup", "codex", "--local", "--print"])).toEqual({
      name: "setup",
      client: "codex",
      mode: "local",
      print: true,
    });
  });

  it("parses explicit MCP and version commands", () => {
    expect(parseCliCommand(["mcp"])).toEqual({ name: "mcp" });
    expect(parseCliCommand(["--version"])).toEqual({ name: "version" });
  });

  it("parses local scan", () => {
    expect(parseCliCommand(["scan", "/tmp/project"])).toEqual({
      name: "scan",
      root: "/tmp/project",
      sync: false,
      dryRun: false,
      verbose: false,
      all: false,
      yes: false,
      projectName: undefined,
      stackSlug: undefined,
      summary: undefined,
      json: false,
    });
  });

  it("parses scan sync options", () => {
    expect(
      parseCliCommand([
        "scan",
        "/tmp/project",
        "--sync",
        "--name",
        "My App",
        "--summary",
        "Launch stack",
      ])
    ).toEqual({
      name: "scan",
      root: "/tmp/project",
      sync: true,
      dryRun: false,
      verbose: false,
      all: false,
      yes: false,
      projectName: "My App",
      stackSlug: undefined,
      summary: "Launch stack",
      json: false,
    });
  });

  it("parses expanded scan flags", () => {
    expect(
      parseCliCommand([
        "scan",
        "--sync",
        "--dry-run",
        "--verbose",
        "--all",
        "--yes",
        "--stack",
        "launch-stack",
        "--stack-name",
        "Launch Stack",
      ])
    ).toEqual({
      name: "scan",
      root: undefined,
      sync: true,
      dryRun: true,
      verbose: true,
      all: true,
      yes: true,
      projectName: "Launch Stack",
      stackSlug: "launch-stack",
      summary: undefined,
      json: false,
    });
  });

  it("parses login and logout", () => {
    expect(parseCliCommand(["login", "ba_live_test"])).toEqual({
      name: "login",
      apiKey: "ba_live_test",
    });
    expect(parseCliCommand(["logout"])).toEqual({ name: "logout" });
    expect(parseCliCommand(["whoami", "--json"])).toEqual({
      name: "whoami",
      json: true,
    });
  });

  it("parses search with category and JSON output", () => {
    expect(
      parseCliCommand(["search", "realtime database", "--category", "database", "--json"])
    ).toEqual({
      name: "search",
      query: "realtime database",
      category: "database",
      json: true,
    });
  });

  it("parses comparison commands with workload flags", () => {
    expect(
      parseCliCommand([
        "compare",
        "/database/convex",
        "/database/supabase",
        "--query",
        "realtime preview environments",
        "--users",
        "1000",
      ])
    ).toEqual({
      name: "compare",
      vendorIds: ["/database/convex", "/database/supabase"],
      query: "realtime preview environments",
      workload: { users: 1000 },
      json: false,
    });
  });

  it("parses cost commands with email volume", () => {
    expect(parseCliCommand(["cost", "/email/ses", "--emails", "50000"])).toEqual({
      name: "cost",
      vendorIds: ["/email/ses"],
      category: undefined,
      workload: { emailSendsPerMonth: 50000 },
      json: false,
    });
  });

  it("prints read-only CLI commands in help", () => {
    const text = helpText();
    expect(text).toContain("buyapi search <query>");
    expect(text).toContain("buyapi scan --sync");
    expect(text).toContain("buyapi compare <ids...>");
    expect(text).toContain("buyapi-mcp is deprecated");
    expect(text).toContain("By default, scan is local-only");
  });
});
