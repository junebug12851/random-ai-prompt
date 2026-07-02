// Stylelint configuration for the web app CSS.
//
// Base is stylelint-config-standard (the same ruleset CodeFactor's CSS engine
// applies). A handful of rules are relaxed below — each is a deliberate,
// documented choice, not a blanket mute:
//
//  - no-descending-specificity: reordering rules to satisfy it risks changing
//    the cascade, and the SPA has committed Playwright visual-regression
//    baselines. The rule is also famously noisy; disabling it is standard
//    practice in mature projects.
//  - property-no-vendor-prefix: the `-webkit-`/`-moz-appearance` prefixes in
//    styles.css are functionally required to hide the native number-input
//    spinners in WebKit and Firefox; they are not redundant.
//  - no-duplicate-selectors: styles.css is intentionally organized by
//    feature/section, so a selector legitimately receives contextual
//    additions in a later section (e.g. `.field-bar` layout up top, then a
//    `position: relative` where a feature needs it). Merging those across
//    ~1000 lines would scatter a feature's styles and risk cascade/visual
//    regressions against the committed baselines, for no real quality gain.
//  - selector-class-pattern: widened to allow camelCase segments so that
//    CodeMirror's own class names (`.cm-selectionBackground`,
//    `.cm-matchingBracket`, `.cm-completionLabel`, …) — which we cannot
//    rename — pass, while still rejecting underscores/leading capitals in our
//    own classes.
export default {
  extends: "stylelint-config-standard",
  ignoreFiles: ["**/node_modules/**", "gui/dist/**", "gui/coverage/**"],
  rules: {
    "no-descending-specificity": null,
    "no-duplicate-selectors": null,
    "property-no-vendor-prefix": null,
    "selector-class-pattern": [
      "^([a-z][a-zA-Z0-9]*)(-[a-zA-Z0-9]+)*$",
      {
        message:
          "Expected class selector to be kebab-case (camelCase segments allowed for third-party class names)",
      },
    ],
  },
};
