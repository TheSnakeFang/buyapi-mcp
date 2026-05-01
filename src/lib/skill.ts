import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type SkillClient = "claude-code" | "codex";

type SkillInstallResult = {
  client: SkillClient;
  path: string;
  changed: boolean;
  message: string;
};

const STACK_SKILL_NAME = "stack";

const SKILL_PATHS: Record<SkillClient, string> = {
  "claude-code": join(homedir(), ".claude", "skills", STACK_SKILL_NAME, "SKILL.md"),
  codex: join(homedir(), ".codex", "skills", STACK_SKILL_NAME, "SKILL.md"),
};

export const SKILL_CLIENTS: SkillClient[] = ["claude-code", "codex"];

export function stackSkillTargetPath(client: SkillClient): string {
  return SKILL_PATHS[client];
}

export function installStackSkill(client: SkillClient): SkillInstallResult {
  const path = stackSkillTargetPath(client);
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const content = stackSkillContent();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, { mode: 0o600 });
  return {
    client,
    path,
    changed: existing !== content,
    message: `Installed BuyAPI /stack skill for ${client} at ${path}.`,
  };
}

export function stackSkillContent(): string {
  return `---
name: stack
description: Use this when planning, reviewing, or changing a software tech stack. Inspect the repo, use BuyAPI MCP for current vendor data, and produce a sourced Stack Decision Record without uploading repo data unless the user explicitly asks.
---

# Stack Decision Workflow

Use this workflow when the user invokes /stack or asks for stack planning, stack review, vendor selection, replacement options, cost tradeoffs, or repo-aware tech-stack guidance.

## Privacy Rules

- Do not upload source code, file contents, environment values, secrets, or private business data to BuyAPI.
- Local inspection and \`buyapi scan\` are local by default.
- Only run \`buyapi scan --sync\` after the user explicitly asks to save/sync the private stack.
- When calling BuyAPI MCP, pass derived context such as vendor slugs, categories, confidence, languages, frameworks, runtimes, package managers, workload, and constraints.

## Workflow

1. Inspect the repository enough to understand the current stack. Prefer \`npx buyapi scan --json\` when command execution is available; otherwise inspect package/config files directly.
2. Ask for missing decision constraints before making a final call: project stage, target users, budget, team size, compliance, deployment preferences, and existing vendor commitments.
3. Build \`stackContext\` from detected tools and \`stackFacts\` from language/framework/runtime/package-manager context:

\`\`\`json
[
  { "vendorSlug": "/database/convex", "category": "database", "confidence": "high" }
]
\`\`\`

\`\`\`json
{
  "languages": ["TypeScript"],
  "frameworks": ["Next.js", "React"],
  "packageManagers": ["pnpm"],
  "testing": ["Vitest"]
}
\`\`\`

4. Call \`stacks.recommend\` with the project description, constraints, workload, stackContext, and stackFacts.
5. Use \`vendors.compare\`, \`vendors.estimateCost\`, \`vendors.evidence\`, and \`stacks.findSimilar\` when the user needs tradeoffs, cost math, source support, or examples.
6. For implementation docs or exact SDK usage, use first-party docs or the user's preferred documentation tool after the stack decision is made.

## Output

Return a Stack Decision Record:

- Goal
- Current stack detected
- Constraints and assumptions
- Recommendation by layer
- Keep / replace / add decisions
- Cost and scaling triggers
- Evidence and sources used
- Alternatives and tie-breakers
- Unknowns that need human confirmation
- Next implementation steps

Be explicit when BuyAPI coverage is sparse or when evidence is missing. Do not present live guesses as reviewed BuyAPI data.
`;
}
