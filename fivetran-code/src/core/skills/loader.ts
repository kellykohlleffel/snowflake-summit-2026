import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import type { SkillMetadata } from "./types.js";

/**
 * Parse YAML frontmatter from a markdown file.
 * Expects content between two `---` lines at the start of the file.
 * Returns extracted key-value pairs, or null if no valid frontmatter found.
 */
function parseFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const fields: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key && value) {
      fields[key] = value;
    }
  }
  return fields;
}

/**
 * Strip YAML frontmatter from markdown content, returning only the body.
 */
export function stripFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
}

/**
 * Scan a single skill directory for a skill.md or SKILL.md file.
 * Returns SkillMetadata if found, null otherwise.
 */
async function loadSkillFromDir(dirPath: string): Promise<SkillMetadata | null> {
  const candidates = ["skill.md", "SKILL.md"];
  for (const filename of candidates) {
    const filePath = join(dirPath, filename);
    if (!existsSync(filePath)) continue;

    try {
      const content = await readFile(filePath, "utf-8");
      const frontmatter = parseFrontmatter(content);
      if (!frontmatter?.name) continue;

      const refsDir = join(dirPath, "references");
      const hasReferences = existsSync(refsDir);

      return {
        name: frontmatter.name,
        description: frontmatter.description ?? "",
        filePath,
        dirPath,
        hasReferences,
      };
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Scan a skills root directory (e.g., ~/.claude/skills/) for all skills.
 * Each subdirectory is expected to contain a skill.md or SKILL.md file.
 */
export async function scanSkillsDirectory(rootDir: string): Promise<SkillMetadata[]> {
  if (!existsSync(rootDir)) return [];

  const skills: SkillMetadata[] = [];
  try {
    const entries = await readdir(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skill = await loadSkillFromDir(join(rootDir, entry.name));
      if (skill) skills.push(skill);
    }
  } catch {
    // Directory not readable — skip silently
  }
  return skills;
}

/**
 * Load the full content of a skill file (body only, no frontmatter).
 * Optionally includes reference files if present.
 */
export async function loadSkillContent(skill: SkillMetadata): Promise<string> {
  const raw = await readFile(skill.filePath, "utf-8");
  let content = stripFrontmatter(raw);

  if (skill.hasReferences) {
    const refsDir = join(skill.dirPath, "references");
    try {
      const refFiles = await readdir(refsDir);
      for (const refFile of refFiles) {
        if (!refFile.endsWith(".md")) continue;
        const refContent = await readFile(join(refsDir, refFile), "utf-8");
        content += `\n\n---\n## Reference: ${refFile}\n\n${refContent}`;
      }
    } catch {
      // References not readable — skip
    }
  }

  return content;
}
