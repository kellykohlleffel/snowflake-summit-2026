import { defineConfig } from "tsup";

export default defineConfig({
  entry: { "mcp-server": "src/mcp/server.ts" },
  format: ["esm"],
  target: "node18",
  outDir: "dist",
});
