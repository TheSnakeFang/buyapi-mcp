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

export type StackScanContext = {
  languages: string[];
  frameworks: string[];
  runtimes: string[];
  packageManagers: string[];
  testing: string[];
  devWorkflow: string[];
};

export type StackScanResult = {
  root: string;
  repoUrl?: string;
  tools: StackScanTool[];
  context: StackScanContext;
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
];

const PYTHON_PACKAGE_RULES: Array<{
  packages: string[];
  vendorSlug: string;
  category: string;
}> = [
  { packages: ["stripe"], vendorSlug: "/payments/stripe", category: "payments" },
  { packages: ["sentry-sdk"], vendorSlug: "/monitoring/sentry", category: "monitoring" },
  { packages: ["posthog"], vendorSlug: "/analytics/posthog", category: "analytics" },
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
    path: "next.config.mjs",
    patterns: [
      { pattern: /withSentryConfig/i, vendorSlug: "/monitoring/sentry", category: "monitoring", label: "next.config.mjs:withSentryConfig" },
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
  options: { includeAll?: boolean; repoUrl?: string } = {}
): StackScanResult {
  const filesChecked: string[] = [];
  const warnings: string[] = [];
  const detected = new Map<string, StackScanTool>();
  const context = emptyContext();
  const unknownDependencies = new Map<string, StackScanUnknownDependency>();
  const manifestDirs = collectManifestDirs(root, warnings);

  for (const manifestDir of manifestDirs) {
    const packageJsonPath = join(root, manifestDir, "package.json");
    if (!existsSync(packageJsonPath)) continue;
    const packageJsonLabel = scopedPath(manifestDir, "package.json");
    filesChecked.push(packageJsonLabel);
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
      for (const packageName of addPackageContext(deps, context)) {
        matchedPackages.add(packageName);
      }

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
          if (!shouldQueueUnknownDependency(packageName, group.type)) continue;
          upsertUnknownDependency(unknownDependencies, {
            packageName,
            version,
            dependencyType: group.type,
            evidence: [`${packageJsonLabel}:${group.type}:${packageName}`],
          });
        }
      }
    } catch (error) {
      warnings.push(
        `Could not parse ${packageJsonLabel}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  for (const manifestDir of manifestDirs) {
    for (const file of [
      "pnpm-lock.yaml",
      "package-lock.json",
      "yarn.lock",
      "bun.lockb",
      "bun.lock",
      "uv.lock",
      "poetry.lock",
      "Pipfile.lock",
      "next.config.ts",
      "next.config.js",
      "next.config.mjs",
      "tailwind.config.ts",
      "tailwind.config.js",
      "components.json",
    ]) {
      if (existsSync(join(root, manifestDir, file))) {
        filesChecked.push(scopedPath(manifestDir, file));
        addPackageManagerContext(file, context);
        addConfigContext(file, context);
      }
    }

    for (const rule of FILE_RULES) {
      if (existsSync(join(root, manifestDir, rule.path))) {
        filesChecked.push(scopedPath(manifestDir, rule.path));
        addDetected(detected, {
          vendorSlug: rule.vendorSlug,
          category: rule.category,
          evidence: [scopedPath(manifestDir, rule.label)],
          detectionMethods: ["file"],
          confidence: rule.path === "prisma" ? "low" : "medium",
          primary: rule.primary ?? true,
        });
      }
    }

    scanConfigFiles(root, manifestDir, detected, filesChecked);
    scanPythonManifest(root, manifestDir, detected, context, filesChecked, warnings);
    scanOtherLanguageManifests(root, manifestDir, context, filesChecked);
  }

  scanEnvFiles(root, manifestDirs, detected, filesChecked);
  scanSourceImports(root, detected, filesChecked);

  return {
    root,
    repoUrl: options.repoUrl,
    tools: [...detected.values()]
      .filter((tool) => options.includeAll || tool.primary)
      .sort((a, b) =>
        `${a.category}:${a.vendorSlug}`.localeCompare(`${b.category}:${b.vendorSlug}`)
      ),
    context: sortContext(context),
    unknownDependencies: [...unknownDependencies.values()].sort((a, b) =>
      a.packageName.localeCompare(b.packageName)
    ),
    filesChecked: [...new Set(filesChecked)].sort(),
    warnings,
  };
}

function emptyContext(): StackScanContext {
  return {
    languages: [],
    frameworks: [],
    runtimes: [],
    packageManagers: [],
    testing: [],
    devWorkflow: [],
  };
}

function addPackageContext(
  deps: Record<string, string>,
  context: StackScanContext
): string[] {
  const matched: string[] = [];
  const rules: Array<{
    packages: string[];
    bucket: keyof StackScanContext;
    value: string;
  }> = [
    { packages: ["typescript", "ts-node", "tsx"], bucket: "languages", value: "TypeScript" },
    { packages: ["next"], bucket: "frameworks", value: "Next.js" },
    { packages: ["react"], bucket: "frameworks", value: "React" },
    { packages: ["react-native"], bucket: "frameworks", value: "React Native" },
    { packages: ["expo"], bucket: "frameworks", value: "Expo" },
    { packages: ["vue"], bucket: "frameworks", value: "Vue" },
    { packages: ["svelte"], bucket: "frameworks", value: "Svelte" },
    { packages: ["astro"], bucket: "frameworks", value: "Astro" },
    { packages: ["vite"], bucket: "devWorkflow", value: "Vite" },
    { packages: ["vitest", "@vitest/ui"], bucket: "testing", value: "Vitest" },
    { packages: ["jest"], bucket: "testing", value: "Jest" },
    { packages: ["playwright", "@playwright/test"], bucket: "testing", value: "Playwright" },
    { packages: ["cypress"], bucket: "testing", value: "Cypress" },
    { packages: ["eslint"], bucket: "devWorkflow", value: "ESLint" },
    { packages: ["prettier"], bucket: "devWorkflow", value: "Prettier" },
    { packages: ["tailwindcss"], bucket: "devWorkflow", value: "Tailwind CSS" },
    { packages: ["shadcn", "shadcn-ui"], bucket: "devWorkflow", value: "shadcn/ui" },
    { packages: ["@ai-sdk/openai", "openai"], bucket: "devWorkflow", value: "OpenAI SDK" },
    { packages: ["@ai-sdk/anthropic"], bucket: "devWorkflow", value: "Anthropic SDK" },
    { packages: ["@ai-sdk/mcp"], bucket: "devWorkflow", value: "MCP SDK" },
    { packages: ["@anthropic-ai/sdk"], bucket: "devWorkflow", value: "Anthropic SDK" },
    { packages: ["@modelcontextprotocol/sdk"], bucket: "devWorkflow", value: "MCP SDK" },
    { packages: ["ai"], bucket: "devWorkflow", value: "Vercel AI SDK" },
    { packages: ["@trigger.dev/sdk", "@trigger.dev/react"], bucket: "devWorkflow", value: "Trigger.dev" },
    { packages: ["drizzle-orm", "drizzle-kit"], bucket: "devWorkflow", value: "Drizzle ORM" },
    { packages: ["prisma", "@prisma/client"], bucket: "devWorkflow", value: "Prisma" },
  ];

  for (const rule of rules) {
    const packageName = rule.packages.find((name) => deps[name]);
    if (!packageName) continue;
    context[rule.bucket].push(rule.value);
    matched.push(...rule.packages.filter((name) => deps[name]));
  }

  if (Object.keys(deps).some((name) => name.startsWith("@types/"))) {
    context.languages.push("TypeScript");
    matched.push(...Object.keys(deps).filter((name) => name.startsWith("@types/")));
  }

  return matched;
}

function addPackageManagerContext(file: string, context: StackScanContext) {
  if (file === "pnpm-lock.yaml") context.packageManagers.push("pnpm");
  if (file === "package-lock.json") context.packageManagers.push("npm");
  if (file === "yarn.lock") context.packageManagers.push("Yarn");
  if (file === "bun.lockb" || file === "bun.lock") {
    context.packageManagers.push("Bun");
    context.runtimes.push("Bun");
  }
  if (file === "uv.lock") context.packageManagers.push("uv");
  if (file === "poetry.lock") context.packageManagers.push("Poetry");
  if (file === "Pipfile.lock") context.packageManagers.push("Pipenv");
}

function addConfigContext(file: string, context: StackScanContext) {
  if (file.startsWith("next.config.")) context.frameworks.push("Next.js");
  if (file.startsWith("tailwind.config.")) context.devWorkflow.push("Tailwind CSS");
  if (file === "components.json") context.devWorkflow.push("shadcn/ui");
}

function sortContext(context: StackScanContext): StackScanContext {
  return {
    languages: uniqueSorted(context.languages),
    frameworks: uniqueSorted(context.frameworks),
    runtimes: uniqueSorted(context.runtimes),
    packageManagers: uniqueSorted(context.packageManagers),
    testing: uniqueSorted(context.testing),
    devWorkflow: uniqueSorted(context.devWorkflow),
  };
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function scanConfigFiles(
  root: string,
  manifestDir: string,
  detected: Map<string, StackScanTool>,
  filesChecked: string[]
) {
  for (const rule of CONFIG_RULES) {
    const filePath = join(root, manifestDir, rule.path);
    if (!existsSync(filePath)) continue;
    filesChecked.push(scopedPath(manifestDir, rule.path));
    const text = safeRead(filePath);
    if (!text) continue;
    for (const check of rule.patterns) {
      if (!check.pattern.test(text)) continue;
      addDetected(detected, {
        vendorSlug: check.vendorSlug,
        category: check.category,
        evidence: [scopedPath(manifestDir, check.label)],
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

function collectManifestDirs(root: string, warnings: string[]): string[] {
  const dirs = new Set<string>([""]);
  const packageJsonPath = join(root, "package.json");
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
        workspaces?: unknown;
      };
      for (const pattern of packageWorkspacePatterns(pkg.workspaces)) {
        for (const dir of expandWorkspacePattern(root, pattern)) dirs.add(dir);
      }
    } catch {
      // The package parser will report the exact package.json error later.
    }
  }

  const pnpmWorkspacePath = join(root, "pnpm-workspace.yaml");
  if (existsSync(pnpmWorkspacePath)) {
    for (const pattern of parsePnpmWorkspacePatterns(readFileSync(pnpmWorkspacePath, "utf8"))) {
      for (const dir of expandWorkspacePattern(root, pattern)) dirs.add(dir);
    }
  }

  for (const dir of collectNestedManifestDirs(root, warnings)) dirs.add(dir);

  return [...dirs].sort((a, b) => a.localeCompare(b));
}

function packageWorkspacePatterns(workspaces: unknown): string[] {
  if (Array.isArray(workspaces)) {
    return workspaces.filter((item): item is string => typeof item === "string");
  }
  if (workspaces && typeof workspaces === "object") {
    const packages = (workspaces as { packages?: unknown }).packages;
    if (Array.isArray(packages)) {
      return packages.filter((item): item is string => typeof item === "string");
    }
  }
  return [];
}

function parsePnpmWorkspacePatterns(text: string): string[] {
  const patterns: string[] = [];
  let inPackages = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*packages\s*:/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    const match = line.match(/^\s*-\s*['"]?([^'"]+)['"]?\s*$/);
    if (match) patterns.push(match[1]);
    else if (/^\S/.test(line)) break;
  }
  return patterns;
}

function expandWorkspacePattern(root: string, pattern: string): string[] {
  if (pattern.startsWith("!")) return [];
  const clean = pattern.replace(/\/+$/g, "");
  if (!clean.includes("*")) {
    return existsSync(join(root, clean, "package.json")) ? [clean] : [];
  }

  const parts = clean.split("/");
  const starIndex = parts.findIndex((part) => part.includes("*"));
  if (starIndex === -1) return [];
  const base = parts.slice(0, starIndex).join("/");
  const suffix = parts.slice(starIndex + 1).join("/");
  const baseDir = join(root, base);
  if (!existsSync(baseDir)) return [];

  return readdirSync(baseDir)
    .filter((entry) => !entry.startsWith("."))
    .map((entry) => (base ? join(base, entry, suffix) : join(entry, suffix)))
    .filter((dir) => existsSync(join(root, dir, "package.json")));
}

function collectNestedManifestDirs(root: string, warnings: string[]): string[] {
  const dirs: string[] = [];
  const ignored = new Set([
    "node_modules",
    ".next",
    "dist",
    "build",
    ".git",
    ".venv",
    "venv",
    "__pycache__",
  ]);

  function walk(relativeDir: string, depth: number) {
    if (dirs.length >= 60 || depth > 3) return;
    const absoluteDir = join(root, relativeDir);
    let entries: string[];
    try {
      entries = readdirSync(absoluteDir);
    } catch (error) {
      warnings.push(
        `Could not inspect ${relativeDir || "."}: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }

    for (const entry of entries) {
      if (ignored.has(entry) || entry.startsWith(".")) continue;
      const child = relativeDir ? join(relativeDir, entry) : entry;
      const absolute = join(root, child);
      let stat;
      try {
        stat = statSync(absolute);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;
      if (existsSync(join(absolute, "package.json"))) dirs.push(child);
      walk(child, depth + 1);
    }
  }

  walk("", 0);
  return dirs;
}

function scopedPath(scope: string, file: string) {
  return scope ? join(scope, file) : file;
}

function upsertUnknownDependency(
  unknownDependencies: Map<string, StackScanUnknownDependency>,
  next: StackScanUnknownDependency
) {
  const key = next.packageName.toLowerCase();
  const existing = unknownDependencies.get(key);
  if (!existing) {
    unknownDependencies.set(key, next);
    return;
  }

  existing.version = existing.version || next.version;
  existing.evidence = uniqueSorted([...existing.evidence, ...next.evidence]);
}

function shouldQueueUnknownDependency(
  packageName: string,
  dependencyType: StackScanUnknownDependency["dependencyType"]
) {
  const normalized = packageName.toLowerCase();
  if (dependencyType === "devDependencies") return false;

  const ignoredExact = new Set([
    "react",
    "react-dom",
    "next",
    "typescript",
    "tsx",
    "ts-node",
    "vite",
    "vitest",
    "jest",
    "playwright",
    "@playwright/test",
    "cypress",
    "eslint",
    "prettier",
    "tailwindcss",
    "postcss",
    "autoprefixer",
    "lucide-react",
    "clsx",
    "tailwind-merge",
    "class-variance-authority",
    "zod",
    "date-fns",
    "dotenv",
    "simple-icons",
    "tw-animate-css",
    "commander",
    "yargs",
    "chalk",
    "ora",
    "concurrently",
  ]);
  if (ignoredExact.has(normalized)) return false;

  const ignoredPrefixes = [
    "@types/",
    "@eslint/",
    "eslint-",
    "@typescript-eslint/",
    "@vitejs/",
    "@tailwindcss/",
    "@testing-library/",
    "@vitest/",
    "@babel/",
    "babel-",
    "@swc/",
    "@rollup/",
    "rollup",
    "prettier-",
    "@radix-ui/",
    "@base-ui/",
  ];

  return !ignoredPrefixes.some((prefix) => normalized.startsWith(prefix));
}

export function formatStackScan(
  result: StackScanResult,
  options: { verbose?: boolean; syncHint?: boolean; syncing?: boolean } = {}
): string {
  const likelyWrongRoot =
    result.filesChecked.length === 0 &&
    result.tools.length === 0 &&
    result.unknownDependencies.length === 0;
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

  const contextLines = formatContextLines(result.context);
  if (contextLines.length > 0) {
    lines.push("", "Stack context:", ...contextLines);
  }

  if (!options.verbose && result.unknownDependencies.length > 0) {
    lines.push(
      "",
      `Unknown package candidates: ${result.unknownDependencies.length}`,
      "Use --verbose to preview them. Sync queues package names and versions for review."
    );
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

  if (likelyWrongRoot) {
    lines.push(
      "",
      "This does not look like a project root yet.",
      "Run the scan from a folder with package.json, a lockfile, framework config, convex/, prisma/, or source imports.",
      "Examples:",
      "  cd apps/web && npx buyapi scan",
      "  npx buyapi scan /path/to/project"
    );
  }

  lines.push(
    "",
    options.syncing
      ? "Sync requested: this stack will be saved if known BuyAPI tools are detected."
      : options.syncHint
      ? "Run buyapi scan --sync --yes to save this stack to your BuyAPI dashboard."
      : "Local-only: nothing was uploaded. Run buyapi scan --sync to save this private stack."
  );
  return lines.join("\n");
}

function formatContextLines(context: StackScanContext): string[] {
  const groups: Array<[string, string[]]> = [
    ["languages", context.languages],
    ["frameworks", context.frameworks],
    ["runtimes", context.runtimes],
    ["package managers", context.packageManagers],
    ["testing", context.testing],
    ["dev workflow", context.devWorkflow],
  ];

  return groups.flatMap(([label, values]) =>
    values.length > 0 ? [`- ${label}: ${values.join(", ")}`] : []
  );
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

function scanEnvFiles(
  root: string,
  manifestDirs: string[],
  detected: Map<string, StackScanTool>,
  filesChecked: string[]
) {
  const envFiles = collectEnvFiles(root, manifestDirs);
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
    [/SENTRY_/i, envTool("/monitoring/sentry", "monitoring", "SENTRY_*")],
    [/POSTHOG_/i, envTool("/analytics/posthog", "analytics", "POSTHOG_*")],
  ];

  for (const envFile of envFiles) {
    filesChecked.push(envFile);
    const text = readFileSync(join(root, envFile), "utf8");
    for (const [pattern, tool] of checks) {
      if (!pattern.test(text)) continue;
      addDetected(detected, {
        ...tool,
        evidence: tool.evidence.map((item) => `${envFile}:${item}`),
      });
    }
  }
}

function collectEnvFiles(root: string, manifestDirs: string[]): string[] {
  const names = [
    ".env.example",
    ".env.sample",
    ".env.local.example",
    ".env",
    ".env.local",
  ];
  const files = new Set<string>();
  for (const dir of manifestDirs) {
    for (const name of names) {
      const rel = scopedPath(dir, name);
      if (existsSync(join(root, rel))) files.add(rel);
    }
  }
  return [...files].sort((a, b) => a.localeCompare(b));
}

function scanPythonManifest(
  root: string,
  manifestDir: string,
  detected: Map<string, StackScanTool>,
  context: StackScanContext,
  filesChecked: string[],
  warnings: string[]
) {
  const manifests = ["requirements.txt", "pyproject.toml", "Pipfile"];
  const packages = new Set<string>();

  for (const manifest of manifests) {
    const rel = scopedPath(manifestDir, manifest);
    const path = join(root, rel);
    if (!existsSync(path)) continue;
    filesChecked.push(rel);
    context.languages.push("Python");
    if (manifest === "pyproject.toml") context.packageManagers.push("pyproject");
    if (manifest === "Pipfile") context.packageManagers.push("Pipenv");

    const text = safeRead(path);
    if (!text) continue;
    for (const packageName of parsePythonPackages(text, manifest)) {
      packages.add(packageName);
    }
  }

  if (packages.size === 0) return;
  addPythonContext(packages, context);

  for (const rule of PYTHON_PACKAGE_RULES) {
    const matches = rule.packages.filter((packageName) => packages.has(packageName));
    if (matches.length === 0) continue;
    addDetected(detected, {
      vendorSlug: rule.vendorSlug,
      category: rule.category,
      evidence: matches.map((packageName) => `${scopedPath(manifestDir, "python")}:package:${packageName}`),
      detectionMethods: ["manifest"],
      confidence: "high",
      primary: true,
    });
  }

  if (packages.has("openai")) context.devWorkflow.push("OpenAI SDK");
  if (packages.has("anthropic")) context.devWorkflow.push("Anthropic SDK");
  if (packages.has("pytest")) context.testing.push("pytest");
  if (packages.has("ruff")) context.devWorkflow.push("Ruff");
  if (packages.has("mypy")) context.devWorkflow.push("mypy");

  if (packages.size > 500) {
    warnings.push(`${scopedPath(manifestDir, "python")}: more than 500 Python package entries were ignored after context extraction.`);
  }
}

function parsePythonPackages(text: string, manifest: string): string[] {
  if (manifest === "pyproject.toml" || manifest === "Pipfile") {
    return [...text.matchAll(/^\s*["']?([A-Za-z0-9_.-]+)["']?\s*[=~<>]/gm)].map(
      (match) => normalizePythonPackage(match[1])
    );
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+#.*$/, "").trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("-"))
    .map((line) => normalizePythonPackage(line.split(/[<>=~!;[]/)[0]))
    .filter(Boolean);
}

function normalizePythonPackage(value: string) {
  return value.trim().toLowerCase().replace(/_/g, "-");
}

function addPythonContext(packages: Set<string>, context: StackScanContext) {
  if (packages.has("fastapi")) context.frameworks.push("FastAPI");
  if (packages.has("django")) context.frameworks.push("Django");
  if (packages.has("flask")) context.frameworks.push("Flask");
  if (packages.has("pydantic")) context.devWorkflow.push("Pydantic");
  if (packages.has("sqlalchemy")) context.devWorkflow.push("SQLAlchemy");
}

function scanOtherLanguageManifests(
  root: string,
  manifestDir: string,
  context: StackScanContext,
  filesChecked: string[]
) {
  const checks: Array<{
    file: string;
    language: string;
    packageManager?: string;
  }> = [
    { file: "go.mod", language: "Go", packageManager: "Go modules" },
    { file: "Gemfile", language: "Ruby", packageManager: "Bundler" },
    { file: "Cargo.toml", language: "Rust", packageManager: "Cargo" },
  ];

  for (const check of checks) {
    const rel = scopedPath(manifestDir, check.file);
    if (!existsSync(join(root, rel))) continue;
    filesChecked.push(rel);
    context.languages.push(check.language);
    if (check.packageManager) context.packageManagers.push(check.packageManager);
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
  const starts = collectSourceRoots(root);
  const files: string[] = [];
  const ignored = new Set([
    "node_modules",
    ".next",
    "dist",
    "build",
    ".git",
    ".venv",
    "venv",
    "__tests__",
    "tests",
  ]);

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
      } else if (
        /\.(tsx?|jsx?|mjs|cjs)$/.test(entry) &&
        !/\.(test|spec)\.(tsx?|jsx?|mjs|cjs)$/.test(entry)
      ) {
        files.push(relativePath);
      }
    }
  }

  for (const start of starts) walk(start);
  return files;
}

function collectSourceRoots(root: string): string[] {
  const direct = ["src", "app", "pages", "components", "convex"].filter((path) =>
    existsSync(join(root, path))
  );
  const nested: string[] = [];
  for (const base of ["apps", "packages"]) {
    const baseDir = join(root, base);
    if (!existsSync(baseDir)) continue;
    for (const entry of readdirSync(baseDir)) {
      const rel = join(base, entry);
      for (const child of ["src", "app", "pages", "components"]) {
        if (existsSync(join(root, rel, child))) nested.push(join(rel, child));
      }
    }
  }
  return uniqueSorted([...direct, ...nested]);
}

function safeRead(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}
