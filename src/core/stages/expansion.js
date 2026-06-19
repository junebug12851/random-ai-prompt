/**
 * @file
 * @brief core/ port of the <name> stage (loader-injected).
 */

// Expansion stage: `<name>` -> contents of expansions/name.txt.
// Loader-injected port of prompt-modules/expansion.js (no fs); the loader
// supplies the expansion text so the same logic runs in Node and the browser.
export function makeExpansionStage(loader) {
  const loraFind = "<lora:";
  const loraReplacement = "%%lora:";

  return function expansion(prompt, settings) {
    const maxCount = 10;

    // Lora syntax (<lora:name:weight>) collides with expansion syntax; mask it.
    prompt = prompt.replaceAll(loraFind, loraReplacement);

    for (let i = 0; i < maxCount && /<(.*?)>/gm.test(prompt); i++) {
      prompt = prompt.replaceAll(loraFind, loraReplacement);
      prompt = prompt.replaceAll(/<(.*?)>/gm, (match, p1) => {
        const text = loader.readExpansion(p1, settings);
        return text == null ? "" : text;
      });
    }

    prompt = prompt.replaceAll(loraReplacement, loraFind);
    return prompt;
  };
}
