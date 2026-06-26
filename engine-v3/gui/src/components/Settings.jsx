/**
 * The Settings form. The "Generation backend" section is **capability-driven**: it renders
 * the selected provider's own settings schema (each provider owns its knobs), stores those
 * knobs under a per-provider namespace (`providerParams[id]`) so switching providers never
 * clobbers another's values, and sets the engine `mode` from the provider's dialect (there
 * is no standalone "Mode" control). The remaining groups are engine/prompt knobs shared by
 * all providers.
 * @module gui/components/Settings
 */
import { useEffect } from "react";
import { Text, Num, Toggle, Select, Group } from "./Field.jsx";
import { getListNames } from "../lib/promptEngine.js";
import { availableProviders, getProvider } from "../lib/providers/index.js";
import { useProviderSettings, providerMode } from "../lib/useProvider.js";
import { defaultSettings } from "../lib/settings.js";

// Source-list options: every list, plus "false" meaning fully random.
const listOptions = [{ value: "false", label: "(fully random)" }, ...getListNames()];

/**
 * Render one capability-driven provider field bound to the per-provider param namespace.
 * @param {object} f The field descriptor (`{ key, label, type, min, max, step, options, optionsFrom }`).
 * @param {object} params The active provider's params.
 * @param {Function} setParam `(key, value) => void`.
 * @param {object} optionData Resolved option-data lists (by `optionsFrom` key).
 * @returns {JSX.Element}
 */
function ProviderField({ f, params, setParam, optionData }) {
  const v = params[f.key];
  if (f.type === "checkbox") {
    return <Toggle key={f.key} label={f.label} value={v} onChange={(x) => setParam(f.key, x)} />;
  }
  if (f.type === "select") {
    const options = f.options || optionData[f.optionsFrom] || [];
    return (
      <Select
        key={f.key}
        label={f.label}
        value={v ?? ""}
        options={options}
        onChange={(x) => setParam(f.key, x)}
      />
    );
  }
  if (f.type === "number") {
    return (
      <Num
        key={f.key}
        label={f.label}
        value={v}
        min={f.min}
        max={f.max}
        step={f.step}
        onChange={(x) => setParam(f.key, x)}
      />
    );
  }
  return <Text key={f.key} label={f.label} value={v} onChange={(x) => setParam(f.key, x)} />;
}

/**
 * The full settings form.
 * @param {object} props
 * @param {object} props.settings The current settings.
 * @param {Function} props.setSettings Update the settings.
 * @returns {JSX.Element}
 */
export default function Settings({ settings, setSettings }) {
  const set = (patch) => setSettings({ ...settings, ...patch });
  const setKey = (id, value) =>
    setSettings({ ...settings, keys: { ...settings.keys, [id]: value } });

  const provider = getProvider(settings.provider);
  const pid = provider?.id;
  const { schema, options } = useProviderSettings(pid);
  const params = settings.providerParams?.[pid] || {};

  // Set a single param under the active provider's namespace.
  const setParam = (key, value) =>
    setSettings((s) => ({
      ...s,
      providerParams: { ...s.providerParams, [pid]: { ...s.providerParams?.[pid], [key]: value } },
    }));

  // Selecting a provider sets the engine mode from its dialect (the provider owns the dialect).
  const onProvider = (id) => setSettings((s) => ({ ...s, provider: id, mode: providerMode(id) }));

  // When the provider's schema loads, fill any missing param defaults (without clobbering
  // already-set values) so its knobs render with sensible values.
  useEffect(() => {
    if (!schema?.defaults || !pid) return;
    setSettings((s) => {
      const cur = s.providerParams?.[pid] || {};
      let changed = false;
      const next = { ...cur };
      for (const [k, val] of Object.entries(schema.defaults)) {
        if (next[k] === undefined) {
          next[k] = val;
          changed = true;
        }
      }
      if (!changed) return s;
      return { ...s, providerParams: { ...s.providerParams, [pid]: next } };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema, pid]);

  return (
    <div className="settings">
      <div className="settings-actions">
        <button
          onClick={() => {
            if (confirm("Reset all settings to defaults?")) setSettings({ ...defaultSettings });
          }}
        >
          Reset to defaults
        </button>
      </div>

      <Group title="Generation backend">
        <Select
          label="Provider"
          value={settings.provider}
          onChange={onProvider}
          options={availableProviders().map((p) => ({ value: p.id, label: p.label }))}
        />
        <p className="field-note">
          {provider?.tier === "api"
            ? "Generates images directly."
            : provider?.tier === "syntax"
              ? "No API — copy the prompt into the tool."
              : "Plain-text target."}{" "}
          Dialect: {provider?.dialect}.
        </p>

        {provider?.needsKey && (
          <label className="field">
            <span>API key for {provider.label}</span>
            <input
              type="password"
              autoComplete="off"
              placeholder="kept only in this browser"
              value={settings.keys?.[pid] || ""}
              onChange={(e) => setKey(pid, e.target.value)}
            />
          </label>
        )}

        {/* Capability-driven: the provider's own knobs. */}
        {schema?.fields?.map((f) => (
          <ProviderField
            key={f.key}
            f={f}
            params={params}
            setParam={setParam}
            optionData={options}
          />
        ))}
      </Group>

      <Group title="Prompt">
        <Num
          label="Prompts per run"
          value={settings.promptCount}
          min={1}
          max={50}
          onChange={(v) => set({ promptCount: v })}
        />
        <Num
          label="Keywords (min)"
          value={settings.keywordCount}
          min={0}
          onChange={(v) => set({ keywordCount: v })}
        />
        <Num
          label="Keywords (max)"
          value={settings.keywordMaxCount}
          min={0}
          onChange={(v) => set({ keywordMaxCount: v })}
        />
        <Select
          label="Keyword list"
          value={settings.keywordsFilename}
          onChange={(v) => set({ keywordsFilename: v })}
          options={listOptions}
        />
        <Select
          label="Artist list"
          value={settings.artistFilename}
          onChange={(v) => set({ artistFilename: v })}
          options={listOptions}
        />
      </Group>

      <Group title="Emphasis">
        <Toggle
          label="Randomly emphasize keywords"
          value={settings.keywordEmphasis}
          onChange={(v) => set({ keywordEmphasis: v })}
        />
        <Num
          label="Emphasis chance"
          step={0.05}
          min={0}
          max={1}
          value={settings.emphasisChance}
          onChange={(v) => set({ emphasisChance: v })}
        />
        <Num
          label="Extra-level chance"
          step={0.05}
          min={0}
          max={1}
          value={settings.emphasisLevelChance}
          onChange={(v) => set({ emphasisLevelChance: v })}
        />
        <Num
          label="Max levels"
          min={0}
          value={settings.emphasisMaxLevels}
          onChange={(v) => set({ emphasisMaxLevels: v })}
        />
        <Num
          label="De-emphasis chance"
          step={0.05}
          min={0}
          max={1}
          value={settings.deEmphasisChance}
          onChange={(v) => set({ deEmphasisChance: v })}
        />
      </Group>

      <Group title="Editing & alternating">
        <Toggle
          label="Keyword editing"
          value={settings.keywordEditing}
          onChange={(v) => set({ keywordEditing: v })}
        />
        <Num
          label="Editing min"
          value={settings.keywordEditingMin}
          onChange={(v) => set({ keywordEditingMin: v })}
        />
        <Num
          label="Editing max"
          value={settings.keywordEditingMax}
          onChange={(v) => set({ keywordEditingMax: v })}
        />
        <Toggle
          label="Keyword alternating"
          value={settings.keywordAlternating}
          onChange={(v) => set({ keywordAlternating: v })}
        />
        <Num
          label="Alternating max levels"
          value={settings.keywordAlternatingMaxLevels}
          onChange={(v) => set({ keywordAlternatingMaxLevels: v })}
        />
      </Group>

      <Group title="Artists, fx & salt">
        <Toggle
          label="Include artists"
          value={settings.includeArtist}
          onChange={(v) => set({ includeArtist: v })}
        />
        <Num
          label="Min artists"
          min={0}
          value={settings.minArtist}
          onChange={(v) => set({ minArtist: v })}
        />
        <Num
          label="Max artists"
          min={0}
          value={settings.maxArtist}
          onChange={(v) => set({ maxArtist: v })}
        />
        <Toggle
          label="Auto-add artists"
          value={settings.autoAddArtists}
          onChange={(v) => set({ autoAddArtists: v })}
        />
        <Toggle
          label="Auto-add fx"
          value={settings.autoAddFx}
          onChange={(v) => set({ autoAddFx: v })}
        />
        <Toggle
          label="Prompt salt"
          value={settings.promptSalt}
          onChange={(v) => set({ promptSalt: v })}
        />
        <Num
          label="Salt start (-1 = random)"
          value={settings.promptSaltStart}
          onChange={(v) => set({ promptSaltStart: v })}
        />
        <Toggle
          label="Don't combine with AND"
          value={settings.noAnd}
          onChange={(v) => set({ noAnd: v })}
        />
        <Toggle
          label="List entries used once"
          value={settings.listEntriesUsedOnce}
          onChange={(v) => set({ listEntriesUsedOnce: v })}
        />
        <Toggle
          label="Reload lists each prompt"
          value={settings.reloadListsOnPromptChange}
          onChange={(v) => set({ reloadListsOnPromptChange: v })}
        />
      </Group>
    </div>
  );
}
