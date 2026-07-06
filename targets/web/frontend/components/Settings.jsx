/**
 * The gear's settings — the **non-provider** prompt knobs only. Provider controls (URL / key /
 * sampler / size / …) live in the provider box; the provider itself is chosen in the header; the
 * prompts-per-run counter sits on the prompt box. Keyword/artist *counts* and auto-add fx/artists
 * were removed — that's better expressed in the prompt itself (DPL).
 * @module gui/components/Settings
 */
import { useIntl, defineMessages } from "react-intl";
import { Num, Text, Toggle, Select, Group } from "./Field.jsx";
import { getListNames } from "../lib/promptEngine.js";
import { defaultSettings } from "../lib/settings.js";
import { dialog } from "../lib/dialog.js";

const msgs = defineMessages({
  resetBtn: { id: "settings.reset", defaultMessage: "Reset to defaults" },
  resetConfirm: {
    id: "settings.resetConfirm",
    defaultMessage: "Reset all settings to defaults?",
  },
  groupSeed: { id: "settings.group.seed", defaultMessage: "Seed" },
  seedRandom: { id: "settings.seedRandom", defaultMessage: "Random seed" },
  seedField: { id: "settings.seedField", defaultMessage: "Seed" },
  seedHintRandom: {
    id: "settings.seedHintRandom",
    defaultMessage: "A fresh random seed each roll — shown below so you can copy it.",
  },
  seedHintPinned: {
    id: "settings.seedHintPinned",
    defaultMessage: "Pinned: every roll reuses this seed and reproduces the same prompt. Any text works — numbers, words, or a phrase.",
  },
  groupVocabulary: { id: "settings.group.vocabulary", defaultMessage: "Vocabulary" },
  fullyRandom: {
    id: "settings.list.fullyRandom",
    defaultMessage: "(fully random)",
    description: "Source-list option meaning draw from the whole dictionary",
  },
  keywordList: { id: "settings.keywordList", defaultMessage: "Keyword list" },
  artistList: { id: "settings.artistList", defaultMessage: "Artist list" },
  naturalArtistStyle: {
    id: "settings.naturalArtistStyle",
    defaultMessage: "Natural language for artists & styles",
  },
  groupEmphasis: { id: "settings.group.emphasis", defaultMessage: "Emphasis" },
  randEmphasize: {
    id: "settings.randEmphasize",
    defaultMessage: "Randomly emphasize keywords",
  },
  emphasisChance: { id: "settings.emphasisChance", defaultMessage: "Emphasis chance" },
  extraLevelChance: { id: "settings.extraLevelChance", defaultMessage: "Extra-level chance" },
  maxLevels: { id: "settings.maxLevels", defaultMessage: "Max levels" },
  deEmphasisChance: { id: "settings.deEmphasisChance", defaultMessage: "De-emphasis chance" },
  groupEditing: { id: "settings.group.editing", defaultMessage: "Editing & alternating" },
  keywordEditing: { id: "settings.keywordEditing", defaultMessage: "Keyword editing" },
  editingMin: { id: "settings.editingMin", defaultMessage: "Editing min" },
  editingMax: { id: "settings.editingMax", defaultMessage: "Editing max" },
  keywordAlternating: {
    id: "settings.keywordAlternating",
    defaultMessage: "Keyword alternating",
  },
  alternatingMaxLevels: {
    id: "settings.alternatingMaxLevels",
    defaultMessage: "Alternating max levels",
  },
  groupSalt: { id: "settings.group.salt", defaultMessage: "Salt & lists" },
  promptSalt: { id: "settings.promptSalt", defaultMessage: "Prompt salt" },
  saltStart: {
    id: "settings.saltStart",
    defaultMessage: "Salt start (-1 = random)",
  },
  noAnd: { id: "settings.noAnd", defaultMessage: "Don't combine with AND" },
  usedOnce: { id: "settings.usedOnce", defaultMessage: "List entries used once" },
  reloadLists: { id: "settings.reloadLists", defaultMessage: "Reload lists each prompt" },
});

/**
 * The prompt-knobs form.
 * @param {object} props
 * @param {object} props.settings The current settings.
 * @param {Function} props.setSettings Update the settings.
 * @returns {JSX.Element}
 */
export default function Settings({ settings, setSettings }) {
  const intl = useIntl();
  const set = (patch) => setSettings({ ...settings, ...patch });

  // Source-list options: every list, plus "(fully random)" meaning fully random.
  // List names themselves are content identifiers (not UI strings) and stay as-is.
  const listOptions = [
    { value: "false", label: intl.formatMessage(msgs.fullyRandom) },
    ...getListNames(),
  ];

  return (
    <div className="settings">
      <div className="settings-actions">
        <button
          className="ghost"
          onClick={async () => {
            if (await dialog.confirm({ message: intl.formatMessage(msgs.resetConfirm) }))
              setSettings({ ...defaultSettings });
          }}
        >
          {intl.formatMessage(msgs.resetBtn)}
        </button>
      </div>

      <Group title={intl.formatMessage(msgs.groupSeed)}>
        <Toggle
          label={intl.formatMessage(msgs.seedRandom)}
          value={settings.randomSeed !== false}
          onChange={(v) => set({ randomSeed: v })}
        />
        <Text
          label={intl.formatMessage(msgs.seedField)}
          value={settings.promptSeed ?? ""}
          onChange={(v) => set({ promptSeed: v })}
          readOnly={settings.randomSeed !== false}
          aria-readonly={settings.randomSeed !== false}
          className={settings.randomSeed !== false ? "is-locked" : undefined}
        />
        <p className="settings-hint">
          {intl.formatMessage(
            settings.randomSeed !== false ? msgs.seedHintRandom : msgs.seedHintPinned,
          )}
        </p>
      </Group>

      <Group title={intl.formatMessage(msgs.groupVocabulary)}>
        <Select
          label={intl.formatMessage(msgs.keywordList)}
          value={settings.keywordsFilename}
          onChange={(v) => set({ keywordsFilename: v })}
          options={listOptions}
        />
        <Select
          label={intl.formatMessage(msgs.artistList)}
          value={settings.artistFilename}
          onChange={(v) => set({ artistFilename: v })}
          options={listOptions}
        />
        <Toggle
          label={intl.formatMessage(msgs.naturalArtistStyle)}
          value={settings.naturalArtistStyle !== false}
          onChange={(v) => set({ naturalArtistStyle: v })}
        />
      </Group>

      <Group title={intl.formatMessage(msgs.groupEmphasis)}>
        <Toggle
          label={intl.formatMessage(msgs.randEmphasize)}
          value={settings.keywordEmphasis}
          onChange={(v) => set({ keywordEmphasis: v })}
        />
        <Num
          label={intl.formatMessage(msgs.emphasisChance)}
          step={0.05}
          min={0}
          max={1}
          value={settings.emphasisChance}
          onChange={(v) => set({ emphasisChance: v })}
        />
        <Num
          label={intl.formatMessage(msgs.extraLevelChance)}
          step={0.05}
          min={0}
          max={1}
          value={settings.emphasisLevelChance}
          onChange={(v) => set({ emphasisLevelChance: v })}
        />
        <Num
          label={intl.formatMessage(msgs.maxLevels)}
          min={0}
          value={settings.emphasisMaxLevels}
          onChange={(v) => set({ emphasisMaxLevels: v })}
        />
        <Num
          label={intl.formatMessage(msgs.deEmphasisChance)}
          step={0.05}
          min={0}
          max={1}
          value={settings.deEmphasisChance}
          onChange={(v) => set({ deEmphasisChance: v })}
        />
      </Group>

      <Group title={intl.formatMessage(msgs.groupEditing)}>
        <Toggle
          label={intl.formatMessage(msgs.keywordEditing)}
          value={settings.keywordEditing}
          onChange={(v) => set({ keywordEditing: v })}
        />
        <Num
          label={intl.formatMessage(msgs.editingMin)}
          value={settings.keywordEditingMin}
          onChange={(v) => set({ keywordEditingMin: v })}
        />
        <Num
          label={intl.formatMessage(msgs.editingMax)}
          value={settings.keywordEditingMax}
          onChange={(v) => set({ keywordEditingMax: v })}
        />
        <Toggle
          label={intl.formatMessage(msgs.keywordAlternating)}
          value={settings.keywordAlternating}
          onChange={(v) => set({ keywordAlternating: v })}
        />
        <Num
          label={intl.formatMessage(msgs.alternatingMaxLevels)}
          value={settings.keywordAlternatingMaxLevels}
          onChange={(v) => set({ keywordAlternatingMaxLevels: v })}
        />
      </Group>

      <Group title={intl.formatMessage(msgs.groupSalt)}>
        <Toggle
          label={intl.formatMessage(msgs.promptSalt)}
          value={settings.promptSalt}
          onChange={(v) => set({ promptSalt: v })}
        />
        <Num
          label={intl.formatMessage(msgs.saltStart)}
          value={settings.promptSaltStart}
          onChange={(v) => set({ promptSaltStart: v })}
        />
        <Toggle
          label={intl.formatMessage(msgs.noAnd)}
          value={settings.noAnd}
          onChange={(v) => set({ noAnd: v })}
        />
        <Toggle
          label={intl.formatMessage(msgs.usedOnce)}
          value={settings.listEntriesUsedOnce}
          onChange={(v) => set({ listEntriesUsedOnce: v })}
        />
        <Toggle
          label={intl.formatMessage(msgs.reloadLists)}
          value={settings.reloadListsOnPromptChange}
          onChange={(v) => set({ reloadListsOnPromptChange: v })}
        />
      </Group>
    </div>
  );
}
