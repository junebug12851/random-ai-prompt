/**
 * @file
 * @brief The `list` command — browse the catalog the way the GUI's pickers do: building blocks,
 * word lists, providers, presets, dialects, SD samplers, and the effective settings.
 */
import fs from "node:fs";
import path from "node:path";
import { c, say } from "../lib/colors.js";
import { printJson, section, table } from "../lib/format.js";
import { blockTokens, pickerLists } from "../lib/engine.js";
import { allProviders, DIALECTS } from "../lib/providers.js";
import { presetNames, loadPreset } from "../lib/presets.js";
import { effectiveSettings } from "../lib/settings.js";
import { WEB_ROOT } from "../lib/paths.js";

const WHAT = ["blocks", "lists", "providers", "presets", "dialects", "samplers", "settings"];

/**
 * Register the `list` command.
 * @param {import("commander").Command} program The program.
 * @returns {void}
 */
export default function registerList(program) {
  program
    .command("list")
    .alias("ls")
    .description(`Browse the catalog (${WHAT.join(", ")})`)
    .argument("[what]", `What to list: ${WHAT.join(" | ")}`, "settings")
    .argument("[filter]", "Optional substring filter (blocks/lists)")
    .option("--nsfw", "Include adult/NSFW names")
    .action(async (what, filter, opts, command) => {
      const json = command.optsWithGlobals().json;
      if (!WHAT.includes(what)) {
        say("err", `Unknown list "${what}". Choose one of: ${WHAT.join(", ")}`);
        process.exitCode = 1;
        return;
      }
      const handlers = { blocks, lists, providers, presets, dialects, samplers, settings };
      await handlers[what]({ json, filter, opts });
    });
}

/**
 * @param {string[]} names The names.
 * @param {string} [filter] A case-insensitive substring filter.
 * @returns {string[]} Filtered names.
 */
const applyFilter = (names, filter) =>
  filter ? names.filter((n) => n.toLowerCase().includes(String(filter).toLowerCase())) : names;

async function blocks({ json, filter, opts }) {
  const s = effectiveSettings({ overrides: { includeAdult: !!opts.nsfw } });
  // engine.setActiveSettings is applied inside blockTokens via boot; set adult first.
  const { setActiveSettings } = await import("../lib/engine.js");
  setActiveSettings(s);
  const names = applyFilter(blockTokens().sort(), filter);
  if (json) return printJson(names);
  section(`Blocks (${names.length})`, chunkRows(names.map((n) => `{#${n}}`)));
}

async function lists({ json, filter, opts }) {
  const s = effectiveSettings({ overrides: { includeAdult: !!opts.nsfw } });
  const { setActiveSettings } = await import("../lib/engine.js");
  setActiveSettings(s);
  const names = applyFilter(pickerLists().sort(), filter);
  if (json) return printJson(names);
  section(`Lists (${names.length})`, chunkRows(names.map((n) => `{${n}}`)));
}

async function providers({ json }) {
  const list = await allProviders();
  if (json) {
    return printJson(
      list.map((p) => ({
        id: p.id,
        label: p.label,
        tier: p.tier,
        dialect: p.dialect,
        transport: p.transport,
        local: !!p.local,
        needsKey: !!p.needsKey,
      })),
    );
  }
  const rows = list.map((p) => [
    c.key(p.id),
    p.label,
    p.tier === "api" ? c.ok("image") : c.muted("copy"),
    p.dialect,
    p.needsKey ? c.warn("key") : c.muted("—"),
    p.local ? "local" : p.transport,
  ]);
  console.log(c.heading(`Providers (${list.length})`));
  console.log(
    table(rows, { head: ["id", "label", "kind", "dialect", "key", "transport"], indent: 2 }),
  );
  console.log("");
}

async function presets({ json }) {
  const names = presetNames();
  if (json) return printJson(names.map((n) => ({ name: n, preset: loadPreset(n) })));
  const rows = names.map((n) => {
    const p = loadPreset(n) || {};
    const bits = [];
    if (p.imageSettings?.width)
      bits.push(`${p.imageSettings.width}×${p.imageSettings.height || "?"}`);
    if (p.settings?.upscaleImages) bits.push("upscale");
    if (p.imageSettings?.negativePrompt) bits.push("negative");
    return [c.key(n), c.muted(bits.join(", "))];
  });
  console.log(c.heading(`Presets (${names.length})`));
  console.log(table(rows, { indent: 2 }));
  console.log("");
}

async function dialects({ json }) {
  const list = Object.values(DIALECTS);
  if (json) return printJson(list);
  const rows = list.map((d) => [c.key(d.id), d.label, c.muted(d.emphasis)]);
  console.log(c.heading("Dialects"));
  console.log(table(rows, { head: ["id", "label", "emphasis"], indent: 2 }));
  console.log("");
}

async function samplers({ json }) {
  const p = path.join(WEB_ROOT, "shared", "local-webui", "data", "samplers.json");
  let names;
  try {
    names = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    names = [];
  }
  if (json) return printJson(names);
  section(`SD samplers (${names.length})`, chunkRows(names));
}

async function settings({ json }) {
  const s = effectiveSettings();
  const { keys: _drop, providerParams: _pp, ...rest } = s;
  if (json) return printJson(rest);
  const rows = Object.entries(rest)
    .filter(([, v]) => typeof v !== "object")
    .map(([k, v]) => [c.key(k), c.value(String(v))]);
  console.log(c.heading("Effective settings"));
  console.log(table(rows, { indent: 2 }));
  console.log(
    c.muted(
      "\nOverride any of these with flags on `rap generate`, or persist with `rap config set`.",
    ),
  );
}

/**
 * Lay a flat list of names into aligned multi-column rows for compact display.
 * @param {string[]} items The items.
 * @param {number} [cols=3] Columns.
 * @returns {string[][]} Rows.
 */
function chunkRows(items, cols = 3) {
  const rows = [];
  for (let i = 0; i < items.length; i += cols)
    rows.push(items.slice(i, i + cols).map((x) => c.value(x)));
  return rows;
}
