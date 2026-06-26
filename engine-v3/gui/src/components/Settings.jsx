/**
 * The gear's settings — the **non-provider** prompt knobs only. Provider controls (URL / key /
 * sampler / size / …) live in the provider box; the provider itself is chosen in the header; the
 * prompts-per-run counter sits on the prompt box. Keyword/artist *counts* and auto-add fx/artists
 * were removed — that's better expressed in the prompt itself (DPL).
 * @module gui/components/Settings
 */
import { useState, useEffect } from "react";
import { Num, Toggle, Select, Group } from "./Field.jsx";
import { getListNames } from "../lib/promptEngine.js";
import { rewriteProviders } from "../lib/providers/index.js";
import { getSessionKey, setSessionKey } from "../lib/sessionKeys.js";
import { metaFor } from "../lib/providerMeta.js";
import { defaultSettings } from "../lib/settings.js";

// Source-list options: every list, plus "false" meaning fully random.
const listOptions = [{ value: "false", label: "(fully random)" }, ...getListNames()];

/**
 * The API-key row for the chosen auto-fix rewrite provider (in-memory until Save).
 * @param {object} props `{ providerId, settings, setSettings }`.
 * @returns {JSX.Element}
 */
function RewriteKey({ providerId, settings, setSettings }) {
  const [val, setVal] = useState("");
  useEffect(() => {
    setVal(getSessionKey(providerId) || settings.keys?.[providerId] || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);
  const onChange = (v) => {
    setVal(v);
    setSessionKey(providerId, v);
  };
  const saved = !!settings.keys?.[providerId];
  return (
    <div className="key-row">
      <label className="field field-wide">
        <span className="field-label-row">
          API key
          {metaFor(providerId).keyUrl && (
            <a
              className="key-link"
              href={metaFor(providerId).keyUrl}
              target="_blank"
              rel="noreferrer"
            >
              Get a key ↗
            </a>
          )}
        </span>
        <input
          type="password"
          autoComplete="off"
          placeholder="for the rewrite provider — not saved unless you click Save"
          value={val}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <div className="key-actions">
        <button
          disabled={!val}
          onClick={() => {
            if (val && confirm("Save this rewrite key in your browser?"))
              setSettings((s) => ({ ...s, keys: { ...s.keys, [providerId]: val } }));
          }}
        >
          Save
        </button>
        {saved && (
          <button
            className="ghost"
            onClick={() => {
              if (!confirm("Remove the saved rewrite key?")) return;
              setSettings((s) => {
                const keys = { ...s.keys };
                delete keys[providerId];
                return { ...s, keys };
              });
            }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The prompt-knobs form.
 * @param {object} props
 * @param {object} props.settings The current settings.
 * @param {Function} props.setSettings Update the settings.
 * @returns {JSX.Element}
 */
export default function Settings({ settings, setSettings }) {
  const set = (patch) => setSettings({ ...settings, ...patch });

  return (
    <div className="settings">
      <div className="settings-actions">
        <button
          className="ghost"
          onClick={() => {
            if (confirm("Reset all settings to defaults?")) setSettings({ ...defaultSettings });
          }}
        >
          Reset to defaults
        </button>
      </div>

      <Group title="Auto-fix (rewrite)">
        <Select
          label="Rewrite with"
          value={settings.rewriteProvider || "none"}
          onChange={(v) => set({ rewriteProvider: v })}
          options={[
            { value: "none", label: "None (off)" },
            ...rewriteProviders().map((p) => ({ value: p.id, label: p.label })),
          ]}
        />
        {settings.rewriteProvider && settings.rewriteProvider !== "none" && (
          <RewriteKey
            providerId={settings.rewriteProvider}
            settings={settings}
            setSettings={setSettings}
          />
        )}
        <p className="hint">
          When on, this AI cleans up / re-words the prompt before it's sent to the image provider. A
          toggle appears on the prompt box; the original is kept under the result.
        </p>
      </Group>

      <Group title="Vocabulary">
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

      <Group title="Salt & lists">
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
