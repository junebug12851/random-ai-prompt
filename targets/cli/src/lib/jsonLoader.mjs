/**
 * @file
 * @brief ESM resolve hook that injects the `type: json` import attribute for `.json` specifiers, so
 * the provider adapters' bare JSON imports (e.g. `import defaults from "./openai.json"`) load under
 * plain Node. The web target relies on Vite to transform those imports; the CLI runs the SAME source
 * unmodified in Node, and Node 24 otherwise requires an explicit `with { type: "json" }`. Registered
 * once at startup via `module.register()`. This keeps the CLI in parity with the shared provider code
 * without forking it just to add attributes.
 */

/**
 * Node module-customization `resolve` hook.
 * @param {string} specifier The import specifier.
 * @param {object} context The resolution context.
 * @param {Function} nextResolve The next hook in the chain.
 * @returns {Promise<object>} The resolution result, with `type: json` forced for `.json` modules.
 */
export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  if (result?.url && result.url.endsWith(".json")) {
    return {
      ...result,
      importAttributes: { ...(result.importAttributes || {}), type: "json" },
    };
  }
  return result;
}
