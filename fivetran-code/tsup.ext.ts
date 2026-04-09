import { defineConfig } from "tsup";

export default defineConfig({
  entry: { extension: "src/vscode/extension.ts" },
  format: ["cjs"],
  target: "node18",
  outDir: "dist",
  external: ["vscode"],
  noExternal: [
    "@anthropic-ai/sdk",
    /@anthropic-ai\/.*/,
    "@modelcontextprotocol/sdk",
    /@modelcontextprotocol\/.*/,
    "dotenv",
    "zod",
    "yaml",
    "ajv",
    /ajv.*/,
    "encoding",
  ],
});
