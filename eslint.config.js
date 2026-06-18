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
      "web/frontend/lib/**",
      "user-settings.json",
      "results.json",
    ],
  },

  js.configs.recommended,

  // Node-side ES modules (CLI, server, helpers, prompt logic).
  {
    files: ["**/*.js"],
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
    },
  },

  // Browser scripts served to the page. These are classic multi-<script> files
  // that intentionally share globals (jQuery, lodash, and helpers defined in
  // sibling files), so the module-oriented "undefined/redeclare" rules don't
  // apply. Linted loosely here; they are not part of the Node ES-module code.
  {
    files: ["web/frontend/**/*.js"],
    ignores: ["web/frontend/lib/**"],
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
