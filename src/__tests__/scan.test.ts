import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { formatStackScan, scanStack } from "../lib/scan.js";

describe("scanStack", () => {
  it("detects known tools from package.json and config files", () => {
    const root = mkdtempSync(join(tmpdir(), "buyapi-scan-"));
    mkdirSync(join(root, "convex"));
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        dependencies: {
          convex: "^1.0.0",
          "@clerk/nextjs": "^1.0.0",
          stripe: "^1.0.0",
        },
      })
    );
    writeFileSync(join(root, "vercel.json"), "{}");

    const result = scanStack(root);
    expect(result.tools.map((tool) => tool.vendorSlug)).toEqual(
      expect.arrayContaining([
        "/database/convex",
        "/auth/clerk",
        "/payments/stripe",
        "/hosting/vercel",
      ])
    );
  });

  it("formats a local-only scan report", () => {
    const root = mkdtempSync(join(tmpdir(), "buyapi-scan-"));
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ dependencies: { resend: "^1.0.0" } })
    );

    const text = formatStackScan(scanStack(root));
    expect(text).toContain("BuyAPI stack scan");
    expect(text).toContain("/email/resend");
    expect(text).toContain("does not upload");
  });
});
