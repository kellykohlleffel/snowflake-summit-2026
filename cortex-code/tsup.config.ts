import { defineConfig } from "tsup";

/**
 * Single-entry build: bundles src/extension.ts (and everything it imports) into
 * dist/extension.cjs as a CommonJS module for VSCode.
 *
 * VSIX self-containment: tsup auto-externalizes any package listed in
 * package.json's "dependencies" by default. We explicitly INLINE @anthropic-ai/sdk
 * via noExternal so the VSIX is fully self-contained -- no runtime require()
 * lookup against node_modules, which vsce's dependency walker has historically
 * failed to pack reliably (lab laptop 1, 2026-04-29: VSIX installed but extension
 * activation failed with "Cannot find module '@anthropic-ai/sdk'").
 */
export default defineConfig({
  entry: { extension: "src/extension.ts" },
  format: ["cjs"],
  target: "node18",
  outDir: "dist",
  // `vscode` is provided by the extension host -- never bundle.
  external: ["vscode"],
  // Bundle the Anthropic SDK (and its transitive deps) directly into
  // extension.cjs so the VSIX has zero runtime dependency on node_modules.
  noExternal: ["@anthropic-ai/sdk"],
  sourcemap: true,
  clean: true,
});
