import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

/**
 * Snowflake connection info extracted from ~/.snowflake/connections.toml.
 * Only safe fields — never includes password/token.
 */
export interface SnowflakeConnectionInfo {
  connectionName: string;
  account: string;
  user: string;
  warehouse: string;
  database: string;
}

/**
 * Read ~/.snowflake/connections.toml and return the default connection's
 * safe fields. Minimal TOML parser — just reads key = "value" lines.
 * Returns null if the file is missing or unparseable.
 */
export function readSnowflakeConnection(): SnowflakeConnectionInfo | null {
  const configPath = join(homedir(), ".snowflake", "connections.toml");
  if (!existsSync(configPath)) return null;

  try {
    const raw = readFileSync(configPath, "utf-8");
    const lines = raw.split("\n");

    // Find default connection name
    let defaultName = "";
    for (const line of lines) {
      const match = line.match(/^default_connection_name\s*=\s*"([^"]+)"/);
      if (match) {
        defaultName = match[1];
        break;
      }
    }
    if (!defaultName) return null;

    // Find the section for the default connection
    const sectionHeader = `[${defaultName}]`;
    let inSection = false;
    const fields: Record<string, string> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === sectionHeader) {
        inSection = true;
        continue;
      }
      if (inSection && trimmed.startsWith("[")) {
        break; // next section
      }
      if (inSection) {
        const kv = trimmed.match(/^(\w+)\s*=\s*"([^"]+)"/);
        if (kv) {
          fields[kv[1]] = kv[2];
        }
      }
    }

    return {
      connectionName: defaultName,
      account: fields.account ?? "",
      user: fields.user ?? "",
      warehouse: fields.warehouse ?? "",
      database: fields.database ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * Count instruction files (CLAUDE.md) that cortex would load.
 * Checks: ~/.claude/CLAUDE.md (global) + CLAUDE.md in CWD (project).
 */
export function countInstructionFiles(cwd?: string): {
  count: number;
  files: string[];
} {
  const files: string[] = [];
  const globalPath = join(homedir(), ".claude", "CLAUDE.md");
  if (existsSync(globalPath)) files.push("~/.claude/CLAUDE.md");

  if (cwd) {
    const projectPath = join(cwd, "CLAUDE.md");
    if (existsSync(projectPath)) files.push("CLAUDE.md (project)");
  }

  return { count: files.length, files };
}
