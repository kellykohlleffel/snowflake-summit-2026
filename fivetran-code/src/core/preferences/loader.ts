import { readFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { existsSync } from "fs";

export interface PreferenceContext {
  /** Global preferences from ~/.claude/CLAUDE.md (null if not found). */
  global: string | null;
  /** Project-specific preferences from {projectDir}/CLAUDE.md (null if not found). */
  project: string | null;
}

/**
 * Load Claude Code preference files (CLAUDE.md) from standard locations.
 *
 * These files contain user coding preferences, project conventions,
 * and instructions that should be injected into the system prompt
 * so the agent behaves consistently with Claude Code.
 */
export async function loadPreferences(
  projectDir?: string
): Promise<PreferenceContext> {
  const globalPath = join(homedir(), ".claude", "CLAUDE.md");
  const projectPath = projectDir ? join(projectDir, "CLAUDE.md") : null;

  const [globalContent, projectContent] = await Promise.all([
    readFileSafe(globalPath),
    projectPath ? readFileSafe(projectPath) : Promise.resolve(null),
  ]);

  return {
    global: globalContent,
    project: projectContent,
  };
}

async function readFileSafe(filePath: string): Promise<string | null> {
  if (!existsSync(filePath)) return null;
  try {
    const content = await readFile(filePath, "utf-8");
    return content.trim() || null;
  } catch {
    return null;
  }
}
