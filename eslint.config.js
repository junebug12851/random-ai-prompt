// Flat ESLint config (ESLint 9+).
// Server-side code is ES modules on Node 24; the browser code under web/frontend
// is classic <script> code and is linted with browser globals instead.
import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "node_modules/**",
      "output/**",
      "docs/**",
      "tmp/**",
      // Test artifacts (coverage reports, Playwright runs/snapshots).
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "tests/e2e/**/*-snapshots/**",
      // assets/ is local-only reference material (e.g. the pinned pre-revival
      // source snapshot) — gitignored and never a build/lint input.
      "assets/**",
      "src/web/frontend/lib/**",
      "gui/**",
      "user-settings.json",
      "results.json",
    ],
  },

  js.configs.recommended,

  // Node-side ES modules (CLI, server, helpers, prompt logic, scripts/*.mjs).
  {
    files: ["**/*.js", "**/*.mjs"],
    ignores: ["web/frontend/**"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      // Pre-existing patterns in the hand-written prompt/data files. Flagged so
      // they stay visible, but kept as warnings: "fixing" a regex escape or a
      // duplicate else-if branch in the creative prompt generators risks
      // changing the prompts they produce. Tracked in notes/plans/next-steps.md.
      "no-useless-escape": "warn",
      "no-dupe-else-if": "warn",
      // ESLint 10 promoted no-useless-assignment into eslint:recommended. It
      // flags benign init-then-overwrite patterns in the hand-written server
      // code (e.g. `let command = ""` before a switch, `let ret = {}` before a
      // later assign). Kept as a warning, not an error, to stay behavior-neutral
      // and consistent with the rules above. Tracked in notes/plans/next-steps.md.
      "no-useless-assignment": "warn",
    },
  },

  // Browser scripts served to the page. These are classic multi-<script> files
  // that intentionally share globals (jQuery, lodash, and helpers defined in
  // sibling files), so the module-oriented "undefined/redeclare" rules don't
  // apply. Linted loosely here; they are not part of the Node ES-module code.
  {
    files: ["src/web/frontend/**/*.js"],
    ignores: ["src/web/frontend/lib/**"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.jquery,
        _: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-redeclare": "off",
      "no-global-assign": "off",
      "no-empty": "off",
    },
  },

  prettier,
];
