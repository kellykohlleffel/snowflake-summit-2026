/**
 * Branding constants for Cortex Code for VSCode.
 * Snowflake-branded colors, labels, and icons.
 */
export const BRAND = {
  /** package.json displayName + marketplace entry */
  displayName: "Cortex Code for VSCode",
  /** What the user sees in the panel header (no "for VSCode" suffix — redundant inside VSCode) */
  headerLabel: "Cortex Code",
  /** Snowflake brand blue */
  primaryColor: "#29B5E8",
  /** Accent used for highlights and borders */
  accentColor: "#00A1C9",
  /** Activity bar icon filename (relative to images/) */
  activityBarIcon: "snowflake-activity-bar.svg",
  /** Footer label when session is running */
  footerName: "Cortex Code for VSCode",
} as const;
