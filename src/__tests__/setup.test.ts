import { describe, expect, it } from "vitest";
import { setupSnippet } from "../lib/setup.js";

describe("setupSnippet", () => {
  it("prints hosted MCP config by default", () => {
    expect(setupSnippet("remote")).toContain("https://buyapi.ai/api/mcp");
  });

  it("prints local stdio config when requested", () => {
    const text = setupSnippet("local");
    expect(text).toContain('"command": "npx"');
    expect(text).toContain('"mcp"');
  });

  it("uses VS Code server shape for Cline", () => {
    const text = setupSnippet("remote", true);
    expect(text).toContain('"servers"');
    expect(text).not.toContain('"mcpServers"');
  });
});
