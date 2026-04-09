import { appendFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { CONFIG_DIR_NAME } from "./constants.js";

const LOG_FILE = join(homedir(), CONFIG_DIR_NAME, "debug.log");
let debugEnabled = false;

export function enableDebugLogging(): void {
  debugEnabled = true;
}

export async function debug(message: string, data?: unknown): Promise<void> {
  if (!debugEnabled) return;
  const timestamp = new Date().toISOString();
  const line = data
    ? `[${timestamp}] ${message} ${JSON.stringify(data)}\n`
    : `[${timestamp}] ${message}\n`;
  try {
    await appendFile(LOG_FILE, line);
  } catch {
    // Silently ignore logging failures
  }
}
