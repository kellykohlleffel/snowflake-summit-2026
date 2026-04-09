import { homedir } from "os";
import { join } from "path";
import type { SkillMetadata } from "./types.js";
import { scanSkillsDirectory, loadSkillContent as loadContent } from "./loader.js";

/** In-memory skill registry. Populated by discoverSkills(). */
let skills: SkillMetadata[] = [];

/**
 * Discover all available skills from standard locations.
 * Scans:
 *   1. ~/.claude/skills/ — personal skills
 *   2. ~/Documents/GitHub/fivetran-se-skills/skills/ — team skills (if exists)
 *
 * Personal skills take priority if names collide with team skills.
 */
export async function discoverSkills(): Promise<void> {
  const home = homedir();
  const personalDir = join(home, ".claude", "skills");
  const teamDir = join(home, "Documents", "GitHub", "fivetran-se-skills", "skills");

  const [personalSkills, teamSkills] = await Promise.all([
    scanSkillsDirectory(personalDir),
    scanSkillsDirectory(teamDir),
  ]);

  // Personal skills override team skills with the same name
  const nameSet = new Set<string>();
  const merged: SkillMetadata[] = [];

  for (const skill of personalSkills) {
    nameSet.add(skill.name);
    merged.push(skill);
  }
  for (const skill of teamSkills) {
    if (!nameSet.has(skill.name)) {
      merged.push(skill);
    }
  }

  skills = merged;
}

/** Get a skill by its name (the slug used in /skill-name). */
export function getSkill(name: string): SkillMetadata | undefined {
  return skills.find((s) => s.name === name);
}

/** Get all discovered skills. */
export function getAllSkills(): SkillMetadata[] {
  return [...skills];
}

/**
 * Load the full markdown content for a skill (body only, frontmatter stripped).
 * Returns null if the skill is not found.
 */
export async function loadSkillContent(name: string): Promise<string | null> {
  const skill = getSkill(name);
  if (!skill) return null;
  return loadContent(skill);
}
