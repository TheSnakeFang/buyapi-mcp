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
          "ai-newthing": "^0.1.0",
        },
        devDependencies: {
          vitest: "^4.0.0",
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
    expect(result.unknownDependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packageName: "ai-newthing",
          dependencyType: "dependencies",
        }),
        expect.objectContaining({
          packageName: "vitest",
          dependencyType: "devDependencies",
        }),
      ])
    );
    expect(result.unknownDependencies.map((dep) => dep.packageName)).not.toContain(
      "convex"
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

  it("detects env examples and prints verbose evidence", () => {
    const root = mkdtempSync(join(tmpdir(), "buyapi-scan-"));
    writeFileSync(
      join(root, ".env.example"),
      "AUTH0_DOMAIN=\nPADDLE_API_KEY=\nPOSTMARK_SERVER_TOKEN=\n"
    );

    const result = scanStack(root);
    expect(result.tools.map((tool) => tool.vendorSlug)).toEqual(
      expect.arrayContaining([
        "/auth/auth0",
        "/payments/paddle",
        "/email/postmark",
      ])
    );

    const text = formatStackScan(result, { verbose: true });
    expect(text).toContain("methods: env");
  });

  it("prints unknown package candidates in verbose mode only", () => {
    const root = mkdtempSync(join(tmpdir(), "buyapi-scan-"));
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ dependencies: { "brand-new-ai-sdk": "0.0.1" } })
    );

    expect(formatStackScan(scanStack(root))).not.toContain(
      "Unknown package candidates"
    );
    expect(formatStackScan(scanStack(root), { verbose: true })).toContain(
      "brand-new-ai-sdk@0.0.1"
    );
  });

  it("hides supporting detections unless includeAll is set", () => {
    const root = mkdtempSync(join(tmpdir(), "buyapi-scan-"));
    mkdirSync(join(root, "prisma"));

    expect(scanStack(root).tools.map((tool) => tool.vendorSlug)).not.toContain(
      "/database/neon"
    );
    expect(
      scanStack(root, { includeAll: true }).tools.map((tool) => tool.vendorSlug)
    ).toContain("/database/neon");
  });

  it("detects config and import signals without package manifest matches", () => {
    const root = mkdtempSync(join(tmpdir(), "buyapi-scan-"));
    mkdirSync(join(root, "src"));
    writeFileSync(
      join(root, "next.config.ts"),
      "export default withSentryConfig({});"
    );
    writeFileSync(
      join(root, "src", "analytics.ts"),
      "import posthog from 'posthog-js';\nposthog.init('x');"
    );

    const result = scanStack(root);
    expect(result.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          vendorSlug: "/monitoring/sentry",
          detectionMethods: expect.arrayContaining(["config"]),
        }),
        expect.objectContaining({
          vendorSlug: "/analytics/posthog",
          detectionMethods: expect.arrayContaining(["import"]),
        }),
      ])
    );
    expect(result.filesChecked).toEqual(
      expect.arrayContaining(["next.config.ts", join("src", "analytics.ts")])
    );
  });

  it("tracks framework signals as supporting detections", () => {
    const root = mkdtempSync(join(tmpdir(), "buyapi-scan-"));
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ dependencies: { next: "16.0.0" } })
    );

    expect(scanStack(root).tools.map((tool) => tool.vendorSlug)).not.toContain(
      "/framework/nextjs"
    );
    expect(
      scanStack(root, { includeAll: true }).tools.map((tool) => tool.vendorSlug)
    ).toContain("/framework/nextjs");
  });
});
