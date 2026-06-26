/**
 * The Settings tab — the full settings form (provider / BYOK key, prompt knobs,
 * emphasis / editing / alternating, artists / fx / salt, image params, negative
 * prompt). (Hidden from the nav while the UI is reworked.)
 * @module gui/components/Settings
 */
import { Text, Num, Toggle, Select, TextArea, Group } from "./Field.jsx";
import { getListNames } from "../lib/promptEngine.js";
import { availableProviders, getProvider } from "../lib/providers/index.js";
import { defaultSettings } from "../lib/settings.js";

const MODES = [
  { value: "StableDiffusion", label: "Stable Diffusion" },
  { value: "NovelAI", label: "NovelAI" },
  { value: "Midjourney", label: "Midjourney" },
];

// Source-list options: every list, plus "false" meaning fully random.
const listOptions = [{ value: "false", label: "(fully random)" }, ...getListNames()];

/**
 * The full settings form.
 * @param {object} props
 * @param {object} props.settings The current settings.
 * @param {Function} props.setSettings Update the settings.
 * @returns {JSX.Element}
 */
export default function Settings({ settings, setSettings }) {
  const set = (patch) => setSettings({ ...settings, ...patch });
  const setKey = (id, value) => setSettings({ ...settings, keys: { ...settings.keys, [id]: value } });
  const provider = getProvider(settings.provider);

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
          onChange={(v) => set({ provider: v })}
          options={availableProviders().map((p) => ({ value: p.id, label: p.label }))}
        />
        {provider.local && (
          <Text
            label="Local WebUI URL"
            value={settings.localWebuiUrl}
            onChange={(v) => set({ localWebuiUrl: v })}
          />
        )}
        {provider.needsKey && (
          <label className="field">
            <span>API key for {provider.label}</span>
            <input
              type="password"
              autoComplete="off"
              placeholder="kept only in this browser"
              value={settings.keys?.[provider.id] || ""}
              onChange={(e) => setKey(provider.id, e.target.value)}
            />
          </label>
        )}
      </Group>

      <Group title="Prompt">
        <Select label="Mode" value={settings.mode} onChange={(v) => set({ mode: v })} options={MODES} />
        <Num label="Prompts per run" value={settings.promptCount} min={1} max={50} onChange={(v) => set({ promptCount: v })} />
        <Num label="Keywords (min)" value={settings.keywordCount} min={0} onChange={(v) => set({ keywordCount: v })} />
        <Num label="Keywords (max)" value={settings.keywordMaxCount} min={0} onChange={(v) => set({ keywordMaxCount: v })} />
        <Select label="Keyword list" value={settings.keywordsFilename} onChange={(v) => set({ keywordsFilename: v })} options={listOptions} />
        <Select label="Artist list" value={settings.artistFilename} onChange={(v) => set({ artistFilename: v })} options={listOptions} />
      </Group>

      <Group title="Emphasis">
        <Toggle label="Randomly emphasize keywords" value={settings.keywordEmphasis} onChange={(v) => set({ keywordEmphasis: v })} />
        <Num label="Emphasis chance" step={0.05} min={0} max={1} value={settings.emphasisChance} onChange={(v) => set({ emphasisChance: v })} />
        <Num label="Extra-level chance" step={0.05} min={0} max={1} value={settings.emphasisLevelChance} onChange={(v) => set({ emphasisLevelChance: v })} />
        <Num label="Max levels" min={0} value={settings.emphasisMaxLevels} onChange={(v) => set({ emphasisMaxLevels: v })} />
        <Num label="De-emphasis chance" step={0.05} min={0} max={1} value={settings.deEmphasisChance} onChange={(v) => set({ deEmphasisChance: v })} />
      </Group>

      <Group title="Editing & alternating">
        <Toggle label="Keyword editing" value={settings.keywordEditing} onChange={(v) => set({ keywordEditing: v })} />
        <Num label="Editing min" value={settings.keywordEditingMin} onChange={(v) => set({ keywordEditingMin: v })} />
        <Num label="Editing max" value={settings.keywordEditingMax} onChange={(v) => set({ keywordEditingMax: v })} />
        <Toggle label="Keyword alternating" value={settings.keywordAlternating} onChange={(v) => set({ keywordAlternating: v })} />
        <Num label="Alternating max levels" value={settings.keywordAlternatingMaxLevels} onChange={(v) => set({ keywordAlternatingMaxLevels: v })} />
      </Group>

      <Group title="Artists, fx & salt">
        <Toggle label="Include artists" value={settings.includeArtist} onChange={(v) => set({ includeArtist: v })} />
        <Num label="Min artists" min={0} value={settings.minArtist} onChange={(v) => set({ minArtist: v })} />
        <Num label="Max artists" min={0} value={settings.maxArtist} onChange={(v) => set({ maxArtist: v })} />
        <Toggle label="Auto-add artists" value={settings.autoAddArtists} onChange={(v) => set({ autoAddArtists: v })} />
        <Toggle label="Auto-add fx" value={settings.autoAddFx} onChange={(v) => set({ autoAddFx: v })} />
        <Toggle label="Prompt salt" value={settings.promptSalt} onChange={(v) => set({ promptSalt: v })} />
        <Num label="Salt start (-1 = random)" value={settings.promptSaltStart} onChange={(v) => set({ promptSaltStart: v })} />
        <Toggle label="Don't combine with AND" value={settings.noAnd} onChange={(v) => set({ noAnd: v })} />
        <Toggle label="List entries used once" value={settings.listEntriesUsedOnce} onChange={(v) => set({ listEntriesUsedOnce: v })} />
        <Toggle label="Reload lists each prompt" value={settings.reloadListsOnPromptChange} onChange={(v) => set({ reloadListsOnPromptChange: v })} />
      </Group>

      <Group title="Image">
        <Text label="Sampler" value={settings.sampler} onChange={(v) => set({ sampler: v })} />
        <Num label="Steps" min={1} value={settings.imageSteps} onChange={(v) => set({ imageSteps: v })} />
        <Num label="Width" min={64} step={64} value={settings.imageWidth} onChange={(v) => set({ imageWidth: v })} />
        <Num label="Height" min={64} step={64} value={settings.imageHeight} onChange={(v) => set({ imageHeight: v })} />
        <Num label="CFG" step={0.5} value={settings.cfg} onChange={(v) => set({ cfg: v })} />
        <Num label="Seed (-1 = random)" value={settings.seed} onChange={(v) => set({ seed: v })} />
        <Toggle label="Restore faces" value={settings.restoreFaces} onChange={(v) => set({ restoreFaces: v })} />
      </Group>

      <Group title="Negative prompt">
        <TextArea label="" rows={4} value={settings.negativePrompt} onChange={(v) => set({ negativePrompt: v })} />
      </Group>
    </div>
  );
}
