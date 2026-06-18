// PLACEHOLDER prompt engine.
//
// Phase 3 of the migration replaces this with the real, browser-safe core: the
// dynamic-prompt / list / expansion pipeline, fed by a Vite `import.meta.glob`
// loader that bundles `dynamic-prompts/**/*.js` (already ESM default exports) and
// the `lists/` + `expansions/` text files. See notes/plans/web-migration.md.
//
// For now this does light, dependency-free work so the UI is wired end to end.

export function generatePrompt(settings) {
  let prompt = settings.prompt || "";

  // Stand-in for #random until the real engine lands.
  prompt = prompt.replaceAll("#random", "a placeholder generated prompt, highly detailed");

  // {salt}: a random number, like the real prompt-salt module.
  prompt = prompt.replaceAll(/\{salt\}/g, () => `[${Math.floor(Math.random() * 9e9 + 1e9)}]`);

  // Cleanup, mirroring the real cleanup stage.
  prompt = prompt
    .replaceAll(/\s+/g, " ")
    .replaceAll(/\s+,/g, ",")
    .replaceAll(/,\s*,/g, ",")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim();

  return prompt;
}

export function generatePrompts(settings) {
  const count = Math.max(1, Number(settings.promptCount) || 1);
  return Array.from({ length: count }, () => generatePrompt(settings));
}
