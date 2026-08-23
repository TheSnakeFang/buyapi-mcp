import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PACKAGE_VERSION } from "../lib/version.js";

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8")
) as { version: string; mcpName: string };
const serverJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "server.json"), "utf8")
) as {
  name: string;
  version: string;
  description: string;
  packages: Array<{ identifier: string; version: string }>;
  remotes: Array<{ type: string; url: string }>;
};

describe("MCP registry metadata", () => {
  it("keeps package, runtime, and registry versions aligned", () => {
    expect(PACKAGE_VERSION).toBe(packageJson.version);
    expect(serverJson.version).toBe(packageJson.version);
    expect(serverJson.packages[0]).toMatchObject({
      identifier: "buyapi",
      version: packageJson.version,
    });
  });

  it("publishes both the hosted and npm install paths with decision triggers", () => {
    expect(serverJson.name).toBe(packageJson.mcpName);
    expect(serverJson.remotes).toContainEqual({
      type: "streamable-http",
      url: "https://buyapi.ai/api/mcp",
    });
    expect(serverJson.description).toContain("Use before choosing or replacing");
    expect(serverJson.description).toContain("database");
    expect(serverJson.description).toContain("auth");
  });
});
