import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { execFile } from "child_process";
import { join } from "path";

/**
 * Skill category as reported by `cortex skill list`.
 *
 *   - "project": personal skills in ~/.claude/skills/ (cortex labels this [PROJECT])
 *   - "bundled": skills that ship with cortex itself in ~/.local/share/cortex/<version>/bundled_skills/
 *   - "plugin":  skills provided by installed plugins (e.g., Astronomer Airflow)
 *   - "remote":  skills pulled from a remote git repo via `cortex skill add <owner/repo>`
 *   - "stage":   skills stored in a Snowflake stage via `cortex skill add @STAGE/path`
 */
export type SkillCategory = "project" | "bundled" | "plugin" | "remote" | "stage";

export interface DiscoveredSkill {
  name: string;
  description: string;
  category: SkillCategory;
}

/**
 * Enumerate all skills cortex has access to by running `cortex skill list`
 * as a one-shot subprocess and parsing its output.
 *
 * The output format is:
 *
 *   Discovered skills:
 *
 *     [PROJECT]
 *       - skill-name: /absolute/path/to/skill
 *       - another-skill: /absolute/path
 *
 *     [BUNDLED]
 *       - skill-name: /absolute/path
 *
 *     [PLUGIN]
 *       - skill-name: /absolute/path
 *
 * We parse line-by-line: lines like `  [CATEGORY]` switch the current
 * category, and lines like `    - name: path` add an entry to the list.
 *
 * After collecting the full list, we read each skill's SKILL.md file to
 * extract the `description:` field from its YAML frontmatter. Skills
 * without a SKILL.md or with unparseable frontmatter get an empty
 * description (still listed, just no detail in the menu).
 *
 * Returns an empty array if the cortex binary isn't found or the command
 * fails. This is a best-effort operation — if it fails, the slash menu
 * just shows an empty Skills section.
 */
export async function discoverAllSkills(cortexBinary: string): Promise<DiscoveredSkill[]> {
  const listOutput = await runSkillList(cortexBinary);
  if (!listOutput) {
    return [];
  }

  // Parse the text output into { name, path, category } tuples.
  // We only care about the "Discovered skills:" section — everything above
  // it (Persisted / Remote / Stage directories) is configuration metadata,
  // not runnable skills.
  const lines = listOutput.split("\n");
  let inDiscovered = false;
  let currentCategory: SkillCategory | null = null;
  const entries: Array<{ name: string; path: string; category: SkillCategory }> = [];

  for (const line of lines) {
    if (line.startsWith("Discovered skills:")) {
      inDiscovered = true;
      continue;
    }
    if (!inDiscovered) continue;

    // Category header like "  [PROJECT]" or "  [BUNDLED]"
    const catMatch = line.match(/^\s*\[([A-Z]+)\]\s*$/);
    if (catMatch) {
      const label = (catMatch[1] ?? "").toLowerCase();
      if (
        label === "project" ||
        label === "bundled" ||
        label === "plugin" ||
        label === "remote" ||
        label === "stage"
      ) {
        currentCategory = label as SkillCategory;
      } else {
        currentCategory = null;
      }
      continue;
    }

    // Skill entry like "    - skill-name: /absolute/path"
    const entryMatch = line.match(/^\s*-\s*([^:]+):\s*(.+)$/);
    if (entryMatch && currentCategory) {
      const name = (entryMatch[1] ?? "").trim();
      const path = (entryMatch[2] ?? "").trim();
      if (name && path) {
        entries.push({ name, path, category: currentCategory });
      }
    }
  }

  // Read descriptions from each skill's SKILL.md file in parallel.
  // We batch-resolve all promises; individual failures fall through with
  // an empty description.
  const skills = await Promise.all(
    entries.map(async (entry) => {
      const description = await readSkillDescription(entry.path);
      return {
        name: entry.name,
        description,
        category: entry.category,
      };
    })
  );

  // Sort within each category by name for a stable menu order.
  skills.sort((a, b) => {
    if (a.category !== b.category) {
      return categoryOrder(a.category) - categoryOrder(b.category);
    }
    return a.name.localeCompare(b.name);
  });

  return skills;
}

/** Preferred display order for categories in the slash menu. */
function categoryOrder(cat: SkillCategory): number {
  switch (cat) {
    case "project":
      return 0;
    case "plugin":
      return 1;
    case "bundled":
      return 2;
    case "remote":
      return 3;
    case "stage":
      return 4;
  }
}

/**
 * Run `cortex skill list` and return the stdout as a single string, or
 * null if the command fails (binary missing, non-zero exit, timeout).
 */
function runSkillList(binary: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      execFile(
        binary,
        ["skill", "list"],
        { timeout: 10_000, maxBuffer: 1024 * 1024 },
        (err, stdout) => {
          if (err) {
            resolve(null);
            return;
          }
          resolve(stdout);
        }
      );
    } catch {
      resolve(null);
    }
  });
}

/**
 * Read a skill's SKILL.md file and extract the `description:` field from
 * its YAML frontmatter. Returns an empty string if not found.
 */
async function readSkillDescription(skillPath: string): Promise<string> {
  const skillMdPath = join(skillPath, "SKILL.md");
  if (!existsSync(skillMdPath)) {
    return "";
  }
  try {
    const content = await readFile(skillMdPath, "utf-8");
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return "";
    const frontmatter = match[1] ?? "";
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (!descMatch) return "";
    let description = (descMatch[1] ?? "").trim();
    description = description.replace(/^["']|["']$/g, "");
    if (description.length > 140) {
      description = description.slice(0, 137) + "...";
    }
    return description;
  } catch {
    return "";
  }
}
