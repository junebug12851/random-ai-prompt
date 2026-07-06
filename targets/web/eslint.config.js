// Focused, gui-scoped ESLint flat config. The repo-root config intentionally
// ignores gui/** (the SPA was never under the Node lint surface), so this config
// runs ONLY the FormatJS i18n rule over the SPA source — it does not pull in
// js.recommended, so it won't flood pre-existing gui code with unrelated warnings.
// Run it with `npm run lint:i18n`.
import formatjs from "eslint-plugin-formatjs";

// The SPA source carries `// eslint-disable-next-line react-hooks/exhaustive-deps`
// directives intended for a future full React lint pass. Register that rule name as
// a no-op so those directives resolve here instead of erroring as "rule not found".
const noop = { create: () => ({}) };

export default [
  {
    ignores: ["dist/**", "node_modules/**", "frontend/i18n/compiled/**", "**/*.test.{js,jsx}"],
  },
  {
    files: ["frontend/**/*.{js,jsx}"],
    // The react-hooks directives are real (for a future React lint pass); since our stub
    // rule never reports, don't flag those directives as "unused" here.
    linterOptions: { reportUnusedDisableDirectives: "off" },
    plugins: {
      formatjs,
      "react-hooks": { rules: { "exhaustive-deps": noop, "rules-of-hooks": noop } },
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Every defined message must carry a literal defaultMessage (the English source) —
      // the guard that keeps the extract → compile → catalog pipeline well-formed.
      "formatjs/enforce-default-message": ["error", "literal"],
    },
  },
];
