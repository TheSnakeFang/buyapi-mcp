import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type StackScanTool = {
  vendorSlug: string;
  category: string;
  evidence: string[];
  detectionMethods: Array<"file" | "manifest" | "env" | "config">;
  confidence: "high" | "medium" | "low";
  primary: boolean;
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
  primary?: boolean;
}> = [
  { packages: ["@supabase/supabase-js"], vendorSlug: "/database/supabase", category: "database" },
  { packages: ["convex"], vendorSlug: "/database/convex", category: "database" },
  { packages: ["@neondatabase/serverless"], vendorSlug: "/database/neon", category: "database" },
  { packages: ["firebase"], vendorSlug: "/database/firebase", category: "database" },
  { packages: ["@clerk/nextjs", "@clerk/clerk-react"], vendorSlug: "/auth/clerk", category: "auth" },
  { packages: ["next-auth", "@auth/core", "@auth/nextjs"], vendorSlug: "/auth/authjs", category: "auth" },
  { packages: ["auth0", "@auth0/nextjs-auth0", "@auth0/auth0-react"], vendorSlug: "/auth/auth0", category: "auth" },
  { packages: ["stripe"], vendorSlug: "/payments/stripe", category: "payments" },
  { packages: ["@lemonsqueezy/lemonsqueezy.js"], vendorSlug: "/payments/lemonsqueezy", category: "payments" },
  { packages: ["@paddle/paddle-js"], vendorSlug: "/payments/paddle", category: "payments" },
  { packages: ["react-native-purchases"], vendorSlug: "/payments/revenuecat", category: "payments" },
  { packages: ["resend"], vendorSlug: "/email/resend", category: "email" },
  { packages: ["@sendgrid/mail"], vendorSlug: "/email/sendgrid", category: "email" },
  { packages: ["postmark"], vendorSlug: "/email/postmark", category: "email" },
  { packages: ["@aws-sdk/client-ses", "aws-sdk"], vendorSlug: "/email/ses", category: "email", primary: false },
  { packages: ["@vercel/analytics", "@vercel/blob"], vendorSlug: "/hosting/vercel", category: "hosting" },
];

const FILE_RULES: Array<{
  path: string;
  vendorSlug: string;
  category: string;
  label: string;
  primary?: boolean;
}> = [
  { path: "convex", vendorSlug: "/database/convex", category: "database", label: "convex directory" },
  { path: "supabase", vendorSlug: "/database/supabase", category: "database", label: "supabase directory" },
  { path: "vercel.json", vendorSlug: "/hosting/vercel", category: "hosting", label: "vercel.json" },
  { path: "netlify.toml", vendorSlug: "/hosting/netlify", category: "hosting", label: "netlify.toml" },
  { path: "fly.toml", vendorSlug: "/hosting/flyio", category: "hosting", label: "fly.toml" },
  { path: "railway.json", vendorSlug: "/hosting/railway", category: "hosting", label: "railway.json" },
  { path: "prisma", vendorSlug: "/database/neon", category: "database", label: "prisma directory (database provider unknown)", primary: false },
];

export function scanStack(
  root = process.cwd(),
  options: { includeAll?: boolean } = {}
): StackScanResult {
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
            detectionMethods: ["manifest"],
            confidence: "high",
            primary: rule.primary ?? true,
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
        detectionMethods: ["file"],
        confidence: rule.path === "prisma" ? "low" : "medium",
        primary: rule.primary ?? true,
      });
    }
  }

  scanEnvExample(root, detected, filesChecked);

  return {
    root,
    tools: [...detected.values()]
      .filter((tool) => options.includeAll || tool.primary)
      .sort((a, b) =>
        `${a.category}:${a.vendorSlug}`.localeCompare(`${b.category}:${b.vendorSlug}`)
      ),
    filesChecked: [...new Set(filesChecked)].sort(),
    warnings,
  };
}

export function formatStackScan(
  result: StackScanResult,
  options: { verbose?: boolean; syncHint?: boolean } = {}
): string {
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
      if (options.verbose) {
        lines.push(
          `  methods: ${tool.detectionMethods.join(", ")} · ${
            tool.primary ? "primary" : "supporting"
          }`
        );
      }
    }
  }

  if (result.warnings.length > 0) {
    lines.push("", "Warnings:", ...result.warnings.map((warning) => `- ${warning}`));
  }

  lines.push(
    "",
    options.syncHint
      ? "Run buyapi scan --sync --yes to save this stack to your BuyAPI dashboard."
      : "This command is local-only. It does not upload your stack or create an account."
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
  existing.detectionMethods = [
    ...new Set([...existing.detectionMethods, ...next.detectionMethods]),
  ];
  existing.primary = existing.primary || next.primary;
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
    [/SUPABASE_/i, envTool("/database/supabase", "database", "SUPABASE_*")],
    [/CONVEX_/i, envTool("/database/convex", "database", "CONVEX_*")],
    [/NEON_/i, envTool("/database/neon", "database", "NEON_*")],
    [/PLANETSCALE_|DATABASE_URL=.*planetscale/i, envTool("/database/planetscale", "database", "PLANETSCALE_*")],
    [/FIREBASE_/i, envTool("/database/firebase", "database", "FIREBASE_*")],
    [/CLERK_/i, envTool("/auth/clerk", "auth", "CLERK_*")],
    [/AUTH0_/i, envTool("/auth/auth0", "auth", "AUTH0_*")],
    [/STRIPE_/i, envTool("/payments/stripe", "payments", "STRIPE_*")],
    [/LEMONSQUEEZY_/i, envTool("/payments/lemonsqueezy", "payments", "LEMONSQUEEZY_*")],
    [/PADDLE_/i, envTool("/payments/paddle", "payments", "PADDLE_*")],
    [/REVENUECAT_/i, envTool("/payments/revenuecat", "payments", "REVENUECAT_*")],
    [/RESEND_/i, envTool("/email/resend", "email", "RESEND_*")],
    [/SENDGRID_/i, envTool("/email/sendgrid", "email", "SENDGRID_*")],
    [/POSTMARK_/i, envTool("/email/postmark", "email", "POSTMARK_*")],
    [/AWS_SES_|SES_/i, envTool("/email/ses", "email", "SES_*")],
  ];

  for (const [pattern, tool] of checks) {
    if (pattern.test(text)) addDetected(detected, tool);
  }
}

function envTool(vendorSlug: string, category: string, label: string): StackScanTool {
  return {
    vendorSlug,
    category,
    evidence: [`env:${label}`],
    detectionMethods: ["env"],
    confidence: "medium",
    primary: true,
  };
}

export function listRootFiles(root = process.cwd()): string[] {
  return readdirSync(root).sort();
}
