import { defineConfig } from "tsup";

/**
 * Single-entry build: bundles src/extension.ts (and everything it imports) into
 * dist/extension.cjs as a CommonJS module for VSCode. Native node-pty bindings
 * are bundled (noExternal) so the VSIX ships with the precompiled binaries.
 */
export default defineConfig({
  entry: { extension: "src/extension.ts" },
  format: ["cjs"],
  target: "node18",
  outDir: "dist",
  // `vscode` is provided by the extension host — never bundle.
  // `node-pty` has native C++ bindings that break when bundled; keep it
  // external and let Node resolve it from ./node_modules at runtime. The
  // VSIX packaging step (vsce) will automatically include node_modules/
  // dependencies listed in package.json's "dependencies".
  external: ["vscode", "node-pty"],
  sourcemap: true,
  clean: true,
});
