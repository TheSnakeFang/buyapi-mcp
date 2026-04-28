import { describe, expect, it } from "vitest";
import { helpText, parseCliCommand } from "../lib/cli.js";

describe("parseCliCommand", () => {
  it("defaults to MCP stdio mode with no command", () => {
    expect(parseCliCommand([])).toEqual({ name: "mcp" });
  });

  it("parses explicit MCP and version commands", () => {
    expect(parseCliCommand(["mcp"])).toEqual({ name: "mcp" });
    expect(parseCliCommand(["--version"])).toEqual({ name: "version" });
  });

  it("parses local scan", () => {
    expect(parseCliCommand(["scan", "/tmp/project"])).toEqual({
      name: "scan",
      root: "/tmp/project",
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
    expect(text).toContain("buyapi compare <ids...>");
    expect(text).toContain("npx buyapi-mcp still works");
    expect(text).toContain("does not upload data");
  });
});
