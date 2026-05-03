import { describe, expect, it } from "vitest";
import { setupSnippet } from "../lib/setup.js";
import { stackSkillContent, stackSkillTargetPath } from "../lib/skill.js";

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

describe("stack skill", () => {
  it("uses /stack as the invocation name", () => {
    const text = stackSkillContent();
    expect(text).toContain("name: stack");
    expect(text).toContain("Stack Decision Record");
    expect(text).toContain("Do not upload source code");
    expect(text).toContain("If not, do not call BuyAPI MCP tools");
    expect(text).toContain("stacks.recommend");
    expect(text).toContain("stackContext");
  });

  it("targets supported personal skill directories", () => {
    expect(stackSkillTargetPath("claude-code")).toContain(
      ".claude/skills/stack/SKILL.md"
    );
    expect(stackSkillTargetPath("codex")).toContain(
      ".codex/skills/stack/SKILL.md"
    );
  });
});
