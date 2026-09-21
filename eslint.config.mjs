import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored, minified third-party file (a manual copy of
    // pdfjs-dist's build output, served statically) -- not our source.
    "public/pdf.worker.min.mjs",
    // Leftover isolated-agent worktrees (full duplicate source trees,
    // including their own copy of the file above) -- gitignored, not
    // part of this project's own source, but not excluded here before,
    // so a full `npm run lint` was scanning every duplicate too.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
