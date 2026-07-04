/**
 * @file Pure roll-assembly for a "generate" action, extracted from the Home component so the loop,
 * wrapper framing, seed-forking, and Auto-Begin/End folding are unit-testable without React or the
 * engine. The component keeps only the React state updates around it. See gui/tests/lib/buildRoll.test.js.
 */
import { pickRollSeed, forkRollSeed } from "./seed.js";

// The per-roll prompt ceiling — mirrors the `max` on the Home prompt-count input. Enforced here too so
// the helper is the single source of truth and can't be driven past it by stale/shared settings.
const MAX_PROMPTS = 50;

/**
 * Assemble one roll: frame `text` with the active wrapper, generate `settings.promptCount` prompts
 * (each forking the roll's base seed so the batch differs yet stays reproducible), and fold each
 * fired block's Auto Begin / Auto End into the prompt's start / end when auto-sections are on.
 * @param {object} args
 * @param {object} args.settings Generation settings (`promptCount`, `useAutoSections`, seed fields…).
 * @param {string} args.text The chosen prompt text (already resolved to the box / suggestion / fallback).
 * @param {{start: string, end: string}} args.wrapper The active wrapper's start/end DPL.
 * @param {string} args.mode The provider dialect.
 * @param {object} args.deps Injected side-effect-free collaborators.
 * @param {(part: string, settings: object) => string} args.deps.renderWrapperPart Render a wrapper part.
 * @param {(settings: object, seed: string) => string} args.deps.generatePrompt Generate one prompt.
 * @param {() => (number|string)} args.deps.nextId Fresh row id.
 * @param {() => string} [args.deps.mintSeed] Seed generator (for a random roll); test-injectable.
 * @returns {{prompts: object[], rollSeed: string}} The built prompt rows (newest-first caller prepends)
 *   and the base seed the roll used (to reflect back into the seed box).
 */
export function buildRoll({ settings, text, wrapper, mode, deps }) {
  const { renderWrapperPart, generatePrompt, nextId, mintSeed } = deps;
  // Clamp to an integer in [1, MAX_PROMPTS] — the same ceiling the UI input enforces — so a stale or
  // shared-link `promptCount` that is fractional or oversized can't spin an excessive synchronous loop.
  const count = Math.min(MAX_PROMPTS, Math.max(1, Math.floor(Number(settings.promptCount)) || 1));
  const rollSeed = pickRollSeed(settings, mintSeed);
  // Whether blocks may contribute their own Auto Begin / Auto End framing (default on).
  const useAuto = settings.useAutoSections !== false;
  const prompts = [];
  for (let i = 0; i < count; i++) {
    const wrapped = [renderWrapperPart(wrapper.start, settings), text, renderWrapperPart(wrapper.end, settings)]
      .map((s) => (s || "").trim())
      .filter(Boolean)
      .join(", ");
    const sink = { begin: [], end: [] };
    const result = generatePrompt(
      { ...settings, mode, prompt: wrapped, autoSink: useAuto ? sink : null },
      forkRollSeed(rollSeed, i),
    );
    const framed = useAuto
      ? [sink.begin.join(", "), result, sink.end.join(", ")]
          .map((s) => s.trim())
          .filter(Boolean)
          .join(", ")
      : result;
    prompts.push({ id: nextId(), text: framed, dpl: text, batches: [] });
  }
  return { prompts, rollSeed };
}
