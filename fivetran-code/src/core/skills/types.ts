export interface SkillMetadata {
  /** Kebab-case identifier from YAML frontmatter (e.g., "dbt-project-builder"). */
  name: string;
  /** One-line description from YAML frontmatter. */
  description: string;
  /** Absolute path to the skill.md file. */
  filePath: string;
  /** Directory containing the skill. */
  dirPath: string;
  /** True if a references/ subdirectory exists. */
  hasReferences: boolean;
}
