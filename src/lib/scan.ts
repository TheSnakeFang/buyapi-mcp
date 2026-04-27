import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type StackScanTool = {
  vendorSlug: string;
  category: string;
  evidence: string[];
  confidence: "high" | "medium" | "low";
};

export type StackScanResult = {
  root: string;
  tools: StackScanTool[];
  filesChecked: string[];
  warnings: string[];
};

const PACKAGE_RULES: Array<{
  packages: string[];
  vendorSlug: string;
  category: string;
}> = [
  { packages: ["@supabase/supabase-js"], vendorSlug: "/database/supabase", category: "database" },
  { packages: ["convex"], vendorSlug: "/database/convex", category: "database" },
  { packages: ["@neondatabase/serverless"], vendorSlug: "/database/neon", category: "database" },
  { packages: ["firebase"], vendorSlug: "/database/firebase", category: "database" },
  { packages: ["@clerk/nextjs", "@clerk/clerk-react"], vendorSlug: "/auth/clerk", category: "auth" },
  { packages: ["next-auth"], vendorSlug: "/auth/authjs", category: "auth" },
  { packages: ["stripe"], vendorSlug: "/payments/stripe", category: "payments" },
  { packages: ["resend"], vendorSlug: "/email/resend", category: "email" },
  { packages: ["@sendgrid/mail"], vendorSlug: "/email/sendgrid", category: "email" },
  { packages: ["postmark"], vendorSlug: "/email/postmark", category: "email" },
  { packages: ["@vercel/analytics", "@vercel/blob"], vendorSlug: "/hosting/vercel", category: "hosting" },
];

const FILE_RULES: Array<{
  path: string;
  vendorSlug: string;
  category: string;
  label: string;
}> = [
  { path: "convex", vendorSlug: "/database/convex", category: "database", label: "convex directory" },
  { path: "supabase", vendorSlug: "/database/supabase", category: "database", label: "supabase directory" },
  { path: "vercel.json", vendorSlug: "/hosting/vercel", category: "hosting", label: "vercel.json" },
  { path: "netlify.toml", vendorSlug: "/hosting/netlify", category: "hosting", label: "netlify.toml" },
  { path: "fly.toml", vendorSlug: "/hosting/flyio", category: "hosting", label: "fly.toml" },
  { path: "railway.json", vendorSlug: "/hosting/railway", category: "hosting", label: "railway.json" },
  { path: "prisma", vendorSlug: "/database/neon", category: "database", label: "prisma directory (database provider unknown)" },
];

export function scanStack(root = process.cwd()): StackScanResult {
  const filesChecked: string[] = [];
  const warnings: string[] = [];
  const detected = new Map<string, StackScanTool>();

  const packageJsonPath = join(root, "package.json");
  if (existsSync(packageJsonPath)) {
    filesChecked.push("package.json");
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      const deps = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
        ...(pkg.optionalDependencies ?? {}),
      } as Record<string, string>;

      for (const rule of PACKAGE_RULES) {
        const matches = rule.packages.filter((name) => deps[name]);
        if (matches.length > 0) {
          addDetected(detected, {
            vendorSlug: rule.vendorSlug,
            category: rule.category,
            evidence: matches.map((name) => `package:${name}`),
            confidence: "high",
          });
        }
      }
    } catch (error) {
      warnings.push(
        `Could not parse package.json: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  for (const file of [
    "pnpm-lock.yaml",
    "package-lock.json",
    "yarn.lock",
    "bun.lockb",
    ".env.example",
    "next.config.ts",
    "next.config.js",
  ]) {
    if (existsSync(join(root, file))) filesChecked.push(file);
  }

  for (const rule of FILE_RULES) {
    if (existsSync(join(root, rule.path))) {
      filesChecked.push(rule.path);
      addDetected(detected, {
        vendorSlug: rule.vendorSlug,
        category: rule.category,
        evidence: [rule.label],
        confidence: rule.path === "prisma" ? "low" : "medium",
      });
    }
  }

  scanEnvExample(root, detected, filesChecked);

  return {
    root,
    tools: [...detected.values()].sort((a, b) =>
      `${a.category}:${a.vendorSlug}`.localeCompare(`${b.category}:${b.vendorSlug}`)
    ),
    filesChecked: [...new Set(filesChecked)].sort(),
    warnings,
  };
}

export function formatStackScan(result: StackScanResult): string {
  const lines = [
    "BuyAPI stack scan",
    `Root: ${result.root}`,
    "",
    `Files checked: ${result.filesChecked.length ? result.filesChecked.join(", ") : "none"}`,
    "",
  ];

  if (result.tools.length === 0) {
    lines.push("No known BuyAPI tools detected yet.");
  } else {
    lines.push("Detected tools:");
    for (const tool of result.tools) {
      lines.push(
        `- ${tool.vendorSlug} (${tool.category}, ${tool.confidence}) via ${tool.evidence.join(", ")}`
      );
    }
  }

  if (result.warnings.length > 0) {
    lines.push("", "Warnings:", ...result.warnings.map((warning) => `- ${warning}`));
  }

  lines.push(
    "",
    "This command is local-only. It does not upload your stack or create an account."
  );
  return lines.join("\n");
}

function addDetected(
  detected: Map<string, StackScanTool>,
  next: StackScanTool
) {
  const existing = detected.get(next.vendorSlug);
  if (!existing) {
    detected.set(next.vendorSlug, next);
    return;
  }

  existing.evidence.push(...next.evidence);
  existing.confidence = maxConfidence(existing.confidence, next.confidence);
}

function maxConfidence(
  a: StackScanTool["confidence"],
  b: StackScanTool["confidence"]
): StackScanTool["confidence"] {
  const order: StackScanTool["confidence"][] = ["low", "medium", "high"];
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
}

function scanEnvExample(
  root: string,
  detected: Map<string, StackScanTool>,
  filesChecked: string[]
) {
  const envPath = join(root, ".env.example");
  if (!existsSync(envPath)) return;
  filesChecked.push(".env.example");

  const text = readFileSync(envPath, "utf8");
  const checks: Array<[RegExp, StackScanTool]> = [
    [/SUPABASE_/i, { vendorSlug: "/database/supabase", category: "database", evidence: ["env:SUPABASE_*"], confidence: "medium" }],
    [/CONVEX_/i, { vendorSlug: "/database/convex", category: "database", evidence: ["env:CONVEX_*"], confidence: "medium" }],
    [/CLERK_/i, { vendorSlug: "/auth/clerk", category: "auth", evidence: ["env:CLERK_*"], confidence: "medium" }],
    [/STRIPE_/i, { vendorSlug: "/payments/stripe", category: "payments", evidence: ["env:STRIPE_*"], confidence: "medium" }],
    [/RESEND_/i, { vendorSlug: "/email/resend", category: "email", evidence: ["env:RESEND_*"], confidence: "medium" }],
    [/SENDGRID_/i, { vendorSlug: "/email/sendgrid", category: "email", evidence: ["env:SENDGRID_*"], confidence: "medium" }],
  ];

  for (const [pattern, tool] of checks) {
    if (pattern.test(text)) addDetected(detected, tool);
  }
}

export function listRootFiles(root = process.cwd()): string[] {
  return readdirSync(root).sort();
}
