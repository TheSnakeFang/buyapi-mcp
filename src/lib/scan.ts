import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

type DetectionMethod = "file" | "manifest" | "env" | "config" | "import" | "framework";

export type StackScanTool = {
  vendorSlug: string;
  category: string;
  evidence: string[];
  detectionMethods: DetectionMethod[];
  confidence: "high" | "medium" | "low";
  primary: boolean;
};

export type StackScanUnknownDependency = {
  packageName: string;
  version: string;
  dependencyType: "dependencies" | "devDependencies" | "optionalDependencies";
  evidence: string[];
};

export type StackScanResult = {
  root: string;
  tools: StackScanTool[];
  unknownDependencies: StackScanUnknownDependency[];
  filesChecked: string[];
  warnings: string[];
};

const PACKAGE_RULES: Array<{
  packages: string[];
  vendorSlug: string;
  category: string;
  primary?: boolean;
  method?: DetectionMethod;
}> = [
  { packages: ["@supabase/supabase-js"], vendorSlug: "/database/supabase", category: "database" },
  { packages: ["convex"], vendorSlug: "/database/convex", category: "database" },
  { packages: ["@neondatabase/serverless"], vendorSlug: "/database/neon", category: "database" },
  { packages: ["@planetscale/database"], vendorSlug: "/database/planetscale", category: "database" },
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
  { packages: ["posthog-js", "posthog-node"], vendorSlug: "/analytics/posthog", category: "analytics" },
  { packages: ["@sentry/nextjs", "@sentry/node"], vendorSlug: "/monitoring/sentry", category: "monitoring" },
  { packages: ["next"], vendorSlug: "/framework/nextjs", category: "framework", method: "framework", primary: false },
  { packages: ["vite"], vendorSlug: "/framework/vite", category: "framework", method: "framework", primary: false },
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
  { path: "convex/schema.ts", vendorSlug: "/database/convex", category: "database", label: "convex/schema.ts" },
  { path: "sentry.client.config.ts", vendorSlug: "/monitoring/sentry", category: "monitoring", label: "sentry.client.config.ts" },
  { path: "sentry.server.config.ts", vendorSlug: "/monitoring/sentry", category: "monitoring", label: "sentry.server.config.ts" },
];

const CONFIG_RULES: Array<{
  path: string;
  patterns: Array<{ pattern: RegExp; vendorSlug: string; category: string; label: string; primary?: boolean }>;
}> = [
  {
    path: "next.config.ts",
    patterns: [
      { pattern: /withSentryConfig/i, vendorSlug: "/monitoring/sentry", category: "monitoring", label: "next.config.ts:withSentryConfig" },
    ],
  },
  {
    path: "next.config.js",
    patterns: [
      { pattern: /withSentryConfig/i, vendorSlug: "/monitoring/sentry", category: "monitoring", label: "next.config.js:withSentryConfig" },
    ],
  },
  {
    path: "wrangler.toml",
    patterns: [
      { pattern: /\bname\s*=/i, vendorSlug: "/hosting/cloudflare-workers", category: "hosting", label: "wrangler.toml" },
    ],
  },
];

const IMPORT_RULES: Array<{
  pattern: RegExp;
  vendorSlug: string;
  category: string;
  label: string;
  primary?: boolean;
}> = [
  { pattern: /from\s+["']posthog-js["']|import\s+["']posthog-js["']/i, vendorSlug: "/analytics/posthog", category: "analytics", label: "import:posthog-js" },
  { pattern: /from\s+["']@sentry\/nextjs["']|import\s+["']@sentry\/nextjs["']/i, vendorSlug: "/monitoring/sentry", category: "monitoring", label: "import:@sentry/nextjs" },
  { pattern: /from\s+["']resend["']/i, vendorSlug: "/email/resend", category: "email", label: "import:resend" },
  { pattern: /from\s+["']stripe["']/i, vendorSlug: "/payments/stripe", category: "payments", label: "import:stripe" },
];

export function scanStack(
  root = process.cwd(),
  options: { includeAll?: boolean } = {}
): StackScanResult {
  const filesChecked: string[] = [];
  const warnings: string[] = [];
  const detected = new Map<string, StackScanTool>();
  const unknownDependencies: StackScanUnknownDependency[] = [];

  const packageJsonPath = join(root, "package.json");
  if (existsSync(packageJsonPath)) {
    filesChecked.push("package.json");
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      const dependencyGroups = readDependencyGroups(pkg);
      const deps = Object.fromEntries(
        dependencyGroups.flatMap((group) =>
          Object.entries(group.dependencies).map(([name, version]) => [
            name,
            version,
          ])
        )
      ) as Record<string, string>;
      const matchedPackages = new Set<string>();

      for (const rule of PACKAGE_RULES) {
        const matches = rule.packages.filter((name) => deps[name]);
        if (matches.length > 0) {
          for (const match of matches) matchedPackages.add(match);
          addDetected(detected, {
            vendorSlug: rule.vendorSlug,
            category: rule.category,
            evidence: matches.map((name) => `package:${name}`),
            detectionMethods: [rule.method ?? "manifest"],
            confidence: "high",
            primary: rule.primary ?? true,
          });
        }
      }

      for (const group of dependencyGroups) {
        for (const [packageName, version] of Object.entries(group.dependencies)) {
          if (matchedPackages.has(packageName)) continue;
          unknownDependencies.push({
            packageName,
            version,
            dependencyType: group.type,
            evidence: [`package.json:${group.type}:${packageName}`],
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
  scanConfigFiles(root, detected, filesChecked);
  scanSourceImports(root, detected, filesChecked);

  return {
    root,
    tools: [...detected.values()]
      .filter((tool) => options.includeAll || tool.primary)
      .sort((a, b) =>
        `${a.category}:${a.vendorSlug}`.localeCompare(`${b.category}:${b.vendorSlug}`)
      ),
    unknownDependencies: unknownDependencies.sort((a, b) =>
      a.packageName.localeCompare(b.packageName)
    ),
    filesChecked: [...new Set(filesChecked)].sort(),
    warnings,
  };
}

function scanConfigFiles(
  root: string,
  detected: Map<string, StackScanTool>,
  filesChecked: string[]
) {
  for (const rule of CONFIG_RULES) {
    const filePath = join(root, rule.path);
    if (!existsSync(filePath)) continue;
    filesChecked.push(rule.path);
    const text = safeRead(filePath);
    if (!text) continue;
    for (const check of rule.patterns) {
      if (!check.pattern.test(text)) continue;
      addDetected(detected, {
        vendorSlug: check.vendorSlug,
        category: check.category,
        evidence: [check.label],
        detectionMethods: ["config"],
        confidence: "medium",
        primary: check.primary ?? true,
      });
    }
  }
}

function scanSourceImports(
  root: string,
  detected: Map<string, StackScanTool>,
  filesChecked: string[]
) {
  const files = collectSourceFiles(root);
  for (const relativePath of files) {
    const text = safeRead(join(root, relativePath));
    if (!text) continue;
    let matched = false;
    for (const rule of IMPORT_RULES) {
      if (!rule.pattern.test(text)) continue;
      matched = true;
      addDetected(detected, {
        vendorSlug: rule.vendorSlug,
        category: rule.category,
        evidence: [`${relativePath}:${rule.label}`],
        detectionMethods: ["import"],
        confidence: "medium",
        primary: rule.primary ?? true,
      });
    }
    if (matched) filesChecked.push(relativePath);
  }
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

  if (options.verbose && result.unknownDependencies.length > 0) {
    lines.push("", "Unknown package candidates:");
    for (const dependency of result.unknownDependencies.slice(0, 40)) {
      lines.push(
        `- ${dependency.packageName}@${dependency.version} (${dependency.dependencyType})`
      );
    }
    if (result.unknownDependencies.length > 40) {
      lines.push(`- ...${result.unknownDependencies.length - 40} more`);
    }
  }

  lines.push(
    "",
    options.syncHint
      ? "Run buyapi scan --sync --yes to save this stack to your BuyAPI dashboard."
      : "This command is local-only. It does not upload your stack or create an account."
  );
  return lines.join("\n");
}

function readDependencyGroups(pkg: unknown): Array<{
  type: StackScanUnknownDependency["dependencyType"];
  dependencies: Record<string, string>;
}> {
  const record = pkg as Record<string, unknown>;
  return [
    { type: "dependencies" as const, dependencies: asStringRecord(record.dependencies) },
    { type: "devDependencies" as const, dependencies: asStringRecord(record.devDependencies) },
    {
      type: "optionalDependencies" as const,
      dependencies: asStringRecord(record.optionalDependencies),
    },
  ];
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
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

function collectSourceFiles(root: string): string[] {
  const starts = ["src", "app", "pages", "components", "convex"].filter((path) =>
    existsSync(join(root, path))
  );
  const files: string[] = [];
  const ignored = new Set(["node_modules", ".next", "dist", "build", ".git"]);

  function walk(relativeDir: string) {
    if (files.length >= 200) return;
    const absoluteDir = join(root, relativeDir);
    for (const entry of readdirSync(absoluteDir)) {
      if (ignored.has(entry) || files.length >= 200) continue;
      const relativePath = join(relativeDir, entry);
      const absolutePath = join(root, relativePath);
      const stat = statSync(absolutePath);
      if (stat.isDirectory()) {
        walk(relativePath);
      } else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(entry)) {
        files.push(relativePath);
      }
    }
  }

  for (const start of starts) walk(start);
  return files;
}

function safeRead(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}
